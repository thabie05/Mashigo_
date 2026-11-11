import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, deleteField, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getSAHolidays } from '../utils/holidays';
import { useTheme } from '../contexts/ThemeContext';
import PasswordChangeModal from './PasswordChangeModal';
import EmployeeReportModal from './EmployeeReportModal';
import ConfirmModal from './ConfirmModal';
import { closeStaleShifts } from '../utils/attendanceWrites';

import HistoryPage from './HistoryPage';
import EmailReportsPage from './EmailReportsPage';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png';

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [activePage, setActivePage] = useState('register');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Add Employee State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [addError, setAddError] = useState('');

  // Popups & Modals
  const [popup, setPopup] = useState(null);
  const [popupNote, setPopupNote] = useState('');
  const [employeeActionPopup, setEmployeeActionPopup] = useState(null); 
  const [confirmModal, setConfirmModal] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('register');

  const popupRef = useRef(null);
  const employeePopupRef = useRef(null);
  const closedStaleShiftsRef = useRef(false);

  // ---------- Firestore Listener ----------
  useEffect(() => {
    const docRef = doc(db, 'rollcall', 'data');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const savedAttendance = data.attendance || {};
        const convertedAttendance = {};
        for (const empId in savedAttendance) {
          convertedAttendance[empId] = {};
          for (const dateKey in savedAttendance[empId]) {
            const value = savedAttendance[empId][dateKey];
            if (value === true) convertedAttendance[empId][dateKey] = 'present';
            else if (value === false) convertedAttendance[empId][dateKey] = 'absent';
            else convertedAttendance[empId][dateKey] = value;
          }
        }
        setEmployees(data.employees || []);
        setAttendance(convertedAttendance);
        setEdits(data.edits || {});
        setHistory(data.history || []);
        setNotes(data.notes || {});

        if (!closedStaleShiftsRef.current) {
          closedStaleShiftsRef.current = true;
          closeStaleShifts().catch((err) => console.error('Failed to close stale shifts:', err));
        }
      } else {
        // Create initial document if it doesn't exist
        setDoc(docRef, {
          employees: [],
          attendance: {},
          edits: {},
          history: [],
          notes: {},
        }).catch(err => console.error("Error creating initial document:", err));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Close popups on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setPopup(null);
      setPopupNote('');

      if (employeePopupRef.current && employeePopupRef.current.contains(e.target)) return;
      setEmployeeActionPopup(null);
    };
    if (popup || employeeActionPopup) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup, employeeActionPopup]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(prev => prev - 1); }
    else setCurrentMonth(prev => prev - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(prev => prev + 1); }
    else setCurrentMonth(prev => prev + 1);
  };

  const getDateKey = (day) => `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  const getStatus = (employeeId, day) => attendance[employeeId]?.[getDateKey(day)] || null;
  
  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter((key) => 
      key.startsWith(monthPrefix) && ['present', 'late', 'early'].includes(empAttendance[key])
    ).length;
  };

  const getWeekday = (day) => {
    return WEEKDAYS[new Date(currentYear, currentMonth, day).getDay()];
  };

  // ---------- Highlighting Logic ----------
  const isWeekend = (day) => {
    const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const getHolidayName = (day) => {
    const dateKey = getDateKey(day);
    const holiday = getSAHolidays(currentYear).find((h) => h.date === dateKey);
    return holiday ? holiday.name : null;
  };

  // ---------- Report Generation Logic ----------
  const getEmployeeReport = (empId) => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(currentYear, m + 1, 0).getDate();
      let present = 0, absent = 0, late = 0, early = 0, off = 0, weekend = 0, holiday = 0, unmarked = 0;
      for (let d = 1; d <= daysInM; d++) {
        const dateKey = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(currentYear, m, d);
        const dow = date.getDay();
        const isH = getSAHolidays(currentYear).some((h) => h.date === dateKey);
        
        if (dow === 0 || dow === 6) weekend++;
        else if (isH) holiday++;
        else if (attendance[empId]?.[dateKey] === 'present') present++;
        else if (attendance[empId]?.[dateKey] === 'late') late++;
        else if (attendance[empId]?.[dateKey] === 'early') early++;
        else if (attendance[empId]?.[dateKey] === 'off') off++;
        else if (attendance[empId]?.[dateKey] === 'absent') absent++;
        else unmarked++;
      }
      months.push({ month: MONTHS[m], Present: present, Late: late, Early: early, Absent: absent, OffDuty: off, Weekend: weekend, Holiday: holiday, Unmarked: unmarked });
    }
    return months;
  };

  // ---------- Employee Management ----------
  const addEmployee = async () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    
    const isDuplicate = employees.some((emp) => emp.name.toLowerCase() === name.toLowerCase() && !emp.isDeleted);
    if (isDuplicate) { 
      setAddError('This employee already exists!'); 
      setTimeout(() => setAddError(''), 3000); 
      return; 
    }
    
    setAddError('');
    const newEmployee = { id: Date.now().toString(), name, isDeleted: false };
    const updatedEmployees = [...employees, newEmployee];
    
    setEmployees(updatedEmployees);
    setNewEmployeeName('');
    setShowAddForm(false);
    
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) { 
      console.error('Failed to save new employee:', err); 
      setAddError('Failed to save to database: ' + err.message);
    }
  };

  const handleRenameEmployee = async (emp) => {
    setEmployeeActionPopup(null);
    const newName = window.prompt(`Rename "${emp.name}" to:`, emp.name);
    if (!newName || newName.trim() === '' || newName === emp.name) return;

    const isDuplicate = employees.some((e) => e.id !== emp.id && e.name.toLowerCase() === newName.toLowerCase() && !e.isDeleted);
    if (isDuplicate) return alert('An employee with this name already exists!');

    const updatedEmployees = employees.map(e => e.id === emp.id ? { ...e, name: newName.trim() } : e);
    setEmployees(updatedEmployees);
    
    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, { employees: updatedEmployees });
    } catch (err) {
      console.error('Failed to rename employee:', err);
      alert('Failed to rename: ' + err.message);
    }
  };

  const handleDeleteEmployee = (emp) => {
    setEmployeeActionPopup(null);
    setConfirmModal({
      message: `Are you sure you want to delete ${emp.name}? They will be moved to the trash.`,
      onConfirm: async () => {
        const updatedEmployees = employees.map(e => e.id === emp.id ? { ...e, isDeleted: true } : e);
        setEmployees(updatedEmployees);
        setConfirmModal(null);
        try {
          const docRef = doc(db, 'rollcall', 'data');
          await updateDoc(docRef, { employees: updatedEmployees });
        } catch (err) {
          console.error('Failed to delete employee:', err);
          alert('Failed to delete: ' + err.message);
        }
      }
    });
  };

  // ---------- Attendance Logic ----------
  const markAttendance = async (employeeId, day, status, noteText = '') => {
    const dateKey = getDateKey(day);
    const currentEditVal = edits[`${employeeId}-${dateKey}`];
    const currentCount = typeof currentEditVal === 'number' ? currentEditVal : currentEditVal ? 1 : 0;
    const newCount = currentCount + 1;
    const trimmedNote = noteText.trim();
    const employee = employees.find((emp) => emp.id === employeeId);
    const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : status === 'early' ? 'Early' : 'Off Duty';

    // Safety check for undefined editor
    const editorName = currentUser?.fullName || currentUser?.username || 'System';

    const historyEntry = {
      id: Date.now(), 
      employeeId, 
      employeeName: employee?.name || 'Unknown', 
      day, 
      date: dateKey,
      status: statusLabel, 
      note: trimmedNote || '', 
      editor: editorName, 
      editedAt: new Date().toISOString(),
    };

    setEdits(prev => ({ ...prev, [`${employeeId}-${dateKey}`]: newCount }));
    setAttendance(prev => ({
      ...prev,
      [employeeId]: { ...(prev[employeeId] || {}), [dateKey]: status }
    }));
    if (trimmedNote) setNotes(prev => ({ ...prev, [`${employeeId}-${dateKey}`]: trimmedNote }));
    setHistory(prev => [historyEntry, ...prev]);
    setPopup(null);
    setPopupNote('');

    try {
      const docRef = doc(db, 'rollcall', 'data');
      const updates = {
        [`attendance.${employeeId}.${dateKey}`]: status,
        [`edits.${employeeId}-${dateKey}`]: newCount,
        history: arrayUnion(historyEntry),
      };
      if (trimmedNote) updates[`notes.${employeeId}-${dateKey}`] = trimmedNote;
      await updateDoc(docRef, updates);
    } catch (err) { 
      console.error('Failed to save attendance mark:', err);
      alert('Failed to save to database: ' + err.message);
    }
  };

  const clearAttendance = async (employeeId, day) => {
    const dateKey = getDateKey(day);
    const employee = employees.find((emp) => emp.id === employeeId);
    const editorName = currentUser?.fullName || currentUser?.username || 'System';
    
    const historyEntry = {
      id: Date.now(), 
      employeeId, 
      employeeName: employee?.name || 'Unknown', 
      day, 
      date: dateKey,
      status: 'Cleared', 
      note: '', 
      editor: editorName, 
      editedAt: new Date().toISOString(),
    };

    setAttendance(prev => {
      const updated = { ...prev };
      if (updated[employeeId]) delete updated[employeeId][dateKey];
      return updated;
    });
    setNotes(prev => { const u = { ...prev }; delete u[`${employeeId}-${dateKey}`]; return u; });
    setEdits(prev => { const u = { ...prev }; delete u[`${employeeId}-${dateKey}`]; return u; });
    setHistory(prev => [historyEntry, ...prev]);
    setPopup(null);
    setPopupNote('');

    try {
      const docRef = doc(db, 'rollcall', 'data');
      await updateDoc(docRef, {
        [`attendance.${employeeId}.${dateKey}`]: deleteField(),
        [`notes.${employeeId}-${dateKey}`]: deleteField(),
        [`edits.${employeeId}-${dateKey}`]: deleteField(),
        history: arrayUnion(historyEntry),
      });
    } catch (err) { 
      console.error('Failed to save after clear:', err); 
      alert('Failed to clear mark: ' + err.message);
    }
  };

  const openPopup = (e, employeeId, day) => {
    e.stopPropagation();
    setPopupNote(notes[`${employeeId}-${getDateKey(day)}`] || '');
    const rect = e.currentTarget.getBoundingClientRect();
    
    let x = rect.left + window.scrollX;
    let y = rect.bottom + window.scrollY;
    if (x + 200 > window.innerWidth) x = x - 150; 

    setPopup({ employeeId, day, x, y });
  };

  const handleClearConfirm = (employeeId, day) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    setPopup(null);
    setConfirmModal({
      message: `Clear the attendance mark for ${employee?.name} on day ${day}?`,
      onConfirm: () => { clearAttendance(employeeId, day); setConfirmModal(null); }
    });
  };

  const activeRoster = employees.filter(emp => !emp.isDeleted && emp.name.toLowerCase().includes(searchQuery.toLowerCase()));
  
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#2b3e50', color: '#fff' }}>
      Loading register…
    </div>
  );

  return (
    <div className="app-wrapper">
      <div className="app-container">
        {isMobileMenuOpen && (
          <div className="sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

        <div className="window-controls">
          <div className="dot red"></div>
          <div className="dot yellow"></div>
          <div className="dot green"></div>
        </div>

        <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="logo-area">
            <img src={logoSrc} alt="School Logo" style={{ height: '32px', objectFit: 'contain' }} />
          </div>
          
          <ul className="nav-menu">
            <li className="nav-section">Overview</li>
            <a href="#" className="nav-item"><i className="fa-solid fa-gauge"></i> Dashboard</a>
            <a href="#" className={`nav-item ${activePage === 'register' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('register'); setIsMobileMenuOpen(false); }}>
              <i className="fa-solid fa-chalkboard-user"></i> Class Register
            </a>
            
            <li className="nav-section">Marking</li>
            <a href="#" className="nav-item"><i className="fa-solid fa-clipboard-list"></i> Today</a>
            <a href="#" className="nav-item"><i className="fa-solid fa-clock-rotate-left"></i> Past Days</a>
            
            <li className="nav-section">Actions</li>
            <a href="#" className={`nav-item ${activePage === 'history' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('history'); setIsMobileMenuOpen(false); }}>
              <i className="fa-solid fa-list"></i> Edit History
            </a>
            <a href="#" className={`nav-item ${activePage === 'email' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActivePage('email'); setIsMobileMenuOpen(false); }}>
              <i className="fa-solid fa-envelope"></i> Email Report
            </a>
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); window.location.assign(`${window.location.origin}${window.location.pathname}?kiosk=1`); }}>
              <i className="fa-solid fa-fingerprint"></i> Kiosk Mode
            </a>
            
            <li className="nav-section">System</li>
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setShowPasswordModal(true); setIsMobileMenuOpen(false); }}><i className="fa-solid fa-lock"></i> Password</a>
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); onLogout(); }}><i className="fa-solid fa-right-from-bracket"></i> Logout</a>
          </ul>
        </aside>

        <main className="main-content">
          <header className="top-header">
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <i className="fa-solid fa-bars"></i>
            </button>

            <div className="school-info">
              <div className="school-icon"><i className="fa-solid fa-building-columns"></i></div>
              <span className="school-name">B. MASHILO DESIGNS ATELIER</span>
            </div>
            
            <div className="header-actions">
              <button className="dropdown-btn hide-mobile">{currentYear} - {currentYear+1} <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i></button>
              <div className="user-profile">
                <img src={`https://ui-avatars.com/api/?name=${currentUser.fullName.replace(' ', '+')}&background=random`} alt="User" />
                <span className="hide-mobile">{currentUser.fullName} {currentUser.role === 'admin' && <span>(Admin)</span>}</span>
              </div>
            </div>
          </header>

          {activePage === 'register' && (
            <div className="page-content" style={{ padding: '24px' }}>
              
              {/* Top Controls Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                
                <div style={{ display: 'flex', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                  <button onClick={() => setActiveTab('register')} style={{ padding: '8px 20px', fontSize: '13px', border: 'none', background: activeTab === 'register' ? '#f0f0f0' : 'none', fontWeight: 500, color: activeTab === 'register' ? '#333' : '#888', cursor: 'pointer' }}>Register</button>
                  <button onClick={() => setActiveTab('summary')} style={{ padding: '8px 20px', fontSize: '13px', border: 'none', background: activeTab === 'summary' ? '#f0f0f0' : 'none', fontWeight: 500, color: activeTab === 'summary' ? '#333' : '#888', cursor: 'pointer' }}>Summary</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  
                  {/* UNIFIED DATE PICKER SECTION */}
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
                    <button type="button" onClick={handlePrevMonth} style={{ padding: '8px 16px', border: 'none', background: 'transparent', borderRight: '1px solid #e0e0e0', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}>
                      <i className="fa-solid fa-chevron-left" style={{ fontSize: '12px' }}></i>
                    </button>
                    <span style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 600, color: '#333', minWidth: '140px', textAlign: 'center' }}>
                      {MONTHS[currentMonth]} {currentYear}
                    </span>
                    <button type="button" onClick={handleNextMonth} style={{ padding: '8px 16px', border: 'none', background: 'transparent', borderLeft: '1px solid #e0e0e0', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}>
                      <i className="fa-solid fa-chevron-right" style={{ fontSize: '12px' }}></i>
                    </button>
                    <button type="button" onClick={() => { setCurrentMonth(new Date().getMonth()); setCurrentYear(new Date().getFullYear()); }} style={{ padding: '8px 20px', border: 'none', borderLeft: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', color: '#333', fontWeight: 500, fontSize: '13px' }}>
                      Today
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '0 12px', height: '36px', width: '200px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ color: '#888', fontSize: '13px', marginRight: '8px' }}></i>
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent', color: '#333' }} />
                  </div>

                  {currentUser.role === 'admin' && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {showAddForm ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #0f9d58', borderRadius: '8px', padding: '4px', height: '36px', animation: 'fadeIn 0.2s' }}>
                          <input type="text" placeholder="Employee Name" value={newEmployeeName} onChange={(e) => { setNewEmployeeName(e.target.value); setAddError(''); }} onKeyDown={(e) => e.key === 'Enter' && addEmployee()} autoFocus style={{ border: 'none', outline: 'none', padding: '0 8px', fontSize: '13px', width: '150px', color: '#333', height: '100%' }} />
                          <button type="button" onClick={addEmployee} style={{ background: '#0f9d58', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 12px', height: '28px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          <button type="button" onClick={() => { setShowAddForm(false); setNewEmployeeName(''); setAddError(''); }} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', padding: '0 4px', height: '100%' }}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 16px', height: '36px', backgroundColor: '#0f9d58', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.target.style.backgroundColor = '#0b8043'} onMouseLeave={(e) => e.target.style.backgroundColor = '#0f9d58'}>
                          <i className="fa-solid fa-plus"></i> Add Employee
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {addError && (
                <div style={{ backgroundColor: '#fce8e6', color: '#d93025', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }}></i> {addError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', fontSize: '12px', color: '#888', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34a853' }}></div> Present</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea4335' }}></div> Absent</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbc04' }}></div> Late</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4285f4' }}></div> Early Leave</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9e9e9e' }}></div> Off Duty</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f4f6f8', border: '1px solid #e0e0e0' }}></div> Weekend</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#fff8e1', border: '1px solid #fce8e6' }}></div> Holiday</div>
              </div>

              {activeTab === 'register' && (
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 320px)', position: 'relative' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '900px', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 10, background: '#f8f9fa', padding: '12px 0', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', width: '40px', textAlign: 'center', fontSize: '11px', color: '#888', fontWeight: 600 }}>#</th>
                          <th style={{ position: 'sticky', top: 0, left: '40px', zIndex: 10, background: '#f8f9fa', padding: '12px 16px', borderBottom: '1px solid #e0e0e0', borderRight: '2px solid #e0e0e0', textAlign: 'left', fontSize: '11px', color: '#888', fontWeight: 600, minWidth: '180px' }}>EMPLOYEE ({activeRoster.length})</th>
                          
                          {daysArray.map(day => {
                            const weekend = isWeekend(day);
                            const holidayName = getHolidayName(day);
                            
                            let headerBg = '#f8f9fa';
                            let dayTextColor = '#333';
                            let weekdayTextColor = '#888';

                            if (holidayName) {
                              headerBg = '#fff8e1';
                              dayTextColor = '#d97706';
                              weekdayTextColor = '#d97706';
                            } else if (weekend) {
                              headerBg = '#f4f6f8';
                              dayTextColor = '#6b7280';
                              weekdayTextColor = '#9ca3af';
                            }

                            return (
                              <th key={day} title={holidayName || (weekend ? 'Weekend' : '')} style={{ position: 'sticky', top: 0, zIndex: 5, background: headerBg, padding: '8px 0', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', textAlign: 'center', minWidth: '40px' }}>
                                <div style={{ fontSize: '10px', color: weekdayTextColor, fontWeight: 500, marginBottom: '2px' }}>{getWeekday(day)}</div>
                                <div style={{ fontSize: '13px', color: dayTextColor, fontWeight: 600 }}>{day}</div>
                              </th>
                            );
                          })}
                          
                          <th style={{ position: 'sticky', top: 0, right: 0, zIndex: 10, background: '#f8f9fa', padding: '12px 16px', borderBottom: '1px solid #e0e0e0', textAlign: 'right', fontSize: '11px', color: '#888', fontWeight: 600, minWidth: '80px' }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRoster.map((emp, index) => (
                          <tr key={emp.id}>
                            
                            <td style={{ position: 'sticky', left: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', textAlign: 'center', fontSize: '13px', color: '#888', fontWeight: 500, width: '40px', minWidth: '40px' }}>{index + 1}</td>
                            
                            <td style={{ position: 'sticky', left: '40px', zIndex: 5, background: '#fff', padding: '12px 16px', borderBottom: '1px solid #e0e0e0', borderRight: '2px solid #e0e0e0', minWidth: '180px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src={`https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`} alt={emp.name} style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
                                <span 
                                  style={{ fontSize: '13px', fontWeight: 500, color: '#333', cursor: 'pointer', whiteSpace: 'nowrap' }} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setEmployeeActionPopup({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY });
                                  }}
                                >
                                  {emp.name}
                                </span>
                              </div>
                            </td>

                            {daysArray.map(day => {
                              const status = getStatus(emp.id, day);
                              const isLocked = edits[`${emp.id}-${getDateKey(day)}`] >= 2 && currentUser.role !== 'admin';
                              const weekend = isWeekend(day);
                              const holidayName = getHolidayName(day);
                              
                              let bg = '#fff';
                              if (holidayName) bg = '#fff8e1'; 
                              else if (weekend) bg = '#f4f6f8';

                              let dotColor = 'transparent';
                              let dotDisplay = status ? 'block' : 'none';

                              if (status === 'present') { bg = '#f4fbf7'; dotColor = '#34a853'; }
                              else if (status === 'absent') { bg = '#fdf5f5'; dotColor = '#ea4335'; }
                              else if (status === 'late') { bg = '#fefbf3'; dotColor = '#fbbc04'; }
                              else if (status === 'early') { bg = '#f3f8fe'; dotColor = '#4285f4'; }
                              else if (status === 'off') { bg = '#f9f9f9'; dotColor = '#9e9e9e'; }

                              return (
                                <td 
                                  key={day} 
                                  onClick={(e) => { if (!isLocked || currentUser.role === 'admin') openPopup(e, emp.id, day); }}
                                  title={holidayName || (weekend ? 'Weekend' : '')}
                                  style={{ background: bg, padding: 0, borderBottom: '1px solid #e0e0e0', borderRight: '1px solid #e0e0e0', textAlign: 'center', cursor: isLocked && currentUser.role !== 'admin' ? 'not-allowed' : 'pointer', height: '45px', transition: 'all 0.2s', position: 'relative' }}
                                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                  {status ? (
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: dotColor, margin: '0 auto', display: dotDisplay }}></div>
                                  ) : (
                                    <span style={{ color: weekend || holidayName ? '#ccc' : '#ddd', fontSize: '14px', fontWeight: 'bold' }}>-</span>
                                  )}
                                  {notes[`${emp.id}-${getDateKey(day)}`] && (
                                     <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: '9px' }}>📝</span>
                                  )}
                                </td>
                              );
                            })}

                            <td style={{ position: 'sticky', right: 0, zIndex: 5, background: '#fafafa', padding: '12px 16px', borderBottom: '1px solid #e0e0e0', textAlign: 'right', minWidth: '80px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{getTotalWorkedDays(emp.id)}</span>
                              <span style={{ fontSize: '11px', color: '#888', display: 'block' }}>days</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activePage === 'history' && <div className="page-content" style={{ padding: 0 }}><HistoryPage history={history} /></div>}
          {activePage === 'email' && <div className="page-content" style={{ padding: 0 }}><EmailReportsPage employees={activeRoster} attendance={attendance} currentUser={currentUser} /></div>}

        </main>
      </div>

      {/* Attendance Popup */}
      {popup && (
        <div ref={popupRef} style={{ position: 'absolute', left: popup.x, top: popup.y, zIndex: 1000, background: '#fff', padding: '12px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888', fontWeight: 600, textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>Mark Day {popup.day}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button type="button" onClick={() => markAttendance(popup.employeeId, popup.day, 'present', popupNote)} style={{ padding: '8px', borderRadius: '4px', border: 'none', background: '#d1f2e5', color: '#0f9d58', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>✓ Present</button>
            <button type="button" onClick={() => markAttendance(popup.employeeId, popup.day, 'absent', popupNote)} style={{ padding: '8px', borderRadius: '4px', border: 'none', background: '#fce8e6', color: '#d93025', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>✗ Absent</button>
            <button type="button" onClick={() => markAttendance(popup.employeeId, popup.day, 'late', popupNote)} style={{ padding: '8px', borderRadius: '4px', border: 'none', background: '#fef7e0', color: '#f29900', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>⏰ Late</button>
            <button type="button" onClick={() => markAttendance(popup.employeeId, popup.day, 'early', popupNote)} style={{ padding: '8px', borderRadius: '4px', border: 'none', background: '#e8f0fe', color: '#1a73e8', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>🚪 Early Leave</button>
            <button type="button" onClick={() => markAttendance(popup.employeeId, popup.day, 'off', popupNote)} style={{ padding: '8px', borderRadius: '4px', border: 'none', background: '#f0f0f0', color: '#666', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>📋 Off Duty</button>
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '4px' }}>
            <input type="text" placeholder="Add a note..." value={popupNote} onChange={(e) => setPopupNote(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '12px', outline: 'none' }} />
          </div>
          {currentUser.role === 'admin' && <button type="button" onClick={() => handleClearConfirm(popup.employeeId, popup.day)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d93025', background: '#fff', color: '#d93025', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginTop: '4px' }}>🗑️ Clear Mark</button>}
        </div>
      )}

      {/* Employee Action Popup (Rename/Delete/Report) */}
      {employeeActionPopup && (
        <div 
          ref={employeePopupRef}
          style={{ 
            position: 'absolute', left: employeeActionPopup.x, top: employeeActionPopup.y, zIndex: 1000, 
            background: '#fff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', 
            border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', minWidth: '160px', overflow: 'hidden' 
          }}
        >
          <button 
            type="button"
            onClick={() => { setSelectedEmployee(employeeActionPopup.employee); setEmployeeActionPopup(null); }} 
            style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#333', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <i className="fa-solid fa-chart-simple" style={{ marginRight: '8px', color: '#1a73e8' }}></i> View Report
          </button>
          
          {currentUser.role === 'admin' && (
            <>
              <button 
                type="button"
                onClick={() => handleRenameEmployee(employeeActionPopup.employee)} 
                style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#333', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <i className="fa-solid fa-pen" style={{ marginRight: '8px', color: '#f29900' }}></i> Rename
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteEmployee(employeeActionPopup.employee)} 
                style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#d93025', fontWeight: 500 }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fce8e6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <i className="fa-solid fa-trash" style={{ marginRight: '8px' }}></i> Delete
              </button>
            </>
          )}
        </div>
      )}

      {showPasswordModal && <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />}
      
      {selectedEmployee && (
        <EmployeeReportModal 
          employee={selectedEmployee} 
          report={getEmployeeReport(selectedEmployee.id)} 
          year={currentYear} 
          onClose={() => setSelectedEmployee(null)} 
        />
      )}
      
      {confirmModal && <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />}
    </div>
  );
}

export default AttendanceRegister;