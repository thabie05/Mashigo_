import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { doc, collection, onSnapshot, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { recordFingerprintAction } from '../utils/attendanceWrites';
import EnrollFingerprintModal from './EnrollFingerprintModal';

const MATCHER_API = 'http://127.0.0.1:4000';
const RESULT_DISPLAY_MS = 4000;
const STRICT_MODE_TEARDOWN_DELAY_MS = 300;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function AnalogClock({ now }) {
  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;

  const secDeg = seconds * 6;
  const minDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;

  const ticks = Array.from({ length: 12 }, (_, i) => i);

  return (
    <svg viewBox="0 0 200 200" style={{ width: '160px', height: '160px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.05))' }}>
      {/* Clock Face */}
      <circle cx="100" cy="100" r="96" fill="var(--bg-card)" stroke="var(--border-color)" strokeWidth="2" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border-color)" strokeWidth="1" />
      
      {/* Ticks */}
      {ticks.map((i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const isQuarter = i % 3 === 0;
        const r1 = isQuarter ? 74 : 80;
        const r2 = 86;
        const x1 = 100 + r1 * Math.sin(angle);
        const y1 = 100 - r1 * Math.cos(angle);
        const x2 = 100 + r2 * Math.sin(angle);
        const y2 = 100 - r2 * Math.cos(angle);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isQuarter ? 'var(--accent-green-text)' : 'var(--text-muted)'}
            strokeWidth={isQuarter ? 3 : 1.5}
            strokeLinecap="round"
          />
        );
      })}

      {/* Hour Hand */}
      <line x1="100" y1="100" x2="100" y2="58" stroke="var(--text-main)" strokeWidth="5" strokeLinecap="round" style={{ transformOrigin: '100px 100px', transform: `rotate(${hourDeg}deg)` }} />
      
      {/* Minute Hand */}
      <line x1="100" y1="100" x2="100" y2="38" stroke="var(--text-main)" strokeWidth="3.5" strokeLinecap="round" style={{ transformOrigin: '100px 100px', transform: `rotate(${minDeg}deg)` }} />
      
      {/* Second Hand */}
      <line x1="100" y1="106" x2="100" y2="30" stroke="var(--status-a-text)" strokeWidth="1.5" strokeLinecap="round" style={{ transformOrigin: '100px 100px', transform: `rotate(${secDeg}deg)` }} />
      
      {/* Center Dot */}
      <circle cx="100" cy="100" r="4.5" fill="var(--accent-green-text)" />
    </svg>
  );
}

function FingerprintKiosk() {
  const [status, setStatus] = useState('init');
  const [message, setMessage] = useState('Starting fingerprint reader…');
  const [matchedEmployee, setMatchedEmployee] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [now, setNow] = useState(new Date());
  const [stampPulse, setStampPulse] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [timeLogs, setTimeLogs] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [todayLogs, setTodayLogs] = useState([]);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [enrollingNewEmployee, setEnrollingNewEmployee] = useState(null);

  const sdkRef = useRef(null);
  const teardownTimerRef = useRef(null);
  const employeesRef = useRef(employees);
  const selectedActionRef = useRef(null);

  useEffect(() => { employeesRef.current = employees; }, [employees]);
  useEffect(() => { selectedActionRef.current = selectedAction; }, [selectedAction]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time listener for employees, timeLogs, and today's logs
  useEffect(() => {
    const docRef = doc(db, 'rollcall', 'data');
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const activeEmployees = (data.employees || []).filter((emp) => !emp.isDeleted);
        setEmployees(activeEmployees);
        setTimeLogs(data.timeLogs || {});

        const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        const employeeMap = {};
        activeEmployees.forEach((emp) => { employeeMap[emp.id] = emp.name; });

        const timeLogsData = data.timeLogs || {};
        const logs = [];
        for (const key of Object.keys(timeLogsData)) {
          if (!key.endsWith(todayKey)) continue;
          const entry = timeLogsData[key];
          const employeeId = key.split('-')[0];
          const employeeName = employeeMap[employeeId] || 'Unknown';
          logs.push({
            employeeId,
            employeeName,
            clockIn: entry.clockIn ? new Date(entry.clockIn) : null,
            clockOut: entry.clockOut ? new Date(entry.clockOut) : null,
          });
        }
        logs.sort((a, b) => (a.clockIn || 0) - (b.clockIn || 0) || a.employeeName.localeCompare(b.employeeName));
        setTodayLogs(logs);
      },
      (err) => console.error('Failed to listen to data:', err)
    );
    return () => unsubscribe();
  }, []);

  // Firestore fingerprint sync
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'fingerprints'),
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.employeeId || !Array.isArray(data.templates) || data.templates.length === 0) return;
          fetch(`${MATCHER_API}/load-templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: data.employeeId, templates: data.templates }),
          }).catch((err) => console.error(`Failed to sync templates for ${data.employeeId} to matcher:`, err));
        });
      },
      (err) => console.error('Failed to listen to fingerprints collection:', err)
    );
    return () => unsubscribe();
  }, []);

  const resetToSelection = () => {
    setStatus('ready');
    setMessage('Select your action, then scan your finger.');
    setMatchedEmployee(null);
    setSelectedAction(null);
  };

  const handleQuickAdd = async () => {
    const name = newEmployeeName.trim();
    if (!name) { setAdminError('Enter the new employee name'); return; }

    // Check the password against the real admin account instead of a hard-coded string
    let isAdmin = false;
    try {
      const credSnap = await getDoc(doc(db, 'users', 'credentials'));
      const users = credSnap.exists() ? credSnap.data().users || [] : [];
      isAdmin = users.some((u) => u.role === 'admin' && u.password === adminPassword);
    } catch (err) {
      console.error('Could not verify admin password:', err);
      setAdminError('Could not verify password. Check connection.');
      return;
    }
    if (!isAdmin) {
      setAdminError('Incorrect password');
      return;
    }
    const newEmp = { id: Date.now().toString(), name, isDeleted: false };
    const docRef = doc(db, 'rollcall', 'data');
    const snap = await getDoc(docRef);
    const currentEmployees = snap.exists() ? snap.data().employees || [] : [];
    const nowD = new Date();
    const log = { id: Date.now() + Math.floor(Math.random() * 1000), type: 'employee', employeeId: newEmp.id, employeeName: newEmp.name, day: nowD.getDate(), date: `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`, status: 'Employee Added', note: 'Added from kiosk', editor: 'Kiosk (admin password)', editedAt: nowD.toISOString() };
    await updateDoc(docRef, { employees: [...currentEmployees, newEmp], history: arrayUnion(log) });
    setEnrollingNewEmployee(newEmp);
    setShowAdminLogin(false);
    setAdminPassword('');
    setAdminError('');
    setNewEmployeeName('');
  };

  const handleSample = useCallback(async (event) => {
    const action = selectedActionRef.current;
    if (!action) {
      setMessage('Please select Start Shift or End Shift first.');
      return;
    }

    setStatus('scanning');
    setMessage('Checking fingerprint…');
    try {
      const parsed = typeof event.samples === 'string' ? JSON.parse(event.samples) : event.samples;
      const rawSample = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!rawSample) throw new Error('No sample data received from reader.');

      const imageBase64 = window.Fingerprint.b64UrlTo64(rawSample);

      const res = await fetch(`${MATCHER_API}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const result = await res.json();

      if (result.matched) {
        const employee = employeesRef.current.find((e) => e.id === result.employeeId);
        if (!employee) {
          setStatus('no-match');
          setMessage('Fingerprint matched an employee ID that no longer exists. Ask an admin to re-enroll.');
          setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
        } else {
          setMatchedEmployee(employee);
          const clockResult = await recordFingerprintAction(employee, action);
          setStampPulse(true);
          setTimeout(() => setStampPulse(false), 500);
          
          if (clockResult.error) {
            setStatus('no-match');
            setMessage(`${employee.name}: ${clockResult.error}`);
            setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
          } else {
            setStatus('matched');
            if (clockResult.action === 'clock-in') {
              setMessage(`Clocked IN at ${clockResult.time.toLocaleTimeString()}`);
            } else {
              setMessage(`Clocked OUT at ${clockResult.time.toLocaleTimeString()}`);
            }
            setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
          }
        }
      } else {
        setStatus('no-match');
        setMessage('Fingerprint not recognized. Try again.');
        setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
      }
    } catch (err) {
      console.error('Fingerprint identify failed:', err);
      setStatus('error');
      setMessage('Could not reach the fingerprint matching service. Try again.');
      setTimeout(() => resetToSelection(), RESULT_DISPLAY_MS);
    }
  }, []);

  // SDK initialization
  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

    if (enrollingNewEmployee) {
      if (sdkRef.current) {
        try { sdkRef.current.stopAcquisition(); } catch (e) {}
        sdkRef.current = null;
      }
      setStatus('enrolling');
      setMessage('Enrollment in progress…');
      return;
    }

    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    const initializeSDK = () => {
      if (!mounted) return;
      if (!sdkRef.current) {
        if (!window.Fingerprint || !window.Fingerprint.WebApi) {
          setStatus('error');
          setMessage('Fingerprint SDK script did not load. Retrying in 1 second...');
          retryTimeout = setTimeout(() => { if (mounted) initializeSDK(); }, 1000);
          return;
        }

        const sdk = new window.Fingerprint.WebApi();
        sdkRef.current = sdk;

        sdk.onDeviceConnected = () => { if (mounted) { setStatus('ready'); setMessage('Select your action, then scan your finger.'); } };
        sdk.onDeviceDisconnected = () => { if (mounted) { setStatus('error'); setMessage('Fingerprint scanner disconnected. Check the USB cable.'); } };
        sdk.onCommunicationFailed = () => { if (mounted) { setStatus('error'); setMessage('Cannot reach the DigitalPersona agent on this PC.'); } };
        sdk.onErrorOccurred = (event) => { if (mounted) { setStatus('error'); setMessage(`Reader error: ${event.error || 'unknown error'}`); } };
        sdk.onSamplesAcquired = handleSample;

        sdk.startAcquisition(window.Fingerprint.SampleFormat.PngImage).then(
          () => { if (mounted) { setStatus('ready'); setMessage('Select your action, then scan your finger.'); } },
          (error) => {
            console.error('Failed to start fingerprint acquisition:', error);
            sdkRef.current = null;
            if (mounted) { setStatus('error'); setMessage('Cannot connect to the fingerprint reader. Make sure the DigitalPersona Lite Client is running.'); }
          }
        );
      } else {
        setStatus('ready');
        setMessage('Select your action, then scan your finger.');
      }
    };

    initializeSDK();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      teardownTimerRef.current = setTimeout(() => {
        if (sdkRef.current) {
          try { sdkRef.current.stopAcquisition(); } catch (e) {}
          sdkRef.current = null;
        }
        teardownTimerRef.current = null;
      }, STRICT_MODE_TEARDOWN_DELAY_MS);
    };
  }, [handleSample, enrollingNewEmployee]);

  const goHome = () => { window.location.href = window.location.origin + window.location.pathname; };
  const canPickAction = status === 'ready' || status === 'no-match';

  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Determine colors based on status
  let fingerprintColor = 'var(--accent-green-text)'; 
  if (status === 'scanning') fingerprintColor = 'var(--accent-yellow-text)'; 
  if (status === 'matched') fingerprintColor = 'var(--accent-green-text)'; 
  if (status === 'no-match' || status === 'error') fingerprintColor = 'var(--accent-red-text)'; 

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      
      <style>{`
        @keyframes stampPunch { 0% { transform: scale(1); } 30% { transform: scale(0.9); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
        @keyframes ticketSlideIn { 0% { transform: translateY(16px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes idlePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .stamp-active { animation: stampPunch 0.5s ease-out; }
        .ticket-stub { animation: ticketSlideIn 0.35s ease-out; }
        .fingerprint-pulse { animation: idlePulse 2s ease-in-out infinite; }
      `}</style>

      {/* Top Navigation */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '10px', zIndex: 10 }}>
        <button onClick={goHome} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px var(--shadow-color)' }}>
          <ArrowLeft size={16} className="inline-block align-middle shrink-0" /> Home
        </button>
        <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px var(--shadow-color)' }}>
          <Clock size={16} className="inline-block align-middle shrink-0" /> {showHistory ? 'Hide History' : "Today's History"}
        </button>
      </div>

      <div style={{ position: 'absolute', top: '24px', right: '24px', textAlign: 'right', zIndex: 10 }}>
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>{dateLabel}</p>
      </div>

      {/* Main Kiosk Layout */}
      <div style={{ display: 'flex', width: '100%', maxWidth: '900px', alignItems: 'flex-start', justifyContent: 'center', marginTop: '40px', gap: '40px' }}>
        
        {/* Left Side: Clock & Fingerprint */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent-green-text)', fontWeight: 700, marginBottom: '4px' }}>B. MASHILO DESIGNS</p>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-main)' }}>Attendance Register</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
            <AnalogClock now={now} />
            <p style={{ marginTop: '16px', fontSize: '24px', letterSpacing: '2px', color: 'var(--text-main)', fontWeight: 600 }}>{timeLabel}</p>
          </div>

          {/* Fingerprint Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <div style={{ 
              width: '120px', height: '120px', borderRadius: '50%', 
              backgroundColor: 'var(--bg-card)', border: `3px solid ${fingerprintColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 20px color-mix(in srgb, ${fingerprintColor} 25%, transparent)`,
              transition: 'all 0.3s ease',
              padding: '20px'
            }} className={status === 'scanning' ? 'fingerprint-pulse' : ''}>
              <img src="/fingerprint-icon.png" alt="Fingerprint" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `drop-shadow(0 0 4px ${fingerprintColor})` }} />
            </div>
          </div>

          {/* Action Area */}
          <div style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '380px' }}>
            
            {status === 'matched' || status === 'no-match' || status === 'error' ? (
              <div className={`ticket-stub ${stampPulse ? 'stamp-active' : ''}`} style={{ 
                background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', width: '100%', 
                boxShadow: '0 4px 12px var(--shadow-color)', textAlign: 'center', position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `repeating-linear-gradient(90deg, transparent, transparent 6px, var(--bg-body) 6px, var(--bg-body) 8px)` }}></div>
                
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                  {status === 'matched' ? (selectedAction === 'start' || message.includes('IN') ? 'Clock-In Ticket' : 'Clock-Out Ticket') : 'Not Recorded'}
                </p>
                
                {matchedEmployee && <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{matchedEmployee.name}</p>}
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{message}</p>

                {matchedEmployee && (() => {
                  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
                  const log = timeLogs[`${matchedEmployee.id}-${todayKey}`];
                  if (log?.clockIn && !log?.clockOut) return <p style={{ fontSize: '13px', color: 'var(--accent-yellow-text)', marginTop: '10px', fontWeight: 600 }}>⏳ Currently Clocked In</p>;
                  if (log?.clockIn && log?.clockOut) return <p style={{ fontSize: '13px', color: 'var(--accent-green-text)', marginTop: '10px', fontWeight: 600 }}>✅ Clocked Out</p>;
                  return null;
                })()}
              </div>
            ) : canPickAction ? (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px', fontWeight: 500 }}>{message}</p>
                {!selectedAction ? (
                  <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button onClick={() => { setSelectedAction('start'); setMessage('Scan your finger to start your shift.'); }}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--status-p-bg)', color: 'var(--status-p-text)', border: '1px solid var(--status-p-text)', padding: '16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '24px' }}>🟢</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Start Shift</span>
                    </button>
                    <button onClick={() => { setSelectedAction('end'); setMessage('Scan your finger to end your shift.'); }}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'var(--status-a-bg)', color: 'var(--status-a-text)', border: '1px solid var(--status-a-text)', padding: '16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '24px' }}>🔴</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>End Shift</span>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setSelectedAction(null); setMessage('Select your action, then scan your finger.'); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '14px', cursor: 'pointer', padding: '8px' }}>
                    Cancel Selection
                  </button>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>{message}</p>
            )}

            {/* Admin Fallback */}
            {(status === 'no-match' || status === 'error') && !showAdminLogin && !enrollingNewEmployee && (
              <button onClick={() => setShowAdminLogin(true)} style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--accent-blue-text)', textDecoration: 'underline', fontSize: '13px', cursor: 'pointer' }}>
                Admin: Enroll New Employee
              </button>
            )}

            {showAdminLogin && (
              <div style={{ marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', width: '100%', boxShadow: '0 4px 12px var(--shadow-color)' }}>
                <input type="password" placeholder="Admin password" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '13px', marginBottom: '8px', outline: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
                <input type="text" placeholder="New employee name" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '13px', marginBottom: '12px', outline: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleQuickAdd} style={{ flex: 1, background: 'var(--accent-green-text)', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Create & Enroll</button>
                  <button onClick={() => setShowAdminLogin(false)} style={{ flex: 1, background: 'var(--bg-hover)', color: 'var(--text-main)', border: 'none', padding: '8px', borderRadius: '4px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                </div>
                {adminError && <p style={{ color: 'var(--status-a-text)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>{adminError}</p>}
              </div>
            )}

          </div>
        </div>

        {/* Right Side: History Panel */}
        {showHistory && (
          <div style={{ width: '300px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', boxShadow: '0 4px 12px var(--shadow-color)', animation: 'ticketSlideIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Clock History</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--text-muted)', cursor: 'pointer' }}>&times;</button>
            </div>
            
            {todayLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No clock events today.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todayLogs.map((log, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.employeeName}</span>
                    <div style={{ display: 'flex', gap: '12px', flexShrink: 0, fontWeight: 600 }}>
                      <span style={{ color: 'var(--status-p-text)', width: '50px', textAlign: 'right' }}>{log.clockIn ? log.clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span style={{ color: 'var(--status-a-text)', width: '50px', textAlign: 'right' }}>{log.clockOut ? log.clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {enrollingNewEmployee && (
        <EnrollFingerprintModal employee={enrollingNewEmployee} onClose={() => setEnrollingNewEmployee(null)} />
      )}
    </div>
  );
}

export default FingerprintKiosk;