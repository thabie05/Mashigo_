import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css'; // make sure variables are in here

// One-time migration of saved browser data from the old key names
try {
  ['users', 'theme', 'current_user'].forEach((k) => {
    const old = localStorage.getItem(`mtworld_${k}`);
    if (old !== null && localStorage.getItem(`mashigo_${k}`) === null) {
      localStorage.setItem(`mashigo_${k}`, old);
    }
    localStorage.removeItem(`mtworld_${k}`);
  });
} catch { /* storage unavailable */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
