// src/utils/safeWrites.js
//
// RULE: never write a "default" or "empty" value because a read said "not found".
// Offline (or on a cache-only answer) Firestore also says "not found", so every
// write that depends on what is already stored goes through a transaction.
// A transaction reads from the SERVER; if the server can't be reached it fails
// and NOTHING is written.
import { doc, runTransaction, arrayUnion, deleteField, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers, USERS_STORAGE_KEY } from '../data/users';
import { rollcallRef, monthRef, historyRef, MONTHS_COL, groupHistory, SCHEMA_VERSION } from './dataModel';

const usersRef = () => doc(db, 'users', 'credentials');

// Create the starter register document ONLY if the server confirms it is missing.
export function ensureRollcallDoc() {
  return runTransaction(db, async (t) => {
    const snap = await t.get(rollcallRef());
    if (!snap.exists()) t.set(rollcallRef(), { employees: [], schemaVersion: SCHEMA_VERSION });
  });
}

// Change the employee list based on the SERVER's current list (never on screen state).
// History entries go to their own month documents in the same transaction.
export function updateEmployeeList(change, logs = []) {
  return runTransaction(db, async (t) => {
    const snap = await t.get(rollcallRef());
    if (!snap.exists()) throw new Error('The register data could not be found on the server. Nothing was changed.');
    t.update(rollcallRef(), { employees: change([...(snap.data().employees || [])]) });
    Object.entries(groupHistory(logs)).forEach(([id, entries]) => {
      t.set(historyRef(id), { entries: arrayUnion(...entries) }, { merge: true });
    });
  });
}

// Remove an employee and everything recorded about them, atomically, from the SERVER's data.
export async function removeEmployeeEverywhere(emp, log) {
  const monthIds = (await getDocs(collection(db, MONTHS_COL))).docs.map((d) => d.id);
  await runTransaction(db, async (t) => {
    const snap = await t.get(rollcallRef());
    if (!snap.exists()) throw new Error('The register data could not be found on the server. Nothing was changed.');
    const months = await Promise.all(monthIds.map(async (id) => ({ id, snap: await t.get(monthRef(id)) }))); // all reads first
    t.update(rollcallRef(), { employees: (snap.data().employees || []).filter((e) => e.id !== emp.id) });
    months.forEach(({ id, snap: ms }) => {
      if (!ms.exists()) return;
      const d = ms.data();
      const upd = { [`attendance.${emp.id}`]: deleteField() };
      ['notes', 'edits', 'timeLogs'].forEach((f) => Object.keys(d[f] || {}).forEach((k) => { if (k.startsWith(`${emp.id}-`)) upd[`${f}.${k}`] = deleteField(); }));
      t.update(monthRef(id), upd);
    });
    Object.entries(groupHistory([log])).forEach(([hid, entries]) => t.set(historyRef(hid), { entries: arrayUnion(...entries) }, { merge: true }));
  });
}

// Create the default login document only if the server confirms there is none.
export async function seedUsersIfMissing() {
  return runTransaction(db, async (t) => {
    const snap = await t.get(usersRef());
    if (snap.exists() && snap.data().users && snap.data().users.length > 0) return snap.data().users;
    const users = loadUsers();
    t.set(usersRef(), { users }, { merge: true });
    return users;
  });
}

// Change the users list based on the SERVER's current list.
export async function updateUsers(build) {
  const next = await runTransaction(db, async (t) => {
    const snap = await t.get(usersRef());
    const current = snap.exists() && snap.data().users && snap.data().users.length > 0 ? snap.data().users : loadUsers();
    const users = build(current.map((u) => ({ ...u })));
    t.set(usersRef(), { users }, { merge: true });
    return users;
  });
  try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}