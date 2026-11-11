import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers, USERS_STORAGE_KEY } from '../data/users';

function PasswordChangeModal({ currentUser, onClose, onPasswordChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (newPassword.length < 4) { setError('New password must be at least 4 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }

    setSaving(true);
    try {
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);
      let users = snap.exists() && snap.data().users ? snap.data().users : loadUsers();
      const userIndex = users.findIndex((u) => u.username === currentUser.username);
      
      if (userIndex === -1) { setError('User not found.'); setSaving(false); return; }
      if (users[userIndex].password !== currentPassword) { setError('Current password is incorrect.'); setSaving(false); return; }

      users[userIndex].password = newPassword;
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      await setDoc(docRef, { users }, { merge: true });
      setSuccess('Password changed successfully!');
      setTimeout(() => { onPasswordChanged(); onClose(); }, 1500);
    } catch (err) { setError('Failed to save to database.'); }
    finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', outline: 'none', marginBottom: '16px' };
  const eyeButtonStyle = { position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 50px var(--shadow-color)', border: '1px solid var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>🔒 Change Password</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', color: 'var(--text-muted)', cursor: 'pointer' }}>&times;</button>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>Logged in as: <strong style={{ color: 'var(--text-main)' }}>{currentUser.fullName}</strong></p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Current Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password" style={inputStyle} />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={eyeButtonStyle}><i className={`fa-regular ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
          </div>

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Enter new password (min 4 chars)" style={inputStyle} />
            <button type="button" onClick={() => setShowNew(!showNew)} style={eyeButtonStyle}><i className={`fa-regular ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
          </div>

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Confirm New Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" style={inputStyle} />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeButtonStyle}><i className={`fa-regular ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
          </div>

          {error && <div style={{ backgroundColor: 'var(--accent-red)', color: 'var(--accent-red-text)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>{error}</div>}
          {success && <div style={{ backgroundColor: 'var(--accent-green)', color: 'var(--accent-green-text)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>{success}</div>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} disabled={saving} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--accent-green-text)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordChangeModal;