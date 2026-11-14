import React from 'react';
import { RotateCcw, Trash2, ArchiveX, ArrowLeft } from 'lucide-react';

export const RETENTION_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export const daysLeft = (emp) => {
  if (!emp.deletedAt) return null; // deleted before dates were tracked: never auto-purged
  const elapsed = Math.floor((Date.now() - new Date(emp.deletedAt).getTime()) / DAY_MS);
  return Math.max(0, RETENTION_DAYS - elapsed);
};

export default function DeletedEmployeesPage({ employees, canManage, onRestore, onPurge, onBack }) {
  const deleted = employees
    .filter((e) => e.isDeleted)
    .sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));

  const btn = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' };

  return (
    <div style={{ padding: '19px', flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: 'var(--bg-body)' }}>
      {onBack && (
        <button type="button" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '0 12px', height: '30px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          <ArrowLeft size={13} /> Back to Register
        </button>
      )}
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <ArchiveX size={22} color="var(--accent-green-text)" /> Deleted Employees
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          Deleted employees are kept for {RETENTION_DAYS} days. Restore them before then, or they are removed permanently.
        </p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '560px' }}>
            <thead style={{ background: 'var(--bg-header)' }}>
              <tr>
                {['Employee', 'Deleted on', 'Time left', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deleted.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>No deleted employees.</td></tr>
              ) : deleted.map((emp) => {
                const left = daysLeft(emp);
                const urgent = left !== null && left <= 7;
                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '9px', fontWeight: 500, color: 'var(--text-main)' }}>{emp.name}</td>
                    <td style={{ padding: '9px', color: 'var(--text-muted)' }}>
                      {emp.deletedAt ? new Date(emp.deletedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown (older deletion)'}
                    </td>
                    <td style={{ padding: '9px' }}>
                      {left === null ? (
                        <span style={{ color: 'var(--text-muted)' }}>Kept until removed manually</span>
                      ) : (
                        <span style={{ fontWeight: 600, color: urgent ? 'var(--status-a-text)' : 'var(--text-main)' }}>{left} day{left === 1 ? '' : 's'} left</span>
                      )}
                    </td>
                    <td style={{ padding: '9px' }}>
                      {canManage ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" onClick={() => onRestore(emp)} style={{ ...btn, border: '1px solid var(--status-p-text)', background: 'var(--status-p-bg)', color: 'var(--status-p-text)' }}><RotateCcw size={12} /> Restore</button>
                          <button type="button" onClick={() => onPurge(emp)} style={{ ...btn, border: '1px solid var(--status-a-text)', background: 'var(--status-a-bg)', color: 'var(--status-a-text)' }}><Trash2 size={12} /> Delete permanently</button>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}