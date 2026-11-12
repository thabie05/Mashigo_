import React from 'react';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function EmployeeReportModal({ employee, report, year, onClose }) {
  if (!report || !employee) return null;

  // Calculate totals for the summary cards
  const totalPresent = report.reduce((s, m) => s + (m.Present || 0), 0);
  const totalLate = report.reduce((s, m) => s + (m.Late || 0), 0);
  const totalEarly = report.reduce((s, m) => s + (m.Early || 0), 0);
  const totalAbsent = report.reduce((s, m) => s + (m.Absent || 0), 0);
  const totalOffDuty = report.reduce((s, m) => s + (m.OffDuty || 0), 0);

  const modalContent = (
    <div 
      style={{ 
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', 
        zIndex: 9999, padding: '15px', backdropFilter: 'blur(2px)' 
      }} 
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: 'var(--bg-card)', borderRadius: '12px', width: '100%', maxWidth: '900px', 
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', 
          boxShadow: '0 20px 50px var(--shadow-color)', border: '1px solid var(--border-color)', 
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-header)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            📋 {employee.name} – {year} Attendance Report
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '21px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '18px', overflowY: 'auto' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '9px', marginBottom: '18px' }}>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: '8px', backgroundColor: 'var(--status-p-bg)', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--status-p-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>✓ Present</span>
              <strong style={{ fontSize: '21px', color: 'var(--text-main)' }}>{totalPresent}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: '8px', backgroundColor: 'var(--status-l-bg)', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--status-l-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>⏰ Late</span>
              <strong style={{ fontSize: '21px', color: 'var(--text-main)' }}>{totalLate}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: '8px', backgroundColor: 'var(--status-e-bg)', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--status-e-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>🚪 Early</span>
              <strong style={{ fontSize: '21px', color: 'var(--text-main)' }}>{totalEarly}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: '8px', backgroundColor: 'var(--status-a-bg)', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--status-a-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>✗ Absent</span>
              <strong style={{ fontSize: '21px', color: 'var(--text-main)' }}>{totalAbsent}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 6px', borderRadius: '8px', backgroundColor: 'var(--status-o-bg)', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--status-o-text)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>📋 Off Duty</span>
              <strong style={{ fontSize: '21px', color: 'var(--text-main)' }}>{totalOffDuty}</strong>
            </div>
          </div>

          {/* Chart */}
          <div style={{ width: '100%', height: '300px', marginBottom: '24px', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px var(--shadow-color)', fontSize: '11px', color: 'var(--text-main)' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: 'var(--text-main)' }} />
                <Bar dataKey="Present" fill="var(--status-p-text)" stackId="a" />
                <Bar dataKey="Late" fill="var(--status-l-text)" stackId="a" />
                <Bar dataKey="Early" fill="var(--status-e-text)" stackId="a" />
                <Bar dataKey="Absent" fill="var(--status-a-text)" stackId="a" />
                <Bar dataKey="OffDuty" fill="var(--status-o-text)" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
              <thead style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '9px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', width: '25%' }}>Month</th>
                  <th style={{ textAlign: 'center', padding: '9px 6px', fontWeight: 600, color: 'var(--status-p-text)', fontSize: '10px', textTransform: 'uppercase', width: '12.5%' }}>Present</th>
                  <th style={{ textAlign: 'center', padding: '9px 6px', fontWeight: 600, color: 'var(--status-l-text)', fontSize: '10px', textTransform: 'uppercase', width: '12.5%' }}>Late</th>
                  <th style={{ textAlign: 'center', padding: '9px 6px', fontWeight: 600, color: 'var(--status-e-text)', fontSize: '10px', textTransform: 'uppercase', width: '12.5%' }}>Early</th>
                  <th style={{ textAlign: 'center', padding: '9px 6px', fontWeight: 600, color: 'var(--status-a-text)', fontSize: '10px', textTransform: 'uppercase', width: '12.5%' }}>Absent</th>
                  <th style={{ textAlign: 'center', padding: '9px 6px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', width: '12.5%' }}>Off Duty</th>
                  <th style={{ textAlign: 'center', padding: '9px 6px', fontWeight: 600, color: 'var(--text-main)', fontSize: '10px', textTransform: 'uppercase', width: '12.5%' }}>Worked</th>
                </tr>
              </thead>
              <tbody>
                {report.map((m) => (
                  <tr key={m.month} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '9px', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.month}</td>
                    <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--status-p-text)', fontWeight: 600 }}>{m.Present}</td>
                    <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--status-l-text)', fontWeight: 600 }}>{m.Late}</td>
                    <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--status-e-text)', fontWeight: 600 }}>{m.Early}</td>
                    <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--status-a-text)', fontWeight: 600 }}>{m.Absent}</td>
                    <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--text-muted)', fontWeight: 600 }}>{m.OffDuty}</td>
                    <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--text-main)', fontWeight: 700 }}>{m.Present + m.Late + m.Early}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default EmployeeReportModal;