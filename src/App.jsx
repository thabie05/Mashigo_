import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AttendanceRegister from './components/AttendanceRegister';
import FingerprintKiosk from './components/FingerprintKiosk';

function App() {
  // 1. Read storage immediately
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedLocal = localStorage.getItem('mtworld_current_user');
      const savedSession = sessionStorage.getItem('mtworld_current_user');
      
      console.log("🔍 Checking Storage on Load:");
      console.log("Local Storage:", savedLocal);
      console.log("Session Storage:", savedSession);

      if (savedLocal) {
        return JSON.parse(savedLocal);
      }
      if (savedSession) {
        return JSON.parse(savedSession);
      }
    } catch (e) {
      console.error("Failed to parse user session:", e);
    }
    return null;
  });

  // Failsafe: If state is null but storage exists, force login
  useEffect(() => {
    if (!currentUser) {
      const savedLocal = localStorage.getItem('mtworld_current_user');
      const savedSession = sessionStorage.getItem('mtworld_current_user');
      if (savedLocal) setCurrentUser(JSON.parse(savedLocal));
      else if (savedSession) setCurrentUser(JSON.parse(savedSession));
    }
  }, [currentUser]);

  const [params] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      kiosk: searchParams.get('kiosk') === '1',
      board: searchParams.get('board') === '1',
    };
  });

  if (params.kiosk) return <FingerprintKiosk />;
  if (params.board) {
    window.location.href = window.location.pathname;
    return null;
  }

  const handleLogin = (user) => {
    console.log("✅ Login successful. Saving user:", user);
    
    // Ensure the user object has the required fields
    const safeUser = {
      username: user.username || 'user',
      fullName: user.fullName || user.username || 'User',
      role: user.role || 'user',
      rememberMe: user.rememberMe || false
    };

    setCurrentUser(safeUser);
    
    // Save to BOTH storages just to be absolutely sure
    localStorage.setItem('mtworld_current_user', JSON.stringify(safeUser));
    sessionStorage.setItem('mtworld_current_user', JSON.stringify(safeUser));
  };

  const handleLogout = () => {
    console.log("🚪 Logging out. Clearing storage.");
    setCurrentUser(null);
    localStorage.removeItem('mtworld_current_user');
    sessionStorage.removeItem('mtworld_current_user');
  };

  return currentUser ? (
    <AttendanceRegister 
      currentUser={currentUser} 
      onLogout={handleLogout} 
      onPasswordChanged={() => {}} 
    />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;