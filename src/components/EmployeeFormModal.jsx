import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserCog } from 'lucide-react';

const FIELDS = [
  { key: 'name', label: 'Full name', required: true, placeholder: 'e.g. Thabelo Tshishonga', full: true },
  { key: 'employeeNumber', label: 'Employee number', placeholder: 'e.g. 0012' },
  { key: 'position', label: 'Job title', placeholder: 'e.g. Carpenter' },
  { key: 'phone', label: 'Phone', placeholder: 'e.g. 082 123 4567', type: 'tel' },
  { key: 'email', label: 'Email', placeholder: 'name@example.com', type: 'email' },
  { key: 'startDate', label: 'Start date', type: 'date' },
];

const input = { width: '100%', boxSizing: 'border-box', height: '34px', padding: '0 10px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-main)', outline: 'none' };

export default function EmployeeFormModal({ employee, onSubmit, onClose }) {
  const editing = !!employee;
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, employee?.[f.key] || ''])));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const set = (k, v) => { setValues((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: '' })); setFormError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    const errs = {};
    if (!clean.name) errs.name = 'Enter the employee’s full name.';
    if (clean.email && !/^\S+@\S+\.\S+$/.test(clean.email)) errs.email = 'Enter a valid email address.';
    if (clean.phone && !/^[\d\s+()-]{7,}$/.test(clean.phone)) errs.phone = 'Enter a valid phone number.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const msg = await onSubmit(clean);
    if (msg) { setFormError(msg); setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '15px', backdropFilter: 'blur(2px)' }} onClick={() => !saving && onClose()}>
      <form onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 50px var(--shadow-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
          {editing ? <UserCog size={20} color="var(--accent-green-text)" /> : <UserPlus size={20} color="var(--accent-green-text)" />}
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', flex: 1 }}>{editing ? 'Edit employee' : 'Add employee'}</h3>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 12px' }}>
          {FIELDS.map((f) => (
            <label key={f.key} style={{ gridColumn: f.full ? '1 / -1' : 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              <span>{f.label}{f.required && <span style={{ color: 'var(--accent-red-text)' }}> *</span>}</span>
              <input
                type={f.type || 'text'} value={values[f.key]} placeholder={f.placeholder} autoFocus={f.key === 'name'}
                onChange={(e) => set(f.key, e.target.value)}
                style={{ ...input, borderColor: errors[f.key] ? 'var(--accent-red-text)' : 'var(--border-color)' }}
              />
              {errors[f.key] && <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--accent-red-text)' }}>{errors[f.key]}</span>}
            </label>
          ))}
          {formError && <div role="alert" style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--accent-red-text)', background: 'var(--accent-red)', borderRadius: '6px', padding: '8px 10px' }}>{formError}</div>}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '12px 18px 16px', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0 16px', height: '32px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '0 18px', height: '32px', background: 'var(--accent-green-text)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#fff', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}</button>
        </div>
      </form>
    </div>
  );
}
