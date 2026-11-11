import React, { useState } from 'react';
import emailjs from '@emailjs/browser';
import { monthNames } from '../utils/holidays';

const EMAILJS_PUBLIC_KEY = 'gMdPl4OE4ZPnLepft';
const EMAILJS_SERVICE_ID = 'service_4y1jslc';
const EMAILJS_TEMPLATE_ID = 'template_s5kmikd';

const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

function EmailReportModal({ employees, attendance, currentYear, currentMonth, onClose }) {
  const defaultStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const defaultEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${new Date(currentYear, currentMonth + 1, 0).getDate()}`;

  const [recipientEmail, setRecipientEmail] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

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
    const sortedEmployees = [...employees].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

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
      present: acc.present + row.present,
      absent: acc.absent + row.absent,
      late: acc.late + row.late,
      early: acc.early + row.early,
      off: acc.off + row.off,
      total: acc.total + row.total,
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
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);

    let tableRowsHTML = '';
    reportRows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      tableRowsHTML += `
        <tr style="background:${bg};">
          <td style="padding:12px;text-align:center;color:#6b7280;">${i + 1}</td>
          <td style="padding:12px;font-weight:500;color:#1e293b;">${escapeHtml(row.name)}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.present > 0 ? '#16a34a' : '#9ca3af'};">${row.present}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.late > 0 ? '#f97316' : '#9ca3af'};">${row.late}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.early > 0 ? '#7c3aed' : '#9ca3af'};">${row.early}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.absent > 0 ? '#dc2626' : '#9ca3af'};">${row.absent}</td>
          <td style="padding:12px;text-align:center;font-weight:500;color:${row.off > 0 ? '#4b5563' : '#9ca3af'};">${row.off}</td>
          <td style="padding:12px;text-align:center;font-weight:700;color:#1e293b;background:#f8fafc;">${row.total}</td>
        </tr>`;
    });

    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>B. Mashilo Attendance Report</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f3f4f6; }
          .report-container { max-width:1000px; margin:30px auto; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.1); overflow:hidden; }
          @media print { body { background:#fff; } .report-container { box-shadow:none; margin:0; } }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div style="background:#0f172a;color:#fff;padding:24px 30px;position:relative;">
            <img src="https://b-mashilo.web.app/logo.png" alt="B. Mashilo Logo" style="position:absolute; top:24px; right:30px; max-height:60px;" />
            <h1 style="font-size:24px;font-weight:700;">B. Mashilo Attendance Report</h1>
            <div style="margin-top:12px;color:#cbd5e1;">
              <p><span style="font-weight:600;color:#fff;">Period:</span> ${startDisplay} – ${endDisplay} (${daysInRange} calendar days)</p>
              <p><span style="font-weight:600;color:#fff;">Total Employees:</span> ${employees.length}</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:24px;border-bottom:1px solid #e5e7eb;">
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#f0fdf4;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">✅</span>
              <div><p style="font-size:12px;color:#6b7280;">Present</p><p style="font-size:18px;font-weight:700;color:#16a34a;">${totals.present}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#fff7ed;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">⏰</span>
              <div><p style="font-size:12px;color:#6b7280;">Late</p><p style="font-size:18px;font-weight:700;color:#f97316;">${totals.late}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#fefce8;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">🚪</span>
              <div><p style="font-size:12px;color:#6b7280;">Early Leave</p><p style="font-size:18px;font-weight:700;color:#a16207;">${totals.early}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#fef2f2;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">❌</span>
              <div><p style="font-size:12px;color:#6b7280;">Absent</p><p style="font-size:18px;font-weight:700;color:#dc2626;">${totals.absent}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">📋</span>
              <div><p style="font-size:12px;color:#6b7280;">Off Duty</p><p style="font-size:18px;font-weight:700;color:#4b5563;">${totals.off}</p></div>
            </div>
            <div style="display:flex;align-items:center;padding:16px;border-radius:8px;background:#eff6ff;border:1px solid #e5e7eb;">
              <span style="font-size:20px;margin-right:10px;">📊</span>
              <div><p style="font-size:12px;color:#6b7280;">Total Worked</p><p style="font-size:18px;font-weight:700;color:#2563eb;">${totals.total}</p></div>
            </div>
          </div>
          <div style="padding:24px;">
            <h2 style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:16px;">Detailed Report</h2>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#1e293b;color:#fff;">
                  <th style="padding:12px;border-radius:8px 0 0 0;font-weight:600;text-align:center;">#</th>
                  <th style="padding:12px;font-weight:600;text-align:left;">Employee</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">✓ Present</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">⏰ Late</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">🚪 Early</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">✗ Absent</th>
                  <th style="padding:12px;font-weight:600;text-align:center;">📋 Off Duty</th>
                  <th style="padding:12px;border-radius:0 8px 0 0;font-weight:600;text-align:center;">Days Worked</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
              </tbody>
            </table>
          </div>
          <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e5e7eb;">
            This report was generated by B. Mashilo Attendance Register.<br/>
            Built by Thabelo Tshishonga
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    const { reportRows, totals, daysInRange } = getReportData();
    const startDisplay = formatDateDisplay(startDate);
    const endDisplay = formatDateDisplay(endDate);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: recipientEmail,
        start_date: startDisplay,
        end_date: endDisplay,
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
      }, EMAILJS_PUBLIC_KEY);
      setSuccess('Report sent successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setError('Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const { reportRows, totals, daysInRange } = getReportData();
  const startDisplay = formatDateDisplay(startDate);
  const endDisplay = formatDateDisplay(endDate);

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-accent mb-1">📧 Email Report (Custom Dates)</h2>
        <p className="text-muted text-sm mb-4">Select a date range, preview, download or send</p>

        {/* Date Range Selectors */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-accent mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2.5 px-3.5 border border-main rounded-xl text-sm bg-input text-main placeholder-muted outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-accent mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-2.5 px-3.5 border border-main rounded-xl text-sm bg-input text-main placeholder-muted outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Selected Date Range Display */}
        <div className="bg-accent-light border border-accent rounded-xl p-3 mb-4">
          <p className="text-sm text-accent font-medium">
            📅 Report Period: <strong>{startDisplay}</strong> – <strong>{endDisplay}</strong>
            <span className="text-muted ml-2">({daysInRange} calendar days)</span>
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3 mb-5 max-md:grid-cols-3 max-sm:grid-cols-2">
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-green-500">
            <span className="block text-xs text-muted mb-1">✓ Present</span>
            <strong className="text-2xl text-main">{totals.present}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-amber-500">
            <span className="block text-xs text-muted mb-1">⏰ Late</span>
            <strong className="text-2xl text-main">{totals.late}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-purple-500">
            <span className="block text-xs text-muted mb-1">🚪 Early</span>
            <strong className="text-2xl text-main">{totals.early}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-red-500">
            <span className="block text-xs text-muted mb-1">✗ Absent</span>
            <strong className="text-2xl text-main">{totals.absent}</strong>
          </div>
          <div className="text-center py-3 px-2 rounded-xl bg-input border border-main border-l-4 border-l-slate-500">
            <span className="block text-xs text-muted mb-1">📋 Off Duty</span>
            <strong className="text-2xl text-main">{totals.off}</strong>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="py-2 px-4 bg-input border border-main rounded-xl font-semibold text-sm text-muted hover:bg-card transition"
          >
            {showPreview ? '🔼 Hide Preview' : '🔽 Show Preview'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="py-2 px-4 bg-[var(--accent-red)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--accent-red-hover)] transition"
          >
            📄 Download PDF
          </button>
        </div>

        {/* Preview Table */}
        {showPreview && (
          <div className="mb-5 border border-main rounded-xl overflow-hidden">
            <div className="bg-input px-4 py-2 border-b border-main flex justify-between items-center">
              <span className="text-xs font-semibold text-muted">Email Preview</span>
              <span className="text-xs text-muted">{startDisplay} – {endDisplay}</span>
            </div>
            <div className="p-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: buildEmailTable(reportRows) }} />
          </div>
        )}

        {/* Recipient Email & Send */}
        <form onSubmit={handleSend}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-accent mb-1.5">Recipient Email</label>
            <input
              type="email"
              placeholder="Enter recipient Email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="w-full py-2.5 px-3.5 border border-main rounded-xl text-sm bg-input text-main placeholder-muted outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-[var(--accent-red)] text-sm text-center mb-3 bg-[var(--bg-red-soft)] px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-[var(--accent-green)] text-sm text-center mb-3 bg-[var(--bg-green-soft)] px-3 py-2 rounded-lg">{success}</p>}
          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-input border border-main rounded-xl font-semibold text-sm text-muted hover:bg-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 py-2.5 px-4 btn-accent rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60"
            >
              {sending ? 'Sending...' : '📧 Send Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmailReportModal;
