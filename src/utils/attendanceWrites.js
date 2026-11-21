import { doc, getDoc, getDocs, collection, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { monthRef, historyRef, MONTHS_COL, rollcallRef, groupHistory, monthIdOf } from './dataModel';

const pad = (n) => String(n).padStart(2, '0');

export const dateKeyFor = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Records a fingerprint action (start or end shift) with validation.
 * Time logs, the attendance mark and the history entry all live in the month documents
 * (rollcall_months/{YYYY-MM} and rollcall_history/{YYYY-MM}); the employee list is never touched.
 * Returns { action, time, clockInTime, clockOutTime, error }
 */
export async function recordFingerprintAction(employee, action) {
  const now = new Date();
  const dateKey = dateKeyFor(now);
  const monthId = monthIdOf(dateKey);
  const logKey = `${employee.id}-${dateKey}`;

  const snap = await getDoc(monthRef(monthId)); // fails offline: nothing is recorded
  const existingLog = snap.exists() ? (snap.data().timeLogs || {})[logKey] : undefined;
  const nowIso = now.toISOString();

  const baseHistoryEntry = {
    id: Date.now(),
    employeeId: employee.id,
    employeeName: employee.name,
    day: now.getDate(),
    date: dateKey,
    note: '',
    editor: 'Fingerprint Kiosk',
    editedAt: nowIso,
  };

  if (action === 'start') {
    if (existingLog?.clockIn) {
      return {
        error: `Your shift already started at ${new Date(existingLog.clockIn).toLocaleTimeString()}`,
        clockInTime: new Date(existingLog.clockIn),
      };
    }
    const batch = writeBatch(db);
    batch.set(monthRef(monthId), {
      timeLogs: { [logKey]: { clockIn: nowIso } },
      attendance: { [employee.id]: { [dateKey]: 'present' } },
    }, { merge: true });
    batch.set(historyRef(monthId), { entries: arrayUnion({ ...baseHistoryEntry, status: 'Present (fingerprint clock-in)' }) }, { merge: true });
    await batch.commit();
    return { action: 'clock-in', time: now };
  }

  if (action === 'end') {
    if (!existingLog?.clockIn) {
      return { error: 'You have not started your shift today.' };
    }
    if (existingLog.clockOut) {
      return {
        error: `Your shift already ended at ${new Date(existingLog.clockOut).toLocaleTimeString()}`,
        clockInTime: new Date(existingLog.clockIn),
        clockOutTime: new Date(existingLog.clockOut),
      };
    }
    const batch = writeBatch(db);
    batch.set(monthRef(monthId), { timeLogs: { [logKey]: { clockOut: nowIso } } }, { merge: true });
    batch.set(historyRef(monthId), { entries: arrayUnion({ ...baseHistoryEntry, status: 'Clock-out (fingerprint)' }) }, { merge: true });
    await batch.commit();
    return { action: 'clock-out', time: now, clockInTime: new Date(existingLog.clockIn) };
  }

  return { error: 'Invalid action.' };
}

/**
 * Finds every timeLogs entry from a PAST day (strictly before today) that has a clockIn but
 * no clockOut — someone forgot to end their shift — and closes it at 23:59:59 of that day.
 * Safe to call repeatedly and from several places: it only sets the specific fields of the
 * specific stale entries (merge writes), never replacing a document.
 */
export async function closeStaleShifts() {
  const monthsSnap = await getDocs(collection(db, MONTHS_COL));
  if (monthsSnap.metadata.fromCache) return { closed: 0 }; // not sure we are seeing the server: do nothing
  const empSnap = await getDoc(rollcallRef());
  const nameById = {};
  if (empSnap.exists()) (empSnap.data().employees || []).forEach((e) => { nameById[e.id] = e.name; });

  const todayKey = dateKeyFor(new Date());
  const writes = []; // [ref, value]
  const historyEntries = [];

  monthsSnap.docs.forEach((d) => {
    const timeLogs = d.data().timeLogs || {};
    const fixes = {};
    Object.keys(timeLogs).forEach((logKey) => {
      const entry = timeLogs[logKey];
      if (!entry || !entry.clockIn || entry.clockOut) return; // only open shifts
      const dateKey = logKey.slice(-10);
      if (dateKey >= todayKey) return; // today (or future) — still an active shift
      const employeeId = logKey.slice(0, logKey.length - 11);
      const midnightIso = new Date(`${dateKey}T23:59:59`).toISOString();
      fixes[logKey] = { clockOut: midnightIso, autoClockOut: true };
      historyEntries.push({
        id: Date.now() + Math.random(),
        employeeId,
        employeeName: nameById[employeeId] || 'Unknown',
        day: Number(dateKey.slice(-2)),
        date: dateKey,
        status: 'Auto clock-out (forgot to end shift)',
        note: '',
        editor: 'System (midnight auto clock-out)',
        editedAt: midnightIso,
      });
    });
    if (Object.keys(fixes).length) writes.push([d.ref, { timeLogs: fixes }]);
  });

  if (historyEntries.length === 0) return { closed: 0 };
  Object.entries(groupHistory(historyEntries)).forEach(([id, entries]) => writes.push([historyRef(id), { entries: arrayUnion(...entries) }]));

  for (let i = 0; i < writes.length; i += 200) {
    const batch = writeBatch(db);
    writes.slice(i, i + 200).forEach(([ref, value]) => batch.set(ref, value, { merge: true }));
    await batch.commit();
  }
  return { closed: historyEntries.length };
}