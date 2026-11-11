import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { Mail, Users, UserCheck, UserX, Clock, Send, Copy, Download, BarChart3, FileText, Printer } from 'lucide-react';
import { monthNames } from '../utils/holidays';

// ==========================================
// YOUR B. MASHILO EMAILJS CREDENTIALS
// ==========================================
const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_4y1jslc';
const EMAILJS_TEMPLATE_ID = 'template_g07lngg';

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
    // Email tables need hardcoded colors because email clients don't support CSS variables
    let tableHTML = `
      <table style="width:100%; border-collapse: collapse; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 13px;">
        <thead style="background-color: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
          <tr>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #888; font-size: 11px; text-transform: uppercase;">#</th>
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #888; font-size: 11px; text-transform: uppercase;">Employee</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #34a853; font-size: 11px; text-transform: uppercase;">Present</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #fbbc04; font-size: 11px; text-transform: uppercase;">Late</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #4285f4; font-size: 11px; text-transform: uppercase;">Early</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #ea4335; font-size: 11px; text-transform: uppercase;">Absent</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #888; font-size: 11px; text-transform: uppercase;">Off</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #0f9d58; font-size: 11px; text-transform: uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>`;
        
    reportRows.forEach((row, i) => {
      tableHTML += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px; text-align: left; color: #888;">${i + 1}</td>
          <td style="padding: 12px; text-align: left; font-weight: 500; color: #333;">${escapeHtml(row.name)}</td>
          <td style="padding: 12px; text-align: center; font-weight: 600; color: #0f9d58;">${row.present}</td>
          <td style="padding: 12px; text-align: center; font-weight: 600; color: #f29900;">${row.late}</td>
          <td style="padding: 12px; text-align: center; font-weight: 600; color: #1a73e8;">${row.early}</td>
          <td style="padding: 12px; text-align: center; font-weight: 600; color: #d93025;">${row.absent}</td>
          <td style="padding: 12px; text-align: center; font-weight: 600; color: #888;">${row.off}</td>
          <td style="padding: 12px; text-align: center; font-weight: 700; color: #333;">${row.total}</td>
        </tr>`;
    });
    tableHTML += `</tbody></table>`;
    return tableHTML;
  };

  const handleDownloadPDF = () => {
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    const logoUrl = `${window.location.origin}/logo-light.png`;

    // Keep PDF styles hardcoded to light mode so it prints cleanly on paper
    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>B. Mashilo Designs - Attendance Report</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Inter', Helvetica, Arial, sans-serif; background:#f4f7f6; padding: 40px 20px; }
          .report-container { max-width:900px; margin:0 auto; background:#fff; border-radius:8px; border: 1px solid #e0e0e0; overflow:hidden; }
          .header { padding: 30px; border-bottom: 1px solid #e0e0e0; background: #fff; }
          .header img { height: 50px; margin-bottom: 15px; display: block; }
          .header h1 { font-size: 24px; color: #333; margin-bottom: 8px; display: none; }
          .header p { font-size: 14px; color: #888; }
          .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; padding: 20px 30px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
          .kpi-card { text-align: center; padding: 15px 10px; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; }
          .kpi-label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; margin-bottom: 4px; }
          .kpi-value { font-size: 20px; font-weight: 700; }
          .content { padding: 30px; }
          .content h2 { font-size: 18px; color: #333; margin-bottom: 15px; }
          @media print { body { background:#fff; padding: 0; } .report-container { border: none; border-radius: 0; max-width: 100%; } }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="header">
            <img src="${logoUrl}" alt="B. Mashilo Designs" />
            <h1>B. Mashilo Designs</h1>
            <p>Atelier Attendance Report &bull; ${startDisplay} – ${endDisplay} (${daysInRange} days)</p>
          </div>
          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label" style="color:#0f9d58;">Present</div><div class="kpi-value">${totals.present}</div></div>
            <div class="kpi-card"><div class="kpi-label" style="color:#f29900;">Late</div><div class="kpi-value">${totals.late}</div></div>
            <div class="kpi-card"><div class="kpi-label" style="color:#1a73e8;">Early</div><div class="kpi-value">${totals.early}</div></div>
            <div class="kpi-card"><div class="kpi-label" style="color:#d93025;">Absent</div><div class="kpi-value">${totals.absent}</div></div>
            <div class="kpi-card"><div class="kpi-label" style="color:#888;">Off</div><div class="kpi-value">${totals.off}</div></div>
            <div class="kpi-card"><div class="kpi-label" style="color:#333;">Total Worked</div><div class="kpi-value">${totals.total}</div></div>
          </div>
          <div class="content">
            <h2>Employee Breakdown (${employees.length} Employees)</h2>
            ${buildEmailTable(reportRows)}
          </div>
        </div>
        <script>
          window.onload = () => { window.print(); }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Your browser blocked the PDF window. Allow pop-ups for this site and try again.');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSending(true);
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: recipientEmail,
        report_period: `${startDisplay} – ${endDisplay}`,
        report_table: buildEmailTable(reportRows),
        total_present: String(totals.present),
        total_absent: String(totals.absent),
        total_late: String(totals.late),
        total_early: String(totals.early),
        total_off: String(totals.off),
        total_worked: String(totals.total),
        days_in_period: String(daysInRange),
        employee_count: String(employees.length),
        company_name: 'B. Mashilo Designs', 
      }, EMAILJS_PUBLIC_KEY);
      
      setSuccess('Report sent successfully!');
      setTimeout(() => { setSuccess(''); setRecipientEmail(''); }, 3000);
    } catch (err) { 
      console.error(err);
      setError('Failed to send email. Please check your EmailJS configuration.'); 
    }
    finally { setSending(false); }
  };

  const handleCopyReport = () => {
    const { reportRows, totals } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    
    let text = `B. Mashilo Designs – Attendance Report\n`;
    text += `Period: ${startDisplay} to ${endDisplay}\n`;
    text += `Total Employees: ${employees.length}\n\n`;
    text += `Present: ${totals.present} | Late: ${totals.late} | Early: ${totals.early} | Absent: ${totals.absent} | Off Duty: ${totals.off} | Total Worked: ${totals.total}\n\n`;
    text += `Employee Breakdown:\n`;
    text += `Name\tPresent\tLate\tEarly\tAbsent\tOff\tTotal\n`;
    reportRows.forEach(row => {
      text += `${row.name}\t${row.present}\t${row.late}\t${row.early}\t${row.absent}\t${row.off}\t${row.total}\n`;
    });
    navigator.clipboard.writeText(text);
    alert('Report copied to clipboard!');
  };

  const handleDownloadCSV = () => {
    const { reportRows } = getReportData();
    const headers = ['Name', 'Present', 'Late', 'Early', 'Absent', 'Off', 'Total'];
    const rows = reportRows.map((row) => [`"${String(row.name).replace(/"/g, '""')}"`, row.present, row.late, row.early, row.absent, row.off, row.total]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bmashilo-attendance-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { reportRows, totals } = getReportData();
  const startDisplay = formatDateDisplay(startDate);
  const endDisplay = formatDateDisplay(endDate);

  return (
    <div style={{ padding: '25px', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-body)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mail color="var(--accent-green-text)" size={28} /> Email Reports
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Generate and send attendance reports</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '6px', borderRadius: '6px' }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', outline: 'none' }} />
          <span style={{ color: 'var(--text-muted)' }}>—</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', outline: 'none' }} />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Employees', value: employees.length, icon: <Users size={18} color="var(--accent-green-text)" /> },
          { label: 'Present', value: totals.present, icon: <UserCheck size={18} color="var(--status-p-text)" /> },
          { label: 'Late', value: totals.late, icon: <Clock size={18} color="var(--status-l-text)" /> },
          { label: 'Early', value: totals.early, icon: <UserX size={18} color="var(--status-e-text)" /> },
          { label: 'Absent', value: totals.absent, icon: <UserX size={18} color="var(--status-a-text)" /> },
          { label: 'Total Entries', value: totals.total, icon: <BarChart3 size={18} color="var(--text-muted)" /> }
        ].map((stat, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Employee Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--accent-green-text)" /> Employee Breakdown
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>({reportRows.length} employees)</span>
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCopyReport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-main)' }}><Copy size={14} /> Copy</button>
            <button onClick={handleDownloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-main)' }}><Download size={14} /> CSV</button>
            <button onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-main)' }}><Printer size={14} /> PDF</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Employee</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--status-p-text)', fontSize: '11px', textTransform: 'uppercase' }}>Present</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--status-l-text)', fontSize: '11px', textTransform: 'uppercase' }}>Late</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--status-e-text)', fontSize: '11px', textTransform: 'uppercase' }}>Early</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--status-a-text)', fontSize: '11px', textTransform: 'uppercase' }}>Absent</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Off</th>
                <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: 'var(--accent-green-text)', fontSize: '11px', textTransform: 'uppercase' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-main)' }}>{row.name}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: 'var(--status-p-text)', fontWeight: 600 }}>{row.present}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: 'var(--status-l-text)', fontWeight: 600 }}>{row.late}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: 'var(--status-e-text)', fontWeight: 600 }}>{row.early}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: 'var(--status-a-text)', fontWeight: 600 }}>{row.absent}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{row.off}</td>
                  <td style={{ textAlign: 'center', padding: '12px', color: 'var(--text-main)', fontWeight: 700 }}>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Email Section */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={16} color="var(--accent-green-text)" /> Send Report via Email
        </h2>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Recipient Email</label>
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="hr@bmashilo.com" required
              style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-main)', backgroundColor: 'var(--bg-input)', outline: 'none' }} />
          </div>
          <div style={{ background: 'var(--bg-body)', borderRadius: '6px', padding: '12px', fontSize: '13px', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>📋 Report Preview</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 2px 0' }}>Period: <strong>{startDisplay}</strong> – <strong>{endDisplay}</strong></p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Employees: {employees.length} &nbsp;|&nbsp; Total Entries: {totals.total}</p>
          </div>
          {error && <p style={{ color: 'var(--status-a-text)', fontSize: '13px', background: 'var(--status-a-bg)', padding: '8px 12px', borderRadius: '6px', margin: 0 }}>{error}</p>}
          {success && <p style={{ color: 'var(--status-p-text)', fontSize: '13px', background: 'var(--status-p-bg)', padding: '8px 12px', borderRadius: '6px', margin: 0 }}>{success}</p>}
          
          <button type="submit" disabled={sending} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'var(--accent-green-text)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending...' : <><Send size={18} /> Send Report</>}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EmailReportsPage;