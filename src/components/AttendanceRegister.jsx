import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DatabaseBackup, ArchiveX, BarChart3, ChevronDown, ChevronLeft, ChevronRight, Fingerprint, Gauge, List, Lock, LogOut, Mail, Menu, Moon, Pencil, Plus, Presentation, Users, Search, Trash2, X } from 'lucide-react';
import { doc, collection, writeBatch, deleteDoc, arrayUnion, deleteField, onSnapshot } from 'firebase/firestore';
import { ensureRollcallDoc, updateEmployeeList, removeEmployeeEverywhere } from '../utils/safeWrites';
import { rollcallRef, monthRef, historyRef, monthIdOf, MONTHS_COL, HISTORY_COL, SCHEMA_VERSION, migrateIfNeeded } from '../utils/dataModel';
import { db } from '../firebase';
import { getSAHolidays } from '../utils/holidays';
import { useTheme } from '../contexts/ThemeContext';
import PasswordChangeModal from './PasswordChangeModal';
import EmployeeReportModal from './EmployeeReportModal';
import ConfirmModal from './ConfirmModal';
import EmployeeFormModal from './EmployeeFormModal';
import EnrollFingerprintModal from './EnrollFingerprintModal';
import StatsPage from './StatsPage';
import { closeStaleShifts } from '../utils/attendanceWrites';

