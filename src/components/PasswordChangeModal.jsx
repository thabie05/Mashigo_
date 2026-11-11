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

  // Toggles to show/hide passwords
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);
      
      // Load current users from Firestore, or fallback to local
      let users = snap.exists() && snap.data().users ? snap.data().users : loadUsers();

      const userIndex = users.findIndex((u) => u.username === currentUser.username);
      if (userIndex === -1) {
        setError('User not found.');
        setSaving(false);
        return;
      }
      
      if (users[userIndex].password !== currentPassword) {
        setError('Current password is incorrect.');
        setSaving(false);
        return;
      }

      // Update the password in the array
      users[userIndex].password = newPassword;

      // 1. Save to LocalStorage as a fallback
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

      // 2. Save to Firebase Firestore
      await setDoc(docRef, { users }, { merge: true });

      setSuccess('Password changed successfully!');
      
      // Wait a moment so the user sees the success message, then close
      setTimeout(() => {
        onPasswordChanged();
        onClose();
      }, 1500);
      
    } catch (err) {
      console.error('Failed to change password:', err);
      setError('Failed to save to database. Check your connection or Firestore rules.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for input styling
  const inputStyle = {
    width: '100%', padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', 
    fontSize: '14px', color: '#333', outline: 'none', backgroundColor: '#f4f7f6', 
    transition: 'border-color 0.2s', marginBottom: '16px'
  };

  const eyeButtonStyle = {
    position: 'absolute', right: '12px', top: '14px', 
    background: 'none', border: 'none', color: '#888', cursor: 'pointer'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }} onClick={onClose}>
      
      <div 
        style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #e0e0e0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#333', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <i className="fa-solid fa-lock" style={{ color: '#0f9d58' }}></i> Change Password
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#888', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e0e0e0' }}>
          Logged in as: <strong style={{ color: '#333' }}>{currentUser.fullName}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          
          {/* Current Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#0f9d58'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={eyeButtonStyle}>
                <i className={`fa-regular ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password (min 4 chars)"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#0f9d58'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <button type="button" onClick={() => setShowNew(!showNew)} style={eyeButtonStyle}>
                <i className={`fa-regular ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#0f9d58'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeButtonStyle}>
                <i className={`fa-regular ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Error / Success Messages */}
          {error && (
            <div style={{ backgroundColor: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i> {error}
            </div>
          )}
          {success && (
            <div style={{ backgroundColor: '#d1f2e5', color: '#0f9d58', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '8px' }}></i> {success}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1, padding: '12px', backgroundColor: '#f0f0f0', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', fontWeight: 600, color: '#666', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => !saving && (e.target.style.backgroundColor = '#e0e0e0')}
              onMouseLeave={(e) => !saving && (e.target.style.backgroundColor = '#f0f0f0')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 1, padding: '12px', backgroundColor: '#0f9d58', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'background-color 0.2s' }}
              onMouseEnter={(e) => !saving && (e.target.style.backgroundColor = '#0b8043')}
              onMouseLeave={(e) => !saving && (e.target.style.backgroundColor = '#0f9d58')}
            >
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordChangeModal;