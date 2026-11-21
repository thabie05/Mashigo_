import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DatabaseBackup, Download, Upload, RotateCcw, Trash2, ArrowLeft } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import {
  createBackup, listBackups, deleteBackup, restoreSnapshot, buildBackupFile, downloadJson,
  backupFileName, parseBackupFile, restoreFromFile, KEEP_AUTO,
} from '../utils/backup';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', marginBottom: '16px' };
const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 12px', height: '30px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' };
const primary = { ...btn, background: 'var(--accent-green-text)', color: '#fff', border: 'none' };
const kindLabel = { auto: 'Automatic', manual: 'Manual', safety: 'Safety copy' };

export default function BackupPage({ currentUser, onBack }) {
  const who = currentUser?.fullName || currentUser?.username || 'Admin';
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const fileRef = useRef(null);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 6000); };

  const refresh = useCallback(async () => {
    try { setBackups(await listBackups()); } catch (e) { flash('error', 'Could not load backups: ' + e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) flash('success', ok); await refresh(); }
    catch (e) { flash('error', e.message); }
    setBusy(false);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseBackupFile(await file.text());
      const n = (parsed.rollcall.employees || []).length;
      setConfirm({
        title: 'Restore from file?',
        label: 'Restore',
        message: `This replaces ALL current data with the file (${n} employees, exported ${new Date(parsed.exportedAt).toLocaleString()}). A safety copy of the current data is taken first.`,
        action: () => run(() => restoreFromFile(parsed, who), 'Restored from file.'),
      });
    } catch (err) { flash('error', err.message); }
  };

  return (
    <div style={{ padding: '19px', flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: 'var(--bg-body)' }}>
      {onBack && <button type="button" onClick={onBack} style={{ ...btn, marginBottom: '12px' }}><ArrowLeft size={13} /> Back to Register</button>}
      <h1 style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <DatabaseBackup size={22} color="var(--accent-green-text)" /> Backup &amp; Restore
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '14px' }}>
        A snapshot is saved automatically once a day (the last {KEEP_AUTO} are kept). Download a file now and then and keep it somewhere safe, such as Google Drive or a USB stick.
      </p>

      {msg && <div style={{ padding: '9px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', background: msg.type === 'error' ? 'var(--status-a-bg)' : 'var(--status-p-bg)', color: msg.type === 'error' ? 'var(--status-a-text)' : 'var(--status-p-text)', border: `1px solid ${msg.type === 'error' ? 'var(--status-a-text)' : 'var(--status-p-text)'}` }}>{msg.text}</div>}

      <div style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button type="button" disabled={busy} style={primary} onClick={() => run(() => createBackup('manual', 'Manual backup', who), 'Backup saved.')}><DatabaseBackup size={13} /> Back up now</button>
          <button type="button" disabled={busy} style={btn} onClick={() => run(async () => downloadJson(await buildBackupFile(), backupFileName()), 'Backup file downloaded.')}><Download size={13} /> Download backup file</button>
          <button type="button" disabled={busy} style={btn} onClick={() => fileRef.current?.click()}><Upload size={13} /> Restore from file…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: 'none' }} />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '10px' }}>The file includes employees, attendance, notes, history and enrolled fingerprints. It does not include user logins or passwords.</p>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '640px' }}>
            <thead style={{ background: 'var(--bg-header)' }}>
              <tr>{['Saved', 'Type', 'Employees', 'Marks', 'By', 'Actions'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
                : backups.length === 0 ? <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No backups yet. Press “Back up now”.</td></tr>
                : backups.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '9px', color: 'var(--text-main)' }}>{new Date(b.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '9px', color: 'var(--text-muted)' }}>{kindLabel[b.kind] || b.kind}{b.kind === 'safety' ? ` · ${b.label}` : ''}</td>
                    <td style={{ padding: '9px' }}>{b.summary?.employees ?? '—'}</td>
                    <td style={{ padding: '9px' }}>{b.summary?.marks ?? '—'}</td>
                    <td style={{ padding: '9px', color: 'var(--text-muted)' }}>{b.createdBy}</td>
                    <td style={{ padding: '9px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" disabled={busy} style={{ ...btn, height: '26px' }} onClick={() => setConfirm({
                          title: 'Restore this backup?', label: 'Restore',
                          message: `Everything will be set back to ${new Date(b.createdAt).toLocaleString()} (${b.summary?.employees ?? '?'} employees, ${b.summary?.marks ?? '?'} marks). Changes made since then will be lost, but a safety copy of the current data is taken first.`,
                          action: () => run(() => restoreSnapshot(b, who), 'Backup restored.'),
                        })}><RotateCcw size={12} /> Restore</button>
                        <button type="button" disabled={busy} style={{ ...btn, height: '26px', color: 'var(--status-a-text)' }} onClick={() => setConfirm({
                          title: 'Delete backup?', label: 'Delete', message: 'This snapshot will be removed.',
                          action: () => run(() => deleteBackup(b.id), 'Backup deleted.'),
                        })}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && <ConfirmModal title={confirm.title} confirmLabel={confirm.label} message={confirm.message} onCancel={() => setConfirm(null)} onConfirm={() => { const a = confirm.action; setConfirm(null); a(); }} />}
    </div>
  );
}