import HistoryPage from './HistoryPage';
import EmailReportsPage from './EmailReportsPage';
import DashboardPage from './DashboardPage';
import UserManagementPage from './UserManagementPage';
import BackupPage from './BackupPage';
import { createBackup } from '../utils/Backup';
import DeletedEmployeesPage, { RETENTION_DAYS } from './DeletedEmployeesPage';
import { can } from '../data/permissions';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function AttendanceRegister({ currentUser, onLogout, onPasswordChanged }) {
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'dark' ? '/logo-dark.png' : '/logo-light.png';

  const [employees, setEmployees] = useState([]);
  const [monthDocs, setMonthDocs] = useState({});     // rollcall_months/{YYYY-MM}
  const [historyDocs, setHistoryDocs] = useState({});   // rollcall_history/{YYYY-MM}
  // each source is "ready" only once the SERVER has answered (not a cache-only answer)
  const [ready, setReady] = useState({ main: false, months: false, history: false });
  const markReady = (k) => setReady((r) => (r[k] ? r : { ...r, [k]: true }));
  const loading = !(ready.main && ready.months && ready.history);

  const { attendance, edits, notes } = useMemo(() => {
    const att = {}; const ed = {}; const nt = {};
    Object.values(monthDocs).forEach((m) => {
      Object.entries(m.attendance || {}).forEach(([emp, days]) => {
        att[emp] = att[emp] || {};
        Object.entries(days || {}).forEach(([d, v]) => { att[emp][d] = v === true ? 'present' : v === false ? 'absent' : v; });
      });
      Object.assign(ed, m.edits || {});
      Object.assign(nt, m.notes || {});
    });
    return { attendance: att, edits: ed, notes: nt };
  }, [monthDocs]);
  const history = useMemo(
    () => Object.values(historyDocs).flatMap((h) => h.entries || []).sort((a, b) => String(b.editedAt || '').localeCompare(String(a.editedAt || ''))),
    [historyDocs],
  );
  
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

  const [employeeForm, setEmployeeForm] = useState(null); // null | {} (add) | employee (edit)

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
  const autoPurgedRef = useRef(false);
  const autoBackupRef = useRef(false);

  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (!loading) { setSlowLoad(false); return; }
    const t = setTimeout(() => setSlowLoad(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  // ---------- Firestore listeners ----------
  // rollcall/data = employee list only; months and history live in their own collections.
  useEffect(() => {
    const unsubMain = onSnapshot(rollcallRef(), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEmployees(data.employees || []);
        if (data.schemaVersion !== SCHEMA_VERSION) {
          // old single-document data: copy it into the month/history documents (a safety backup is saved first)
          migrateIfNeeded().catch((err) => console.error('Data split failed:', err));
        }
        if (!snap.metadata.fromCache) markReady('main');
      } else if (!snap.metadata.fromCache) {
        // The SERVER says there is no register document: create it, but only through a
        // transaction that cannot overwrite an existing one. The next snapshot loads it.
        ensureRollcallDoc().catch((err) => console.error('Error creating initial document:', err));
      }
      // A cache-only "missing" answer (offline) is never treated as an empty register.
    }, (err) => console.error('Register listener error:', err));
    const unsubMonths = onSnapshot(collection(db, MONTHS_COL), (snap) => {
      if (snap.metadata.fromCache) return;
      const m = {}; snap.docs.forEach((d) => { m[d.id] = d.data(); });
      setMonthDocs(m); markReady('months');
    }, (err) => console.error('Months listener error:', err));
    const unsubHistory = onSnapshot(collection(db, HISTORY_COL), (snap) => {
      if (snap.metadata.fromCache) return;
      const h = {}; snap.docs.forEach((d) => { h[d.id] = d.data(); });
      setHistoryDocs(h); markReady('history');
    }, (err) => console.error('History listener error:', err));
    return () => { unsubMain(); unsubMonths(); unsubHistory(); };
  }, []);

  // close shifts left open on earlier days, once per session, after the data has loaded
  useEffect(() => {
    if (loading || closedStaleShiftsRef.current) return;
    closedStaleShiftsRef.current = true;
    closeStaleShifts().catch((err) => console.error('Failed to close stale shifts:', err));
  }, [loading]);

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

  // Builds a history entry for employee-list changes (add / rename / delete)
  const buildEmployeeLog = (employee, status, note) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: 'employee',
      employeeId: employee.id,
      employeeName: employee.name,
      day: now.getDate(),
      date: today,
      status,
      note,
      editor: currentUser?.fullName || currentUser?.username || 'System',
      editedAt: now.toISOString(),
    };
  };

  // Remove an employee for good: record, attendance, notes/edits and enrolled fingerprints
  const permanentlyRemove = async (emp, status, note, editor) => {
    const log = { ...buildEmployeeLog(emp, status, note), ...(editor ? { editor } : {}) };
    await removeEmployeeEverywhere(emp, log);
    try { await deleteDoc(doc(db, 'fingerprints', emp.id)); } catch (e) { /* no fingerprint enrolled */ }
  };

  const handleRestoreEmployee = async (emp) => {
    if (employees.some((e) => !e.isDeleted && e.name.toLowerCase() === emp.name.toLowerCase())) {
      return alert(`An active employee named "${emp.name}" already exists. Rename one of them first.`);
    }
    const log = buildEmployeeLog(emp, 'Employee Restored', 'Restored from Deleted Employees');
    try {
      await updateEmployeeList((list) => list.map((e) => { if (e.id !== emp.id) return e; const { deletedAt, ...rest } = e; return { ...rest, isDeleted: false }; }), [log]);
    } catch (err) { alert('Failed to restore (nothing was changed): ' + err.message); }
  };

  const handlePurgeEmployee = (emp) => {
    setConfirmModal({
      message: `Permanently delete ${emp.name}? Their attendance records and fingerprints will be removed and this cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try { await createBackup('safety', `Before permanently deleting ${emp.name}`, currentUser?.fullName || 'Admin'); await permanentlyRemove(emp, 'Employee Permanently Deleted', 'Removed permanently from Deleted Employees'); }
        catch (err) { alert('Nothing was deleted, because the safety backup or the delete could not be completed: ' + err.message); }
      },
    });
  };

  // Automatic daily snapshot (first admin to open the app each day)
  useEffect(() => {
    if (loading || autoBackupRef.current || currentUser?.role !== 'admin' || employees.length === 0) return;
    autoBackupRef.current = true;
    createBackup('auto', 'Daily backup', 'System').catch((err) => console.error('Auto backup failed:', err));
  }, [loading, employees, currentUser]);

  // Auto-purge: anything deleted more than RETENTION_DAYS ago is removed for good (once per session)
  useEffect(() => {
    if (loading || employees.length === 0 || autoPurgedRef.current || !can(currentUser, 'manageEmployees')) return;
    autoPurgedRef.current = true;
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expired = employees.filter((e) => e.isDeleted && e.deletedAt && new Date(e.deletedAt).getTime() < cutoff);
    (async () => {
      for (const emp of expired) {
        try { await permanentlyRemove(emp, 'Employee Permanently Deleted', `Auto-removed after ${RETENTION_DAYS} days`, 'System'); }
        catch (err) { console.error('Auto-purge failed for', emp.name, err); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, employees]);

  // Both return an error message (shown in the form) or nothing on success
  const addEmployee = async (v) => {
    if (employees.some((e) => !e.isDeleted && e.name.toLowerCase() === v.name.toLowerCase())) return 'An employee with this name already exists.';
    const newEmployee = { id: Date.now().toString(), isDeleted: false, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x)) };
    const log = buildEmployeeLog(newEmployee, 'Employee Added', `New employee added${v.position ? ` (${v.position})` : ''}`);
    try {
      await updateEmployeeList((list) => {
        if (list.some((e) => !e.isDeleted && e.name.toLowerCase() === v.name.toLowerCase())) throw new Error('An employee with this name already exists.');
        return [...list, newEmployee];
      }, [log]);
      setEmployeeForm(null);
    } catch (err) { return err.message.startsWith('An employee') ? err.message : 'Could not save (nothing was changed): ' + err.message; }
  };

  const editEmployee = async (emp, v) => {
    if (employees.some((e) => e.id !== emp.id && !e.isDeleted && e.name.toLowerCase() === v.name.toLowerCase())) return 'An employee with this name already exists.';
    const labels = { name: 'name', employeeNumber: 'employee number', position: 'job title', phone: 'phone', email: 'email', startDate: 'start date' };
    const changed = Object.keys(labels).filter((k) => (emp[k] || '') !== v[k]);
    if (changed.length === 0) { setEmployeeForm(null); return; }
    const note = changed.map((k) => k === 'name' ? `name "${emp.name}" → "${v.name}"` : labels[k]).join(', ');
    const log = buildEmployeeLog({ ...emp, name: v.name }, 'Employee Edited', `Changed ${note}`);
    try {
      await updateEmployeeList((list) => list.map((e) => (e.id === emp.id ? { ...e, ...v } : e)), [log]);
      setEmployeeForm(null);
    } catch (err) { return 'Could not save (nothing was changed): ' + err.message; }
  };

  const handleRenameEmployee = (emp) => { setEmployeeActionPopup(null); setEmployeeForm(emp); };

  const handleDeleteEmployee = (emp) => {
    setEmployeeActionPopup(null);
    setConfirmModal({
      message: `Are you sure you want to delete ${emp.name}? They will be moved to the trash.`,
      onConfirm: async () => {
        const log = buildEmployeeLog(emp, 'Employee Deleted', `Moved to Deleted Employees (kept ${RETENTION_DAYS} days)`);
        setConfirmModal(null);
        try { await updateEmployeeList((list) => list.map((e) => e.id === emp.id ? { ...e, isDeleted: true, deletedAt: new Date().toISOString() } : e), [log]); }
        catch (err) { alert('Failed to delete (nothing was changed): ' + err.message); }
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
    
    setPopup(null); setPopupNote('');
    try {
      const monthId = monthIdOf(dateKey);
      const monthUpdate = { attendance: { [employeeId]: { [dateKey]: status } }, edits: { [`${employeeId}-${dateKey}`]: newCount } };
      if (trimmedNote) monthUpdate.notes = { [`${employeeId}-${dateKey}`]: trimmedNote };
      const batch = writeBatch(db);
      batch.set(monthRef(monthId), monthUpdate, { merge: true });
      batch.set(historyRef(monthId), { entries: arrayUnion(historyEntry) }, { merge: true });
      await batch.commit();
    } catch (err) { alert('Failed to save to database: ' + err.message); }
  };

  const clearAttendance = async (employeeId, day) => {
    const dateKey = getDateKey(day);
    const employee = employees.find((emp) => emp.id === employeeId);
    const editorName = currentUser?.fullName || currentUser?.username || 'System';
    const historyEntry = { id: Date.now(), employeeId, employeeName: employee?.name || 'Unknown', day, date: dateKey, status: 'Cleared', note: '', editor: editorName, editedAt: new Date().toISOString() };
    
    setPopup(null); setPopupNote('');
    try {
      const monthId = monthIdOf(dateKey);
      const key = `${employeeId}-${dateKey}`;
      const batch = writeBatch(db);
      batch.set(monthRef(monthId), {
        attendance: { [employeeId]: { [dateKey]: deleteField() } },
        notes: { [key]: deleteField() },
        edits: { [key]: deleteField() },
      }, { merge: true });
      batch.set(historyRef(monthId), { entries: arrayUnion(historyEntry) }, { merge: true });
      await batch.commit();
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
  
  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', textAlign: 'center', padding: '20px' }}>
    <div>Loading register…</div>
    {slowLoad && <div style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '380px' }}>Still trying to reach the database. Check the internet connection. Nothing is changed while the app is offline.</div>}
  </div>;

  return (
    <div className="app-wrapper">
      <div className="app-container">
        {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)}></div>}

        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <div className="logo-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div aria-hidden="true" style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '9px', border: '1.5px solid var(--accent-green-text)', background: 'var(--accent-green)', color: 'var(--accent-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em' }}>BM</div>
              <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: '15px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>Attendance</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Register</div>
              </div>
            </div>
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
          <header className="top-header" style={{ position: 'relative', zIndex: 200 }}>
            
            {/* Left Side: Hamburger Menu (Only if sidebar is closed) */}
            {!isSidebarOpen && (
              <div style={{ display: 'flex', alignItems: 'center', zIndex: 2 }}>
                <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)} style={{ marginRight: 0 }}>
                  <Menu size={16} className="inline-block align-middle shrink-0" />
                </button>
              </div>
            )}

            {/* Center: Logo (always visible; click opens the sidebar when it is closed) */}
            <div
              style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', cursor: isSidebarOpen ? 'default' : 'pointer', zIndex: 1
              }}
              onClick={() => { if (!isSidebarOpen) setIsSidebarOpen(true); }}
              title={isSidebarOpen ? 'Register' : 'Open Sidebar'}
            >
              <img src={logoSrc} alt="Register" style={{ height: '46px', objectFit: 'contain' }} />
            </div>

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
                    {currentUser.role === 'admin' && (
                      <button type="button" role="menuitem" onClick={() => { setShowUserMenu(false); handleNavClick('backup'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 14px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <DatabaseBackup size={16} className="shrink-0" /> Backup &amp; Restore
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
                    <button type="button" onClick={() => setEmployeeForm({})} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0 12px', height: '30px', boxSizing: 'border-box', backgroundColor: 'var(--accent-green-text)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <Plus size={13} className="inline-block align-middle shrink-0" /> Add Employee
                    </button>
                  )}

                  {can(currentUser, 'manageEmployees') && (
                    <button type="button" onClick={() => setActivePage('deleted')} title="View deleted employees (restore within 60 days)" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '0 12px', height: '30px', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <ArchiveX size={13} className="shrink-0" /> Deleted
                      {employees.filter((e) => e.isDeleted).length > 0 && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', background: 'var(--accent-green)', color: 'var(--accent-green-text)' }}>{employees.filter((e) => e.isDeleted).length}</span>}
                    </button>
                  )}
                </div>
              </div>

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

          {activePage === 'deleted' && can(currentUser, 'manageEmployees') && <DeletedEmployeesPage employees={employees} canManage={can(currentUser, 'manageEmployees')} onRestore={handleRestoreEmployee} onPurge={handlePurgeEmployee} onBack={() => setActivePage('register')} />}
          {activePage === 'backup' && currentUser.role === 'admin' && <BackupPage currentUser={currentUser} onBack={() => setActivePage('register')} />}
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
      {employeeForm && <EmployeeFormModal employee={employeeForm.id ? employeeForm : null} onClose={() => setEmployeeForm(null)} onSubmit={(v) => (employeeForm.id ? editEmployee(employeeForm, v) : addEmployee(v))} />}
      {confirmModal && <ConfirmModal message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(null)} />}
    </div>
  );
}

export default AttendanceRegister;