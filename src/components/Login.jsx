import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Added setDoc
import { db } from '../firebase';
import { loadUsers, USERS_STORAGE_KEY } from '../data/users'; // Import the key
import { useTheme } from '../contexts/ThemeContext';

function Login({ onLogin }) {
  const { theme } = useTheme();
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
        // Users exist in Firestore
        users = snap.data().users;
      } else {
        // No users in Firestore! Let's load defaults and SAVE them to Firestore
        users = loadUsers();
        await setDoc(docRef, { users }, { merge: true });
        console.log("Default users saved to Firestore!");
      }

      const user = users.find((u) => u.username === username && u.password === password);
      
      if (user) {
        onLogin({
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          rememberMe: rememberMe,
        });
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Failed to fetch/save users:', err);
      // Fallback for offline mode
      const users = loadUsers();
      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin({
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          rememberMe: rememberMe,
        });
      } else {
        setError('Invalid username or password (Check connection)');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#2b3e50', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Mac OS Window Mockup */}
      <div style={{ width: '100%', maxWidth: '900px', height: '600px', backgroundColor: '#f4f7f6', borderRadius: '12px', overflow: 'hidden', display: 'flex', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
        
        {/* Window Controls */}
        <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', gap: '8px', zIndex: 10 }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f' }}></div>
        </div>

        {/* Left Side: Branding (Hidden on small screens) */}
        <div style={{ flex: 1, backgroundColor: '#ffffff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' }} className="hide-mobile">
          <img src={logoSrc} alt="Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '24px' }} />
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>B. Mashilo Designs</h1>
          <p style={{ fontSize: '13px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Atelier Attendance Register</p>
        </div>

        {/* Right Side: Login Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 60px' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>Welcome Back</h2>
            <p style={{ color: '#888', fontSize: '14px' }}>Please sign in to access your dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>Username</label>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', color: '#333', outline: 'none', backgroundColor: '#f4f7f6', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#0f9d58'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 14px', paddingRight: '40px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', color: '#333', outline: 'none', backgroundColor: '#f4f7f6', transition: 'border-color 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = '#0f9d58'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#0f9d58', cursor: 'pointer', marginRight: '8px' }}
              />
              <label htmlFor="remember" style={{ fontSize: '13px', color: '#666', cursor: 'pointer' }}>Remember this device</label>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500 }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i>
                {error}
              </div>
            )}

            {/* FIXED: Changed </Button> to </button> */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', backgroundColor: '#0f9d58', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background-color 0.2s', marginTop: '10px' }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#0b8043')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#0f9d58')}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', color: '#888' }}>
            <p>© {new Date().getFullYear()} B. Mashilo Designs. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;