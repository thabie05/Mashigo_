// src/utils/backup.js
// Backups of the register data: automatic daily snapshots inside Firestore,
// plus download / restore of a JSON file.
//
// A snapshot is  backups/{id}  (details + employee list)  and  backups/{id}/parts/*
// (one part per month and one per history month). Old snapshots that hold the whole
// register in one "payload" are still understood and are converted when restored.
import {
  doc, getDoc, setDoc, getDocs, deleteDoc, collection, query, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MONTHS_COL, HISTORY_COL, rollcallRef, normalise, summarise, replaceAllData, SCHEMA_VERSION,
} from './dataModel';

const BACKUPS = () => collection(db, 'backups');
export const KEEP_AUTO = 30;   // daily snapshots kept
export const KEEP_OTHER = 20;  // manual / safety snapshots kept

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export const isEmptyBundle = (b) => !b || (!(b.rollcall?.employees || []).length && !Object.keys(b.months || {}).length);

// Read everything that makes up the register right now (from the server)
export async function readLiveBundle() {
  const [rc, ms, hs] = await Promise.all([getDoc(rollcallRef()), getDocs(collection(db, MONTHS_COL)), getDocs(collection(db, HISTORY_COL))]);
  if (!rc.exists()) throw new Error('There is no data to back up.');
  if (rc.metadata.fromCache || ms.metadata.fromCache || hs.metadata.fromCache) throw new Error('Cannot reach the database, so no backup was made.');
  const data = rc.data();
  const months = {}; ms.docs.forEach((d) => { months[d.id] = d.data(); });
  const history = {}; hs.docs.forEach((d) => { history[d.id] = d.data(); });
  // if the register is still in the old format, fold the old fields in so the copy is complete
  if (data.schemaVersion !== SCHEMA_VERSION) return normalise(data);
  return { rollcall: { employees: data.employees || [], schemaVersion: SCHEMA_VERSION }, months, history };
}

// kind: 'auto' | 'manual' | 'safety'
export async function createBackup(kind, label, createdBy = 'System') {
  const bundle = await readLiveBundle();
  if (kind === 'auto' && isEmptyBundle(bundle)) return null; // never snapshot an empty register automatically
  const now = new Date();
  const id = kind === 'auto' ? `auto-${dayKey(now)}` : `${kind}-${now.getTime()}`;
  if (kind === 'auto') {
    const existing = await getDoc(doc(db, 'backups', id));
    if (existing.exists()) return null; // already have today's – never overwrite a good one
  }
  const parts = [
    ...Object.entries(bundle.months).map(([m, v]) => [`months-${m}`, v]),
    ...Object.entries(bundle.history).map(([m, v]) => [`history-${m}`, v]),
  ];
  for (let i = 0; i < parts.length; i += 100) {
    const batch = writeBatch(db);
    parts.slice(i, i + 100).forEach(([pid, v]) => batch.set(doc(db, 'backups', id, 'parts', pid), { payload: JSON.stringify(v) }));
    await batch.commit();
  }
  // the main document is written LAST: a snapshot only appears in the list once it is complete
  await setDoc(doc(db, 'backups', id), {
    kind, label: label || kind, createdBy, createdAt: now.toISOString(), version: 2,
    summary: summarise(bundle), rollcall: JSON.stringify(bundle.rollcall),
  });
  await pruneBackups();
  return id;
}

export async function listBackups() {
  const res = await getDocs(query(BACKUPS(), orderBy('createdAt', 'desc'), limit(100)));
  return res.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function removeBackupDocs(id) {
  const parts = await getDocs(collection(db, 'backups', id, 'parts'));
  await Promise.all(parts.docs.map((p) => deleteDoc(p.ref).catch(() => {})));
  await deleteDoc(doc(db, 'backups', id));
}

async function pruneBackups() {
  const all = await listBackups();
  const auto = all.filter((b) => b.kind === 'auto');
  const other = all.filter((b) => b.kind !== 'auto');
  const stale = [...auto.slice(KEEP_AUTO), ...other.slice(KEEP_OTHER)];
  await Promise.all(stale.map((b) => removeBackupDocs(b.id).catch(() => {})));
}

export async function deleteBackup(id) { await removeBackupDocs(id); }

// Turn a stored snapshot back into { rollcall, months, history }
async function bundleOfSnapshot(backup) {
  if (backup.payload) return normalise(JSON.parse(backup.payload)); // old single-document snapshot
  const bundle = { rollcall: JSON.parse(backup.rollcall), months: {}, history: {} };
  const parts = await getDocs(collection(db, 'backups', backup.id, 'parts'));
  parts.docs.forEach((p) => {
    const v = JSON.parse(p.data().payload);
    if (p.id.startsWith('months-')) bundle.months[p.id.slice(7)] = v; else bundle.history[p.id.slice(8)] = v;
  });
  return bundle;
}

// Replaces the live register with the snapshot's data (after taking a safety copy)
export async function restoreSnapshot(backup, who) {
  const bundle = await bundleOfSnapshot(backup);
  await createBackup('safety', 'Before restore', who);
  await replaceAllData(bundle);
}

// ---------- File export / import ----------
export async function buildBackupFile() {
  const bundle = await readLiveBundle();
  const fp = await getDocs(collection(db, 'fingerprints'));
  return {
    app: 'bmashilo-attendance-register',
    version: 2,
    exportedAt: new Date().toISOString(),
    rollcall: bundle.rollcall,
    months: bundle.months,
    history: bundle.history,
    fingerprints: Object.fromEntries(fp.docs.map((d) => [d.id, d.data()])),
  };
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const backupFileName = () => `attendance-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;

export function parseBackupFile(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (parsed?.app !== 'bmashilo-attendance-register' || !parsed.rollcall) throw new Error('That is not an attendance backup file.');
  return parsed;
}

export async function restoreFromFile(parsed, who) {
  // version 1 files keep everything inside "rollcall"; version 2 files have months/history beside it
  const bundle = parsed.months ? { rollcall: parsed.rollcall, months: parsed.months, history: parsed.history || {} } : normalise(parsed.rollcall);
  await createBackup('safety', 'Before restore from file', who);
  await replaceAllData(bundle);
  const fps = parsed.fingerprints || {};
  await Promise.all(Object.entries(fps).map(([id, data]) => setDoc(doc(db, 'fingerprints', id), data)));
}

export { summarise };