// src/utils/dataModel.js
//
// DATA LAYOUT (schemaVersion 2)
//   rollcall/data                 { employees: [...], schemaVersion: 2 }        <- small, rarely changes
//   rollcall_months/{YYYY-MM}     { attendance, edits, notes, timeLogs }         <- one document per month
//   rollcall_history/{YYYY-MM}    { entries: [ ...history entries... ] }         <- one document per month
//   fingerprints/{employeeId}     enrolled templates (unchanged)
//   users/credentials             logins (unchanged)
//   backups/{id}                  snapshots (+ backups/{id}/parts/* for months & history)
//
// Splitting keeps every document small (Firestore's limit is 1 MB), and a mistake in one
// month or in the history can no longer touch the employee list or any other month.
import {
  doc, collection, getDoc, getDocs, setDoc, writeBatch, runTransaction, arrayUnion, deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';

export const SCHEMA_VERSION = 2;
export const MONTHS_COL = 'rollcall_months';
export const HISTORY_COL = 'rollcall_history';
export const LEGACY_FIELDS = ['attendance', 'edits', 'notes', 'history', 'timeLogs'];

export const rollcallRef = () => doc(db, 'rollcall', 'data');
export const monthRef = (id) => doc(db, MONTHS_COL, id);
export const historyRef = (id) => doc(db, HISTORY_COL, id);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const monthIdOf = (dateStr) => String(dateStr).slice(0, 7);
export const monthIdNow = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
// keys such as "{employeeId}-{YYYY-MM-DD}": the date is always the last 10 characters
const dateOfKey = (key) => String(key).slice(-10);
const validKeyDate = (key) => DATE_RE.test(dateOfKey(key));

// Group history entries by the month they belong to
export const groupHistory = (entries) => {
  const out = {};
  entries.forEach((h) => {
    const d = DATE_RE.test(String(h.date)) ? h.date : String(h.editedAt || '').slice(0, 10);
    const id = DATE_RE.test(d) ? monthIdOf(d) : 'undated';
    (out[id] = out[id] || []).push(h);
  });
  return out;
};

// Old single-document format  ->  new pieces
export function splitLegacy(data) {
  const months = {};
  const m = (id) => (months[id] = months[id] || { attendance: {}, edits: {}, notes: {}, timeLogs: {} });
  Object.entries(data.attendance || {}).forEach(([emp, days]) => {
    Object.entries(days || {}).forEach(([date, val]) => {
      if (!DATE_RE.test(date)) return;
      const status = val === true ? 'present' : val === false ? 'absent' : val;
      const mm = m(monthIdOf(date));
      (mm.attendance[emp] = mm.attendance[emp] || {})[date] = status;
    });
  });
  ['edits', 'notes', 'timeLogs'].forEach((f) => {
    Object.entries(data[f] || {}).forEach(([key, val]) => { if (validKeyDate(key)) m(monthIdOf(dateOfKey(key)))[f][key] = val; });
  });
  const history = {};
  Object.entries(groupHistory(data.history || [])).forEach(([id, entries]) => { history[id] = { entries }; });
  return { rollcall: { employees: data.employees || [], schemaVersion: SCHEMA_VERSION }, months, history };
}

// Anything (old document, new bundle) -> { rollcall, months, history }
export function normalise(obj) {
  if (obj && obj.rollcall && obj.months) return obj; // already split
  return splitLegacy(obj || {});
}

export const summarise = ({ rollcall, months, history }) => ({
  historyEntries: Object.values(history || {}).reduce((n, h) => n + (h.entries || []).length, 0),
  employees: (rollcall.employees || []).filter((e) => !e.isDeleted).length,
  deletedEmployees: (rollcall.employees || []).filter((e) => e.isDeleted).length,
  marks: Object.values(months || {}).reduce((n, mm) => n + Object.values(mm.attendance || {}).reduce((k, d) => k + Object.keys(d || {}).length, 0), 0),
});

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// ---------------------------------------------------------------------------
// One-time migration of an old-format register document.
//   1. save the old document untouched in backups/pre-split-<time>
//   2. copy everything into the month / history documents (merge, so it is safe to repeat)
//   3. only then remove the old fields and mark the document schemaVersion 2
// ---------------------------------------------------------------------------
let migrating = null;
export function migrateIfNeeded() {
  if (!migrating) migrating = runMigration().finally(() => { migrating = null; });
  return migrating;
}

async function runMigration() {
  const snap = await getDoc(rollcallRef());
  if (!snap.exists() || snap.metadata.fromCache) return 'skipped';
  const data = snap.data();
  if (data.schemaVersion === SCHEMA_VERSION) return 'current';

  const now = new Date();
  const parts = splitLegacy(data);
  await setDoc(doc(db, 'backups', `pre-split-${now.getTime()}`), {
    kind: 'safety', label: 'Before data split (old format)', createdBy: 'System', createdAt: now.toISOString(),
    summary: summarise(parts), legacy: true, payload: JSON.stringify(data),
  });

  const ops = [
    ...Object.entries(parts.months).map(([id, mm]) => [monthRef(id), mm, false]),
    ...Object.entries(parts.history).map(([id, h]) => [historyRef(id), { entries: arrayUnion(...h.entries) }, false]),
  ];
  for (const group of chunk(ops, 200)) {
    const batch = writeBatch(db);
    group.forEach(([ref, value]) => batch.set(ref, value, { merge: true }));
    await batch.commit();
  }

  await runTransaction(db, async (t) => {
    const s = await t.get(rollcallRef());
    if (!s.exists() || s.data().schemaVersion === SCHEMA_VERSION) return;
    const upd = { schemaVersion: SCHEMA_VERSION };
    LEGACY_FIELDS.forEach((f) => { if (f in s.data()) upd[f] = deleteField(); });
    t.update(rollcallRef(), upd);
  });
  return 'migrated';
}

// ---------------------------------------------------------------------------
// Replace ALL live data with a { rollcall, months, history } bundle (used by restore).
// ---------------------------------------------------------------------------
export async function replaceAllData(bundle) {
  const b = normalise(bundle);
  const [monthSnap, historySnap] = await Promise.all([getDocs(collection(db, MONTHS_COL)), getDocs(collection(db, HISTORY_COL))]);
  if (monthSnap.metadata.fromCache || historySnap.metadata.fromCache) throw new Error('Cannot reach the database. Nothing was changed.');
  const ops = [];
  monthSnap.docs.forEach((d) => { if (!b.months[d.id]) ops.push((x) => x.delete(d.ref)); });
  historySnap.docs.forEach((d) => { if (!b.history[d.id]) ops.push((x) => x.delete(d.ref)); });
  Object.entries(b.months).forEach(([id, v]) => ops.push((x) => x.set(monthRef(id), v)));
  Object.entries(b.history).forEach(([id, v]) => ops.push((x) => x.set(historyRef(id), v)));
  for (const group of chunk(ops, 200)) {
    const batch = writeBatch(db);
    group.forEach((op) => op(batch));
    await batch.commit();
  }
  await setDoc(rollcallRef(), { ...b.rollcall, schemaVersion: SCHEMA_VERSION }); // last: employees
}