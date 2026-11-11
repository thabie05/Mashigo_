// src/data/users.js

export const USERS_STORAGE_KEY = 'mashigo_users';

export const loadUsers = () => {
  const saved = localStorage.getItem(USERS_STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  // Default fallback users
  return [
    { username: 'admin', password: 'admin123', fullName: 'B. Mashilo', role: 'admin' },
  ];
};