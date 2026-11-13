import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Fingerprint, Gauge, List, Lock, LogOut, Mail, Menu, Moon, Pencil, Plus, Presentation, Users, Search, Trash2, X } from 'lucide-react';
import { doc, setDoc, updateDoc, deleteField, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getSAHolidays } from '../utils/holidays';
import { useTheme } from '../contexts/ThemeContext';
import PasswordChangeModal from './PasswordChangeModal';
import EmployeeReportModal from './EmployeeReportModal';
import ConfirmModal from './ConfirmModal';
import EnrollFingerprintModal from './EnrollFingerprintModal';
import StatsPage from './StatsPage';
import { closeStaleShifts } from '../utils/attendanceWrites';

import HistoryPage from './HistoryPage';
import EmailReportsPage from './EmailReportsPage';
import DashboardPage from './DashboardPage';
import UserManagementPage from './UserManagementPage';
import { can } from '../data/permissions';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png';

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [edits, setEdits] = useState({});
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [addError, setAddError] = useState('');

  const [popup, setPopup] = useState(null);
  const [popupNote, setPopupNote] = useState('');
  const [employeeActionPopup, setEmployeeActionPopup] = useState(null); 
  const [confirmModal, setConfirmModal] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [enrollEmployee, setEnrollEmployee] = useState(null);
  const [showStats, setShowStats] = useState(false);
  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('register');

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);
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
        setDoc(docRef, { employees: [], attendance: {}, edits: {}, history: [], notes: {} }).catch(err => console.error("Error creating initial document:", err));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setPopup(null); setPopupNote('');
      if (employeePopupRef.current && employeePopupRef.current.contains(e.target)) return;
      setEmployeeActionPopup(null);
    };
    if (popup || employeeActionPopup) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup, employeeActionPopup]);

  useEffect(() => {
    if (!showUserMenu) return;
    const close = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setShowUserMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [showUserMenu]);

  const handleNavClick = (page) => { setActivePage(page); if (window.innerWidth <= 1024) setIsSidebarOpen(false); };
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(prev => prev - 1); } else setCurrentMonth(prev => prev - 1); };
  const handleNextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(prev => prev + 1); } else setCurrentMonth(prev => prev + 1); };

  const getDateKey = (day) => `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const getStatus = (employeeId, day) => attendance[employeeId]?.[getDateKey(day)] || null;
  const getTotalWorkedDays = (employeeId) => {
    const empAttendance = attendance[employeeId] || {};
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
    return Object.keys(empAttendance).filter((key) => key.startsWith(monthPrefix) && ['present', 'late', 'early'].includes(empAttendance[key])).length;
  };
  const getWeekday = (day) => WEEKDAYS[new Date(currentYear, currentMonth, day).getDay()];
  const isWeekend = (day) => { const dow = new Date(currentYear, currentMonth, day).getDay(); return dow === 0 || dow === 6; };
  const getHolidayName = (day) => { const dateKey = getDateKey(day); const holiday = getSAHolidays(currentYear).find((h) => h.date === dateKey); return holiday ? holiday.name : null; };

  const getEmployeeReport = (empId) => {
    const months = [];
    const holidayDates = new Set(getSAHolidays(currentYear).map((h) => h.date));
    for (let m = 0; m < 12; m++) {
      const daysInM = new Date(currentYear, m + 1, 0).getDate();
      let present = 0, absent = 0, late = 0, early = 0, off = 0, weekend = 0, holiday = 0, unmarked = 0;
      for (let d = 1; d <= daysInM; d++) {
        const dateKey = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const date = new Date(currentYear, m, d); const dow = date.getDay();
        const isH = holidayDates.has(dateKey);
        const st = attendance[empId]?.[dateKey];
        if (st === 'present') present++;
        else if (st === 'late') late++;
        else if (st === 'early') early++;
        else if (st === 'off') off++;
        else if (st === 'absent') absent++;
        else if (dow === 0 || dow === 6) weekend++;
        else if (isH) holiday++;
        else unmarked++;
      }
      months.push({ month: MONTHS[m], Present: present, Late: late, Early: early, Absent: absent, OffDuty: off, Weekend: weekend, Holiday: holiday, Unmarked: unmarked });
    }
    return months;
  };

  const addEmployee = async () => {
    const name = newEmployeeName.trim();
    if (name === '') return;
    const isDuplicate = employees.some((emp) => emp.name.toLowerCase() === name.toLowerCase() && !emp.isDeleted);
    if (isDuplicate) { setAddError('This employee already exists!'); setTimeout(() => setAddError(''), 3000); return; }
    setAddError('');
    const newEmployee = { id: Date.now().toString(), name, isDeleted: false };
    const updatedEmployees = [...employees, newEmployee];
    setEmployees(updatedEmployees); setNewEmployeeName(''); setShowAddForm(false);
    try { await updateDoc(doc(db, 'rollcall', 'data'), { employees: updatedEmployees }); } catch (err) { setAddError('Failed to save to database: ' + err.message); }
  };

  const handleRenameEmployee = async (emp) => {
    setEmployeeActionPopup(null);
    const newName = window.prompt(`Rename "${emp.name}" to:`, emp.name);
    if (!newName || newName.trim() === '' || newName === emp.name) return;
    const isDuplicate = employees.some((e) => e.id !== emp.id && e.name.toLowerCase() === newName.toLowerCase() && !e.isDeleted);
    if (isDuplicate) return alert('An employee with this name already exists!');
    const updatedEmployees = employees.map(e => e.id === emp.id ? { ...e, name: newName.trim() } : e);
    setEmployees(updatedEmployees);
    try { await updateDoc(doc(db, 'rollcall', 'data'), { employees: updatedEmployees }); } catch (err) { alert('Failed to rename: ' + err.message); }
  };

  const handleDeleteEmployee = (emp) => {
    setEmployeeActionPopup(null);
    setConfirmModal({
      message: `Are you sure you want to delete ${emp.name}? They will be moved to the trash.`,
      onConfirm: async () => {
        const updatedEmployees = employees.map(e => e.id === emp.id ? { ...e, isDeleted: true } : e);
        setEmployees(updatedEmployees); setConfirmModal(null);
        try { await updateDoc(doc(db, 'rollcall', 'data'), { employees: updatedEmployees }); } catch (err) { alert('Failed to delete: ' + err.message); }
      }
    });
  };

  const markAttendance = async (employeeId, day, status, noteText = '') => {
    const dateKey = getDateKey(day);
    const currentEditVal = edits[`${employeeId}-${dateKey}`];
    const currentCount = typeof currentEditVal === 'number' ? currentEditVal : currentEditVal ? 1 : 0;
    const newCount = currentCount + 1;
    const trimmedNote = noteText.trim();
    const employee = employees.find((emp) => emp.id === employeeId);
    const statusLabel = status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : status === 'early' ? 'Early' : 'Off Duty';
    const editorName = currentUser?.fullName || currentUser?.username || 'System';
    const historyEntry = { id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: statusLabel, note: trimmedNote || '', editor: editorName, editedAt: new Date().toISOString() };
    
    setEdits(prev => ({ ...prev, [`${employeeId}-${dateKey}`]: newCount }));
    setAttendance(prev => ({ ...prev, [employeeId]: { ...(prev[employeeId] || {}), [dateKey]: status } }));
    if (trimmedNote) setNotes(prev => ({ ...prev, [`${employeeId}-${dateKey}`]: trimmedNote }));
    setHistory(prev => [historyEntry, ...prev]);
    setPopup(null); setPopupNote('');
    try {
      const updates = { [`attendance.${employeeId}.${dateKey}`]: status, [`edits.${employeeId}-${dateKey}`]: newCount, history: arrayUnion(historyEntry) };
      if (trimmedNote) updates[`notes.${employeeId}-${dateKey}`] = trimmedNote;
      await updateDoc(doc(db, 'rollcall', 'data'), updates);
    } catch (err) { alert('Failed to save to database: ' + err.message); }
  };

  const clearAttendance = async (employeeId, day) => {
    const dateKey = getDateKey(day);
    const employee = employees.find((emp) => emp.id === employeeId);
    const editorName = currentUser?.fullName || currentUser?.username || 'System';
    const historyEntry = { id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: 'Cleared', note: '', editor: editorName, editedAt: new Date().toISOString() };
    
    setAttendance(prev => { const updated = { ...prev }; if (updated[employeeId]) delete updated[employeeId][dateKey]; return updated; });
    setNotes(prev => { const u = { ...prev }; delete u[`${employeeId}-${dateKey}`]; return u; });
    setEdits(prev => { const u = { ...prev }; delete u[`${employeeId}-${dateKey}`]; return u; });
    setHistory(prev => [historyEntry, ...prev]);
    setPopup(null); setPopupNote('');
    try {
      await updateDoc(doc(db, 'rollcall', 'data'), {
        [`attendance.${employeeId}.${dateKey}`]: deleteField(),
        [`notes.${employeeId}-${dateKey}`]: deleteField(),
        [`edits.${employeeId}-${dateKey}`]: deleteField(),
        history: arrayUnion(historyEntry),
      });
    } catch (err) { alert('Failed to clear mark: ' + err.message); }
  };

  const openPopup = (e, employeeId, day) => {
    e.stopPropagation();
    setPopupNote(notes[`${employeeId}-${getDateKey(day)}`] || '');
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.left + window.scrollX;
    let y = rect.bottom + window.scrollY;
    const popupW = Math.min(440, window.innerWidth - 16);
    x = Math.max(8, Math.min(x - 20, window.innerWidth + window.scrollX - popupW - 8));
    if (rect.bottom + 120 > window.innerHeight) y = Math.max(8 + window.scrollY, rect.top + window.scrollY - 120);
    setPopup({ employeeId, day, x, y });
  };

  const handleClearConfirm = (employeeId, day) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    setPopup(null);
    setConfirmModal({ message: `Clear the attendance mark for ${employee?.name} on day ${day}?`, onConfirm: () => { clearAttendance(employeeId, day); setConfirmModal(null); } });
  };

  const allActiveEmployees = employees.filter(emp => !emp.isDeleted);
  const activeRoster = allActiveEmployees.filter(emp => emp.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
  const getMonthCounts = (empId) => {
    const counts = { present: 0, late: 0, early: 0, absent: 0, off: 0 };
    const empAtt = attendance[empId] || {};
    Object.keys(empAtt).forEach((k) => { if (k.startsWith(monthPrefix) && counts[empAtt[k]] !== undefined) counts[empAtt[k]]++; });
    return counts;
  };
  const monthTotals = activeRoster.reduce((acc, emp) => {
    const c = getMonthCounts(emp.id);
    Object.keys(acc).forEach((k) => { acc[k] += c[k]; });
    return acc;
  }, { present: 0, late: 0, early: 0, absent: 0, off: 0 });
  const monthStats = [
    { name: 'Present', value: monthTotals.present, color: 'var(--status-p-text)' },
    { name: 'Late', value: monthTotals.late, color: 'var(--status-l-text)' },
    { name: 'Early Leave', value: monthTotals.early, color: 'var(--status-e-text)' },
    { name: 'Absent', value: monthTotals.absent, color: 'var(--status-a-text)' },
    { name: 'Off Duty', value: monthTotals.off, color: 'var(--status-o-text)' },
  ];
  
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}>Loading register…</div>;

  return (
    <div className="app-wrapper">
      <div className="app-container">
        {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <div className="logo-area">
            <img src={logoSrc} alt="School Logo" style={{ height: '32px', objectFit: 'contain' }} />
            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '5px' }}>
              <X size={16} className="inline-block align-middle shrink-0" style={{ fontSize: '18px' }} />
            </button>
          </div>
          
          <ul className="nav-menu">
            <li className="nav-section">Overview</li>
            <a href="#" className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('dashboard'); }}>
              <Gauge size={16} className="inline-block align-middle shrink-0" /> Dashboard
            </a>
            <a href="#" className={`nav-item ${activePage === 'register' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('register'); }}>
              <Presentation size={16} className="inline-block align-middle shrink-0" /> Attendance Register
            </a>
            
            <li className="nav-section">Actions</li>
            {can(currentUser, 'viewHistory') && (
              <a href="#" className={`nav-item ${activePage === 'history' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('history'); }}>
                <List size={16} className="inline-block align-middle shrink-0" /> History and Logs
              </a>
            )}
            {can(currentUser, 'emailReports') && (
              <a href="#" className={`nav-item ${activePage === 'email' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); handleNavClick('email'); }}>
                <Mail size={16} className="inline-block align-middle shrink-0" /> Email Report
              </a>
            )}
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setIsSidebarOpen(false); window.location.assign(`${window.location.origin}${window.location.pathname}?kiosk=1`); }}>
              <Fingerprint size={16} className="inline-block align-middle shrink-0" /> Kiosk Mode
            </a>
          </ul>
        </aside>

        <main className="main-content">
          <header className="top-header" style={{ position: 'relative' }}>
            
            {/* Left Side: Hamburger Menu (Only if sidebar is closed) */}
            {!isSidebarOpen && (
              <div style={{ display: 'flex', alignItems: 'center', zIndex: 2 }}>
                <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)} style={{ marginRight: 0 }}>
                  <Menu size={16} className="inline-block align-middle shrink-0" />
                </button>
              </div>
            )}

            {/* Center: Logo (Only if sidebar is closed) */}
            {!isSidebarOpen && (
              <div 
                style={{ 
                  position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', cursor: 'pointer', zIndex: 1
                }}
                onClick={() => setIsSidebarOpen(true)}
                title="Open Sidebar"
              >
                <img src={logoSrc} alt="B. Mashilo Designs" style={{ height: '34px', objectFit: 'contain' }} />
              </div>
            )}
            
            {/* Right Side: Actions (Always Visible) */}
            <div className="header-actions" style={{ marginLeft: 'auto', zIndex: 2 }}>
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button type="button" className="user-profile" onClick={() => setShowUserMenu((v) => !v)} aria-haspopup="menu" aria-expanded={showUserMenu} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <img src={`https://ui-avatars.com/api/?name=${currentUser.fullName.replace(' ', '+')}&background=random`} alt="User" />
                  <span className="hide-mobile">{currentUser.fullName} {currentUser.role === 'admin' && <span>(Admin)</span>}</span>
                  <ChevronDown size={14} style={{ transition: 'transform 0.15s', transform: showUserMenu ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }} />
                </button>
                {showUserMenu && (
                  <div role="menu" className="dropdown-menu-anim" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: '200px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 25px var(--shadow-color)', padding: '4px 0', zIndex: 1500 }}>
                    {currentUser.role === 'admin' && (
                      <button type="button" role="menuitem" onClick={() => { setShowUserMenu(false); handleNavClick('users'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <Users size={16} className="shrink-0" /> Users &amp; Access
                      </button>
                    )}
                    <button type="button" role="menuitem" onClick={() => { toggleTheme(); setShowUserMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <Moon size={16} className="shrink-0" /> Toggle Dark Mode
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setShowUserMenu(false); setShowPasswordModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <Lock size={16} className="shrink-0" /> Password
                    </button>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    <button type="button" role="menuitem" onClick={() => { setShowUserMenu(false); onLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: 'var(--status-a-text)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <LogOut size={16} className="shrink-0" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {activePage === 'dashboard' && (
            <DashboardPage employees={allActiveEmployees} attendance={attendance} history={history} currentMonth={currentMonth} currentYear={currentYear} setActivePage={setActivePage} />
          )}

          {activePage === 'register' && (
            <div className="page-content" style={{ padding: '14px', backgroundColor: 'var(--bg-body)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', height: '30px', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <button onClick={() => setActiveTab('register')} style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '12px', border: 'none', background: activeTab === 'register' ? 'var(--bg-hover)' : 'none', fontWeight: 500, color: activeTab === 'register' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Register</button>
                  <button onClick={() => setActiveTab('summary')} style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '12px', border: 'none', background: activeTab === 'summary' ? 'var(--bg-hover)' : 'none', fontWeight: 500, color: activeTab === 'summary' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer' }}>Summary</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'stretch', height: '30px', boxSizing: 'border-box', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-card)', overflow: 'hidden' }}>
                    <button type="button" onClick={handlePrevMonth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', border: 'none', background: 'transparent', borderRight: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <ChevronLeft size={14} className="inline-block align-middle shrink-0" style={{ fontSize: '12px' }} />
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', minWidth: '110px', textAlign: 'center' }}>{MONTHS[currentMonth]} {currentYear}</span>
                    <button type="button" onClick={handleNextMonth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', border: 'none', background: 'transparent', borderLeft: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <ChevronRight size={14} className="inline-block align-middle shrink-0" style={{ fontSize: '12px' }} />
                    </button>
                    <button type="button" onClick={() => { setCurrentMonth(new Date().getMonth()); setCurrentYear(new Date().getFullYear()); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', border: 'none', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 500, fontSize: '12px' }}>Today</button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 8px', height: '30px', boxSizing: 'border-box', width: '150px' }}>
                    <Search size={13} className="inline-block align-middle shrink-0" style={{ color: 'var(--text-muted)', fontSize: '12px', marginRight: '6px' }} />
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', background: 'transparent', color: 'var(--text-main)' }} />
                  </div>

                  {can(currentUser, 'manageEmployees') && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {showAddForm ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--accent-green-text)', borderRadius: '6px', padding: '2px', height: '30px', boxSizing: 'border-box' }}>
                          <input type="text" placeholder="Employee Name" value={newEmployeeName} onChange={(e) => { setNewEmployeeName(e.target.value); setAddError(''); }} onKeyDown={(e) => e.key === 'Enter' && addEmployee()} autoFocus style={{ border: 'none', outline: 'none', padding: '0 6px', fontSize: '12px', width: '130px', color: 'var(--text-main)', background: 'transparent', height: '100%' }} />
                          <button type="button" onClick={addEmployee} style={{ background: 'var(--accent-green-text)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 10px', height: '24px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                          <button type="button" onClick={() => { setShowAddForm(false); setNewEmployeeName(''); setAddError(''); }} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', padding: '0 4px', height: '100%' }}><X size={16} className="inline-block align-middle shrink-0" /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowAddForm(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0 12px', height: '30px', boxSizing: 'border-box', backgroundColor: 'var(--accent-green-text)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          <Plus size={13} className="inline-block align-middle shrink-0" /> Add Employee
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {addError && <div style={{ backgroundColor: 'var(--accent-red)', color: 'var(--accent-red-text)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>{addError}</div>}

              <div style={{ display: 'flex', gap: '14px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-p-text)' }}></div> Present</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-a-text)' }}></div> Absent</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-l-text)' }}></div> Late</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-e-text)' }}></div> Early Leave</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-o-text)' }}></div> Off Duty</div>
              </div>

              {activeTab === 'register' && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', position: 'relative' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '700px', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          {/* FIXED # HEADER */}
                          <th style={{ 
                            position: 'sticky', top: 0, left: 0, zIndex: 10, 
                            background: 'var(--bg-header)', 
                            padding: '7px 0', 
                            borderBottom: '1px solid var(--border-color)', 
                            borderRight: '1px solid var(--border-color)', 
                            width: '32px', minWidth: '32px', maxWidth: '32px', 
                            boxSizing: 'border-box',
                            textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' 
                          }}>#</th>
                          
                          {/* FIXED EMPLOYEE HEADER */}
                          <th style={{ 
                            position: 'sticky', top: 0, left: '32px', zIndex: 10, 
                            background: 'var(--bg-header)', 
                            padding: '7px 12px', 
                            borderBottom: '1px solid var(--border-color)', 
                            borderRight: '2px solid var(--border-color)', 
                            textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', 
                            minWidth: '140px' 
                          }}>EMPLOYEE ({activeRoster.length})</th>
                          
                          {daysArray.map(day => {
                            const weekend = isWeekend(day);
                            const holidayName = getHolidayName(day);
                            let headerBg = 'var(--bg-header)'; let dayTextColor = 'var(--text-main)'; let weekdayTextColor = 'var(--text-muted)';
                            if (holidayName) { headerBg = 'var(--accent-yellow)'; dayTextColor = 'var(--accent-yellow-text)'; weekdayTextColor = 'var(--accent-yellow-text)'; }
                            else if (weekend) { headerBg = 'var(--bg-hover)'; dayTextColor = 'var(--text-muted)'; weekdayTextColor = 'var(--text-muted)'; }

                            return (
                              <th key={day} title={holidayName || (weekend ? 'Weekend' : '')} style={{ position: 'sticky', top: 0, zIndex: 5, background: headerBg, padding: '4px 0', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', textAlign: 'center', minWidth: '30px' }}>
                                <div style={{ fontSize: '9px', color: weekdayTextColor, fontWeight: 500, marginBottom: '1px' }}>{getWeekday(day)}</div>
                                <div style={{ fontSize: '11px', color: dayTextColor, fontWeight: 600 }}>{day}</div>
                              </th>
                            );
                          })}
                          <th style={{ position: 'sticky', top: 0, right: 0, zIndex: 10, background: 'var(--bg-header)', padding: '7px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)', minWidth: '60px' }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRoster.map((emp, index) => (
                          <tr key={emp.id}>
                            {/* FIXED # BODY */}
                            <td style={{ 
                              position: 'sticky', left: 0, zIndex: 5, 
                              background: 'var(--bg-card)', 
                              borderBottom: '1px solid var(--border-color)', 
                              borderRight: '1px solid var(--border-color)', 
                              textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', 
                              width: '32px', minWidth: '32px', maxWidth: '32px', 
                              boxSizing: 'border-box',
                              padding: '4px 0'
                            }}>{index + 1}</td>
                            
                            {/* FIXED EMPLOYEE BODY */}
                            <td style={{ 
                              position: 'sticky', left: '32px', zIndex: 5, 
                              background: 'var(--bg-card)', 
                              padding: '4px 12px', 
                              borderBottom: '1px solid var(--border-color)', 
                              borderRight: '2px solid var(--border-color)', 
                              minWidth: '140px' 
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={`https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`} alt={emp.name} style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setEmployeeActionPopup({ employee: emp, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY }); }}>
                                  {emp.name}
                                </span>
                              </div>
                            </td>

                            {daysArray.map(day => {
                              const status = getStatus(emp.id, day);
                              const isLocked = edits[`${emp.id}-${getDateKey(day)}`] >= 2 && !can(currentUser, 'editLocked');
                              const weekend = isWeekend(day);
                              const holidayName = getHolidayName(day);
                              
                              let bg = 'var(--bg-card)';
                              if (holidayName) bg = 'var(--accent-yellow)'; 
                              else if (weekend) bg = 'var(--bg-hover)';
                              
                              let dotColor = 'transparent'; let dotDisplay = status ? 'block' : 'none';
                              if (status === 'present') { bg = 'var(--status-p-bg)'; dotColor = 'var(--status-p-text)'; }
                              else if (status === 'absent') { bg = 'var(--status-a-bg)'; dotColor = 'var(--status-a-text)'; }
                              else if (status === 'late') { bg = 'var(--status-l-bg)'; dotColor = 'var(--status-l-text)'; }
                              else if (status === 'early') { bg = 'var(--status-e-bg)'; dotColor = 'var(--status-e-text)'; }
                              else if (status === 'off') { bg = 'var(--status-o-bg)'; dotColor = 'var(--status-o-text)'; }

                              return (
                                <td key={day} onClick={(e) => { if (can(currentUser, 'markAttendance') && !isLocked) openPopup(e, emp.id, day); }} title={holidayName || (weekend ? 'Weekend' : '')} style={{ background: bg, padding: 0, borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', textAlign: 'center', cursor: !can(currentUser, 'markAttendance') || isLocked ? 'not-allowed' : 'pointer', height: '32px', position: 'relative' }}>
                                  {status ? <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, margin: '0 auto', display: dotDisplay }}></div> : <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold' }}>-</span>}
                                  {notes[`${emp.id}-${getDateKey(day)}`] && <span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: '7px' }}>📝</span>}
                                </td>
                              );
                            })}

                            <td style={{ position: 'sticky', right: 0, zIndex: 5, background: 'var(--bg-header)', padding: '4px 10px', borderBottom: '1px solid var(--border-color)', textAlign: 'right', minWidth: '60px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{getTotalWorkedDays(emp.id)}</span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>days</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'summary' && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{MONTHS[currentMonth]} {currentYear} Summary</strong>
                    <button type="button" onClick={() => setShowStats(true)} style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-hover)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>📊 View Chart</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '600px' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Employee</th>
                          <th>Present</th><th>Late</th><th>Early Leave</th><th>Absent</th><th>Off Duty</th><th>Days Worked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRoster.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No employees to show.</td></tr>}
                        {activeRoster.map((emp) => {
                          const c = getMonthCounts(emp.id);
                          return (
                            <tr key={emp.id}>
                              <td style={{ textAlign: 'left', fontWeight: 500 }}>{emp.name}</td>
                              <td style={{ textAlign: 'center', color: 'var(--status-p-text)' }}>{c.present}</td>
                              <td style={{ textAlign: 'center', color: 'var(--status-l-text)' }}>{c.late}</td>
                              <td style={{ textAlign: 'center', color: 'var(--status-e-text)' }}>{c.early}</td>
                              <td style={{ textAlign: 'center', color: 'var(--status-a-text)' }}>{c.absent}</td>
                              <td style={{ textAlign: 'center', color: 'var(--status-o-text)' }}>{c.off}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.present + c.late + c.early}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activePage === 'users' && currentUser.role === 'admin' && <div className="page-content" style={{ padding: 0 }}><UserManagementPage currentUser={currentUser} /></div>}
          {activePage === 'history' && can(currentUser, 'viewHistory') && <div className="page-content" style={{ padding: 0 }}><HistoryPage history={history} /></div>}
          {activePage === 'email' && can(currentUser, 'emailReports') && <div className="page-content" style={{ padding: 0 }}><EmailReportsPage employees={allActiveEmployees} attendance={attendance} currentUser={currentUser} /></div>}
        </main>
      </div>

      {popup && (() => {
        const opts = [
          { key: 'present', label: '✓ Present', bg: 'var(--status-p-bg)', fg: 'var(--status-p-text)' },
          { key: 'absent', label: '✗ Absent', bg: 'var(--status-a-bg)', fg: 'var(--status-a-text)' },
          { key: 'late', label: '⏰ Late', bg: 'var(--status-l-bg)', fg: 'var(--status-l-text)' },
          { key: 'early', label: '🚪 Early', bg: 'var(--status-e-bg)', fg: 'var(--status-e-text)' },
          { key: 'off', label: '📋 Off Duty', bg: 'var(--status-o-bg)', fg: 'var(--status-o-text)' },
        ];
        const btn = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' };
        return (
          <div ref={popupRef} style={{ position: 'absolute', left: popup.x, top: popup.y, zIndex: 1000, background: 'var(--bg-card)', padding: '10px', borderRadius: '10px', boxShadow: '0 10px 25px var(--shadow-color)', border: '1px solid var(--border-color)', width: 'max-content', minWidth: 'min(440px, calc(100vw - 16px))', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {opts.map((o) => (
                <button key={o.key} type="button" onClick={() => markAttendance(popup.employeeId, popup.day, o.key, popupNote)} style={{ ...btn, background: o.bg, color: o.fg }}>{o.label}</button>
              ))}
              {can(currentUser, 'clearAttendance') && (
                <button type="button" onClick={() => handleClearConfirm(popup.employeeId, popup.day)} style={{ ...btn, background: 'var(--status-a-bg)', color: 'var(--status-a-text)' }}>🗑️ Clear</button>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
              <input type="text" placeholder="Add a note (e.g., Doctor's appointment)" value={popupNote} onChange={(e) => setPopupNote(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        );
      })()}

      {employeeActionPopup && (
        <div ref={employeePopupRef} style={{ position: 'absolute', left: employeeActionPopup.x, top: employeeActionPopup.y, zIndex: 1000, background: 'var(--bg-card)', borderRadius: '8px', boxShadow: '0 10px 25px var(--shadow-color)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minWidth: '160px', overflow: 'hidden' }}>
          <button type="button" onClick={() => { setSelectedEmployee(employeeActionPopup.employee); setEmployeeActionPopup(null); }} style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: 500, borderBottom: '1px solid var(--border-color)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <BarChart3 size={16} className="inline-block align-middle shrink-0" style={{ marginRight: '8px', color: 'var(--accent-blue-text)' }} /> View Report
          </button>
          {can(currentUser, 'manageEmployees') && (
            <>
              <button type="button" onClick={() => { setEnrollEmployee(employeeActionPopup.employee); setEmployeeActionPopup(null); }} style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: 500, borderBottom: '1px solid var(--border-color)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Fingerprint size={16} className="inline-block align-middle shrink-0" style={{ marginRight: '8px', color: 'var(--status-p-text)' }} /> Enroll Fingerprint
              </button>
              <button type="button" onClick={() => handleRenameEmployee(employeeActionPopup.employee)} style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: 500, borderBottom: '1px solid var(--border-color)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Pencil size={16} className="inline-block align-middle shrink-0" style={{ marginRight: '8px', color: 'var(--accent-yellow-text)' }} /> Rename
              </button>
              <button type="button" onClick={() => handleDeleteEmployee(employeeActionPopup.employee)} style={{ padding: '12px 16px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: 'var(--status-a-text)', fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--status-a-bg)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Trash2 size={16} className="inline-block align-middle shrink-0" style={{ marginRight: '8px' }} /> Delete
              </button>
            </>
          )}
        </div>
      )}

      {showPasswordModal && <PasswordChangeModal currentUser={currentUser} onClose={() => setShowPasswordModal(false)} onPasswordChanged={onPasswordChanged} />}
      {selectedEmployee && <EmployeeReportModal employee={selectedEmployee} report={getEmployeeReport(selectedEmployee.id)} year={currentYear} onClose={() => setSelectedEmployee(null)} />}
      {enrollEmployee && <EnrollFingerprintModal employee={enrollEmployee} onClose={() => setEnrollEmployee(null)} />}
      {showStats && <StatsPage stats={monthStats} currentMonth={currentMonth} currentYear={currentYear} onClose={() => setShowStats(false)} />}
      {confirmModal && <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />}
    </div>
  );
}

export default AttendanceRegister;