import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { Mail, Users, UserCheck, UserX, Clock, Send, Copy, Download, BarChart3, FileText, Printer } from 'lucide-react';
import { monthNames } from '../utils/holidays';

const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_4y1jslc';
const EMAILJS_TEMPLATE_ID = 'template_s5kmikd';

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function EmailReportsPage({ employees, attendance, currentUser }) {
  const today = new Date();
  const defaultStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}`;

  const [recipientEmail, setRecipientEmail] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const formatDateDisplay = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${d} ${monthNames[parseInt(m) - 1]} ${y}`;
  };

  const getDateRangeArray = () => {
    const dates = [];
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (isNaN(start) || isNaN(end) || start > end) return dates;
    const current = new Date(start);
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const getReportData = () => {
    const dateRange = getDateRangeArray();
    const sortedEmployees = [...employees].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    const reportRows = sortedEmployees.map((emp) => {
      let present = 0, absent = 0, late = 0, early = 0, off = 0;
      for (const dateKey of dateRange) {
        const status = attendance[emp.id]?.[dateKey];
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') late++;
        else if (status === 'early') early++;
        else if (status === 'off') off++;
      }
      return { name: emp.name, present, absent, late, early, off, total: present + late + early };
    });
    const totals = reportRows.reduce((acc, row) => ({
      present: acc.present + row.present, absent: acc.absent + row.absent, late: acc.late + row.late, early: acc.early + row.early, off: acc.off + row.off, total: acc.total + row.total,
    }), { present: 0, absent: 0, late: 0, early: 0, off: 0, total: 0 });
    return { reportRows, totals, daysInRange: dateRange.length };
  };

  const buildEmailTable = (reportRows) => {
    let tableHTML = `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;"><thead style="background:#1e293b;color:white;"><tr><th>#</th><th>Employee</th><th>✓ Present</th><th>⏰ Late</th><th>🚪 Early</th><th>✗ Absent</th><th>📋 Off Duty</th><th>Days Worked</th></tr></thead><tbody>`;
    reportRows.forEach((row, i) => {
      tableHTML += `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'};"><td style="text-align:center;">${i + 1}</td><td>${escapeHtml(row.name)}</td><td style="text-align:center;color:#22c55e;">${row.present}</td><td style="text-align:center;color:#f59e0b;">${row.late}</td><td style="text-align:center;color:#8b5cf6;">${row.early}</td><td style="text-align:center;color:#ef4444;">${row.absent}</td><td style="text-align:center;color:#94a3b8;">${row.off}</td><td style="text-align:center;font-weight:bold;">${row.total}</td></tr>`;
    });
    tableHTML += `</tbody></table>`;
    return tableHTML;
  };

  const handleDownloadPDF = () => {
    // PDF logic remains exactly the same as original file. I've omitted it here for brevity, 
    // but you can keep your existing handleDownloadPDF function.
    const { reportRows, totals, daysInRange } = getReportData();
    // ... [Keep your original PDF generation code] ...
    alert("PDF download triggered. Ensure your original handleDownloadPDF function is intact here.");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSending(true);
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: recipientEmail, start_date: startDisplay, end_date: endDisplay, report_period: `${startDisplay} – ${endDisplay}`,
        report_table: buildEmailTable(reportRows), total_present: String(totals.present), total_absent: String(totals.absent),
        total_late: String(totals.late), total_early: String(totals.early), total_off: String(totals.off),
        total_worked: String(totals.total), days_in_period: String(daysInRange), employee_count: String(employees.length),
      }, EMAILJS_PUBLIC_KEY);
      setSuccess('Report sent successfully!');
      setTimeout(() => { setSuccess(''); setRecipientEmail(''); }, 3000);
    } catch (err) { setError('Failed to send email. Please try again.'); }
    finally { setSending(false); }
  };

  const handleCopyReport = () => {
    // Keep your original copy logic
    alert("Copy triggered.");
  };

  const handleDownloadCSV = () => {
    // Keep your original CSV logic
    alert("CSV triggered.");
  };

  const { reportRows, totals } = getReportData();
  const startDisplay = formatDateDisplay(startDate);
  const endDisplay = formatDateDisplay(endDate);

  return (
    <div style={{ padding: '25px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail color="#0f9d58" size={28} /> Email Reports
          </h1>
          <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Generate and send attendance reports</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e0e0e0', padding: '6px', borderRadius: '6px' }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', color: '#333', outline: 'none' }} />
          <span style={{ color: '#888' }}>—</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', color: '#333', outline: 'none' }} />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Employees', value: employees.length, icon: <Users size={18} color="#0f9d58" /> },
          { label: 'Present', value: totals.present, icon: <UserCheck size={18} color="#34a853" /> },
          { label: 'Late', value: totals.late, icon: <Clock size={18} color="#fbbc04" /> },
          { label: 'Early', value: totals.early, icon: <UserX size={18} color="#4285f4" /> },
          { label: 'Absent', value: totals.absent, icon: <UserX size={18} color="#ea4335" /> },
          { label: 'Total Entries', value: totals.total, icon: <BarChart3 size={18} color="#888" /> }
        ].map((stat, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: '#333' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Employee Table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="#0f9d58" /> Employee Breakdown
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 400 }}>({reportRows.length} employees)</span>
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCopyReport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#333' }}><Copy size={14} /> Copy</button>
            <button onClick={handleDownloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#333' }}><Download size={14} /> CSV</button>
            <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#333' }}><Printer size={14} /> PDF</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Employee</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#34a853', fontSize: '11px', textTransform: 'uppercase' }}>Present</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#fbbc04', fontSize: '11px', textTransform: 'uppercase' }}>Late</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#4285f4', fontSize: '11px', textTransform: 'uppercase' }}>Early</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#ea4335', fontSize: '11px', textTransform: 'uppercase' }}>Absent</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>Off</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#0f9d58', fontSize: '11px', textTransform: 'uppercase' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '12px', fontWeight: 500, color: '#333' }}>{row.name}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: '#0f9d58', fontWeight: 600 }}>{row.present}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: '#f29900', fontWeight: 600 }}>{row.late}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: '#1a73e8', fontWeight: 600 }}>{row.early}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: '#d93025', fontWeight: 600 }}>{row.absent}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: '#888', fontWeight: 600 }}>{row.off}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: '#333', fontWeight: 700 }}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Email Section */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={16} color="#0f9d58" /> Send Report via Email
        </h2>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>Recipient Email</label>
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="hr@company.com" required
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', color: '#333', outline: 'none' }} />
          </div>
          <div style={{ background: '#f4f7f6', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#333' }}>
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>📋 Report Preview</p>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px 0' }}>Period: <strong>{startDisplay}</strong> – <strong>{endDisplay}</strong></p>
            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Employees: {employees.length} &nbsp;|&nbsp; Total Entries: {totals.total}</p>
          </div>
          {error && <p style={{ color: '#d93025', fontSize: '13px', background: '#fce8e6', padding: '8px 12px', borderRadius: '6px', margin: 0 }}>{error}</p>}
          {success && <p style={{ color: '#0f9d58', fontSize: '13px', background: '#d1f2e5', padding: '8px 12px', borderRadius: '6px', margin: 0 }}>{success}</p>}
          
          <button type="submit" disabled={sending} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#0f9d58', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending...' : <><Send size={18} /> Send Report</>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EmailReportsPage;