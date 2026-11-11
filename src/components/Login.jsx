import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers } from '../data/users';
import { useTheme } from '../contexts/ThemeContext';

function Login({ onLogin }) {
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);
      let users;

      if (snap.exists() && snap.data().users && snap.data().users.length > 0) {
        users = snap.data().users;
      } else {
        users = loadUsers();
        await setDoc(docRef, { users }, { merge: true });
      }

      const user = users.find((u) => String(u.username).trim().toLowerCase() === username.trim().toLowerCase() && u.password === password);
      
      if (user) {
        onLogin({ username: user.username, fullName: user.fullName, role: user.role, permissions: user.permissions, rememberMe: rememberMe });
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Failed to fetch/save users:', err);
      const users = loadUsers();
      const user = users.find((u) => String(u.username).trim().toLowerCase() === username.trim().toLowerCase() && u.password === password);
      if (user) {
        onLogin({ username: user.username, fullName: user.fullName, role: user.role, permissions: user.permissions, rememberMe: rememberMe });
      } else {
        setError('Invalid username or password (Check connection)');
      }
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = () => (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
  );
  const EyeOffIcon = () => (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
  );

  return (
    <div style={{ backgroundColor: 'var(--bg-body)', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '900px', minHeight: '600px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden', display: 'flex', boxShadow: '0 20px 50px var(--shadow-color)', position: 'relative' }}>
        
        <button type="button" onClick={toggleTheme} title="Toggle dark mode" aria-label="Toggle dark mode" style={{ position: 'absolute', top: '10px', right: '14px', zIndex: 10, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', fontSize: '15px' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div style={{ flex: 1, backgroundColor: 'var(--bg-header)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' }} className="hide-mobile">
          <img src={logoSrc} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '24px' }} />
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Attendance Register</p>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 60px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Welcome Back</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Please sign in to access your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Username</label>
              <input type="text" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px 14px', paddingRight: '40px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', outline: 'none' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green-text)', cursor: 'pointer', marginRight: '8px' }} />
              <label htmlFor="remember" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>Remember this device</label>
            </div>

            {error && <div style={{ backgroundColor: 'var(--accent-red)', color: 'var(--accent-red-text)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--accent-green-text)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '10px' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            <p>© {new Date().getFullYear()} B. Mashilo Designs. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;