import React from 'react';

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '20px', backdropFilter: 'blur(2px)' }} onClick={onCancel}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '32px 24px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 50px var(--shadow-color)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>⚠️</div>
        <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px 0' }}>Are you sure?</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 28px 0', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', backgroundColor: 'transparent', border: '1.5px solid var(--border-color)', borderRadius: '24px', fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '12px 0', backgroundColor: 'var(--accent-red)', border: 'none', borderRadius: '24px', fontWeight: 600, fontSize: '14px', color: 'var(--accent-red-text)', cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;