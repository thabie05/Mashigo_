// src/data/permissions.js
// Admins can do everything. Other users only get what is ticked for them.

export const PERMISSIONS = [
  { key: 'markAttendance',  label: 'Mark attendance',            desc: 'Set present / late / early / absent / off on the register' },
  { key: 'editLocked',      label: 'Edit locked entries',        desc: 'Change a mark after it has already been edited twice' },
  { key: 'clearAttendance', label: 'Clear attendance marks',     desc: 'Remove a mark from the register' },
  { key: 'manageEmployees', label: 'Manage employees',           desc: 'Add, rename, delete and enroll fingerprints' },
  { key: 'viewHistory',     label: 'View history & logs',        desc: 'Open the history / edit log page' },
  { key: 'emailReports',    label: 'Send & export reports',      desc: 'Email, print or download attendance reports' },
];

// What existing non-admin accounts (created before permissions existed) keep getting
export const DEFAULT_USER_PERMISSIONS = ['markAttendance', 'viewHistory', 'emailReports'];

export const can = (user, perm) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const list = Array.isArray(user.permissions) ? user.permissions : DEFAULT_USER_PERMISSIONS;
  return list.includes(perm);
};