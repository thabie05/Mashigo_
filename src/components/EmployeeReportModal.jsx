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
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', 
        zIndex: 9999, padding: '20px', backdropFilter: 'blur(2px)' 
      }} 
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '900px', 
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', 
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid #e0e0e0', 
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#333', margin: 0 }}>
            📋 {employee.name} – {year} Attendance Report
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#888', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', padding: '16px 8px', borderRadius: '8px', backgroundColor: '#f4fbf7', border: '1px solid #d1f2e5' }}>
              <span style={{ display: 'block', fontSize: '11px', color: '#0f9d58', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>✓ Present</span>
              <strong style={{ fontSize: '24px', color: '#333' }}>{totalPresent}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '16px 8px', borderRadius: '8px', backgroundColor: '#fefbf3', border: '1px solid #fef7e0' }}>
              <span style={{ display: 'block', fontSize: '11px', color: '#f29900', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>⏰ Late</span>
              <strong style={{ fontSize: '24px', color: '#333' }}>{totalLate}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '16px 8px', borderRadius: '8px', backgroundColor: '#f3f8fe', border: '1px solid #e8f0fe' }}>
              <span style={{ display: 'block', fontSize: '11px', color: '#1a73e8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>🚪 Early</span>
              <strong style={{ fontSize: '24px', color: '#333' }}>{totalEarly}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '16px 8px', borderRadius: '8px', backgroundColor: '#fdf5f5', border: '1px solid #fce8e6' }}>
              <span style={{ display: 'block', fontSize: '11px', color: '#d93025', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>✗ Absent</span>
              <strong style={{ fontSize: '24px', color: '#333' }}>{totalAbsent}</strong>
            </div>
            <div style={{ textAlign: 'center', padding: '16px 8px', borderRadius: '8px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
              <span style={{ display: 'block', fontSize: '11px', color: '#666', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>📋 Off Duty</span>
              <strong style={{ fontSize: '24px', color: '#333' }}>{totalOffDuty}</strong>
            </div>
          </div>

          {/* Chart */}
          <div style={{ width: '100%', height: '300px', marginBottom: '32px', backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  itemStyle={{ color: '#333' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Present" fill="#34a853" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Late" fill="#fbbc04" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Early" fill="#4285f4" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Absent" fill="#ea4335" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="OffDuty" fill="#9e9e9e" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

                {/* Table */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
          <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase', width: '25%' }}>Month</th>
              <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#34a853', fontSize: '11px', textTransform: 'uppercase', width: '12.5%' }}>Present</th>
              <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#fbbc04', fontSize: '11px', textTransform: 'uppercase', width: '12.5%' }}>Late</th>
              <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#4285f4', fontSize: '11px', textTransform: 'uppercase', width: '12.5%' }}>Early</th>
              <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#ea4335', fontSize: '11px', textTransform: 'uppercase', width: '12.5%' }}>Absent</th>
              <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase', width: '12.5%' }}>Off Duty</th>
              <th style={{ textAlign: 'center', padding: '12px', fontWeight: 600, color: '#333', fontSize: '11px', textTransform: 'uppercase', width: '12.5%' }}>Worked</th>
            </tr>
          </thead>
              <tbody>
                {report.map((m) => (
                  <tr key={m.month} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px', fontWeight: 500, color: '#333' }}>{m.month}</td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#0f9d58', fontWeight: 600 }}>{m.Present}</td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#f29900', fontWeight: 600 }}>{m.Late}</td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#1a73e8', fontWeight: 600 }}>{m.Early}</td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#d93025', fontWeight: 600 }}>{m.Absent}</td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#888', fontWeight: 600 }}>{m.OffDuty}</td>
                    <td style={{ textAlign: 'center', padding: '12px', color: '#333', fontWeight: 700 }}>{m.Present + m.Late + m.Early}</td>
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