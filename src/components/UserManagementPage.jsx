import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers, USERS_STORAGE_KEY } from '../data/users';
import { PERMISSIONS, DEFAULT_USER_PERMISSIONS } from '../data/permissions';
import { UserPlus, Trash2, KeyRound, Save } from 'lucide-react';

const credRef = () => doc(db, 'users', 'credentials');

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '15px', marginBottom: '15px' };
const input = { width: '100%', padding: '8px 9px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-main)', background: 'var(--bg-input)', outline: 'none' };
const label = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' };
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '7px 12px', border: 'none', borderRadius: '6px', background: 'var(--accent-green-text)', color: '#fff', fontWeight: 600, fontSize: '11px', cursor: 'pointer' };
const ghostBtn = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer' };

function PermissionChecks({ value, onChange, disabled }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px' }}>
      {PERMISSIONS.map((p) => (
        <label key={p.key} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '11px', color: 'var(--text-main)', opacity: disabled ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}>
          <input type="checkbox" disabled={disabled} checked={disabled || value.includes(p.key)} onChange={() => toggle(p.key)} style={{ marginTop: '3px' }} />
          <span><strong>{p.label}</strong><br /><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{p.desc}</span></span>
        </label>
      ))}
    </div>
  );
}

export default function UserManagementPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [form, setForm] = useState({ fullName: '', username: '', password: '', role: 'user', permissions: [...DEFAULT_USER_PERMISSIONS] });
  const [drafts, setDrafts] = useState({}); // username -> edited { role, permissions }

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(credRef());
        setUsers(snap.exists() && snap.data().users?.length ? snap.data().users : loadUsers());
      } catch { setUsers(loadUsers()); }
      setLoading(false);
    })();
  }, []);

  // Re-read before every write so we never overwrite a password change made elsewhere
  const saveUsers = async (mutate) => {
    const snap = await getDoc(credRef());
    const latest = snap.exists() && snap.data().users?.length ? snap.data().users : loadUsers();
    const next = mutate(latest);
    await setDoc(credRef(), { users: next }, { merge: true });
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(next));
    setUsers(next);
    return next;
  };

  const addUser = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    const fullName = form.fullName.trim();
    if (!fullName || !username) return flash('error', 'Full name and username are required.');
    if (/\s/.test(username)) return flash('error', 'Username cannot contain spaces.');
    if (form.password.trim().length < 4) return flash('error', 'Password must be at least 4 characters.');
    try {
      let duplicate = false;
      await saveUsers((latest) => {
        if (latest.some((u) => u.username.toLowerCase() === username.toLowerCase())) { duplicate = true; return latest; }
        return [...latest, { username, fullName, password: form.password.trim(), role: form.role, permissions: form.role === 'admin' ? PERMISSIONS.map((p) => p.key) : form.permissions }];
      });
      if (duplicate) return flash('error', 'That username already exists.');
      setForm({ fullName: '', username: '', password: '', role: 'user', permissions: [...DEFAULT_USER_PERMISSIONS] });
      flash('success', `User "${username}" created.`);
    } catch (err) { flash('error', 'Failed to save: ' + err.message); }
  };

  const adminCount = (list) => list.filter((u) => u.role === 'admin').length;

  const saveAccess = async (username) => {
    const d = drafts[username];
    if (!d) return;
    try {
      let blocked = false;
      await saveUsers((latest) => {
        const target = latest.find((u) => u.username === username);
        if (target?.role === 'admin' && d.role !== 'admin' && adminCount(latest) <= 1) { blocked = true; return latest; }
        return latest.map((u) => u.username === username ? { ...u, role: d.role, permissions: d.permissions } : u);
      });
      if (blocked) return flash('error', 'There must be at least one admin.');
      setDrafts((p) => { const c = { ...p }; delete c[username]; return c; });
      flash('success', `Access updated for "${username}". They need to log in again to pick it up.`);
    } catch (err) { flash('error', 'Failed to save: ' + err.message); }
  };

  const resetPassword = async (username) => {
    const pw = window.prompt(`New password for "${username}" (min 4 characters):`);
    if (pw === null) return;
    if (pw.length < 4) return flash('error', 'Password must be at least 4 characters.');
    try {
      await saveUsers((latest) => latest.map((u) => u.username === username ? { ...u, password: pw } : u));
      flash('success', `Password reset for "${username}".`);
    } catch (err) { flash('error', 'Failed to save: ' + err.message); }
  };

  const deleteUser = async (username) => {
    if (username === currentUser.username) return flash('error', "You can't delete the account you're logged in with.");
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      let blocked = false;
      await saveUsers((latest) => {
        const target = latest.find((u) => u.username === username);
        if (target?.role === 'admin' && adminCount(latest) <= 1) { blocked = true; return latest; }
        return latest.filter((u) => u.username !== username);
      });
      if (blocked) return flash('error', 'There must be at least one admin.');
      flash('success', `User "${username}" deleted.`);
    } catch (err) { flash('error', 'Failed to save: ' + err.message); }
  };

  if (loading) return <div style={{ padding: '22px', color: 'var(--text-muted)' }}>Loading users…</div>;

  return (
    <div style={{ padding: '19px', maxWidth: '900px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>User Management</h2>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Create logins and choose exactly what each person can do. Admins can do everything.</p>

      {msg.text && (
        <div style={{ padding: '8px 10px', borderRadius: '6px', marginBottom: '12px', fontSize: '11px', background: msg.type === 'error' ? 'var(--status-a-bg)' : 'var(--status-p-bg)', color: msg.type === 'error' ? 'var(--status-a-text)' : 'var(--status-p-text)', border: `1px solid ${msg.type === 'error' ? 'var(--status-a-text)' : 'var(--status-p-text)'}` }}>{msg.text}</div>
      )}

      <form onSubmit={addUser} style={card}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><UserPlus size={16} /> Add user</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '9px', marginBottom: '10px' }}>
          <div><span style={label}>Full name</span><input style={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div><span style={label}>Username</span><input style={input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" /></div>
          <div><span style={label}>Password</span><input style={input} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" /></div>
          <div><span style={label}>Role</span>
            <select style={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">User (custom permissions)</option>
              <option value="admin">Admin (everything)</option>
            </select>
          </div>
        </div>
        <span style={label}>Permissions</span>
        <PermissionChecks value={form.permissions} disabled={form.role === 'admin'} onChange={(permissions) => setForm({ ...form, permissions })} />
        <div style={{ marginTop: '12px' }}><button type="submit" style={primaryBtn}><UserPlus size={14} /> Create user</button></div>
      </form>

      {users.map((u) => {
        const d = drafts[u.username];
        const role = d?.role ?? u.role;
        const permissions = d?.permissions ?? (Array.isArray(u.permissions) ? u.permissions : DEFAULT_USER_PERMISSIONS);
        const isSelf = u.username === currentUser.username;
        const setDraft = (patch) => setDrafts((p) => ({ ...p, [u.username]: { role, permissions, ...p[u.username], ...patch } }));
        return (
          <div key={u.username} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '9px' }}>
              <div>
                <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{u.fullName}</strong>{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>@{u.username}{isSelf ? ' (you)' : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select style={{ ...input, width: 'auto' }} value={role} onChange={(e) => setDraft({ role: e.target.value })}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="button" style={ghostBtn} onClick={() => resetPassword(u.username)}><KeyRound size={13} /> Reset password</button>
                <button type="button" style={{ ...ghostBtn, color: 'var(--status-a-text)' }} onClick={() => deleteUser(u.username)} disabled={isSelf}><Trash2 size={13} /> Delete</button>
              </div>
            </div>
            <PermissionChecks value={permissions} disabled={role === 'admin'} onChange={(p) => setDraft({ permissions: p })} />
            {d && <div style={{ marginTop: '10px' }}><button type="button" style={primaryBtn} onClick={() => saveAccess(u.username)}><Save size={14} /> Save changes</button></div>}
          </div>
        );
      })}
    </div>
  );
}
