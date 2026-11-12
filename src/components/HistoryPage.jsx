import React, { useState, useMemo } from 'react';
import {
  Clock, Search, Filter, Calendar, CheckCircle, XCircle,
  AlertCircle, DoorOpen, Users, ChevronDown
} from 'lucide-react';
import { monthNames } from '../utils/holidays';

function HistoryPage({ history }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const filteredHistory = useMemo(() => {
    let filtered = [...history];
    if (searchTerm.trim()) {
      filtered = filtered.filter((entry) => entry.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((entry) => entry.status?.toLowerCase() === statusFilter.toLowerCase());
    }
    if (dateFilter) {
      filtered = filtered.filter((entry) => entry.date?.startsWith(dateFilter));
    }
    if (sortBy === 'newest') filtered.sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt));
    else if (sortBy === 'oldest') filtered.sort((a, b) => new Date(a.editedAt) - new Date(b.editedAt));
    else if (sortBy === 'employee') filtered.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
    return filtered;
  }, [history, searchTerm, statusFilter, dateFilter, sortBy]);

  const statuses = useMemo(() => {
    const unique = new Set(history.map((entry) => entry.status?.toLowerCase()).filter(Boolean));
    return ['all', ...unique];
  }, [history]);

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === 'present') return { color: 'var(--status-p-text)', bg: 'var(--status-p-bg)', icon: <CheckCircle size={14} /> };
    if (s === 'absent') return { color: 'var(--status-a-text)', bg: 'var(--status-a-bg)', icon: <XCircle size={14} /> };
    if (s === 'late') return { color: 'var(--status-l-text)', bg: 'var(--status-l-bg)', icon: <Clock size={14} /> };
    if (s === 'early' || s === 'early leave') return { color: 'var(--status-e-text)', bg: 'var(--status-e-bg)', icon: <DoorOpen size={14} /> };
    if (s === 'off duty') return { color: 'var(--status-o-text)', bg: 'var(--status-o-bg)', icon: <Users size={14} /> };
    return { color: 'var(--text-muted)', bg: 'var(--bg-hover)', icon: <AlertCircle size={14} /> };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d} ${monthNames[parseInt(m) - 1]} ${y}`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    // Include the date: edits from different days were indistinguishable with time only
    return new Date(isoString).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '19px', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-body)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
        <div>
          <h1 style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock color="var(--accent-green-text)" size={28} />
            History & Logs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>View all attendance changes and edits</p>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px' }}>
          Total Entries: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{filteredHistory.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '9px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '6px 9px 6px 27px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', outline: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <Filter size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '6px 9px 6px 27px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', outline: 'none', appearance: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
            {statuses.map((status) => (
              <option key={status} value={status}>{status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
          <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <Calendar size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="month" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: '100%', padding: '6px 9px 6px 27px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', outline: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            style={{ width: '100%', padding: '6px 9px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', outline: 'none', appearance: 'none', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="employee">Sort by Employee</option>
          </select>
          <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead style={{ background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                {['Time', 'Employee', 'Date', 'Status', 'Editor', 'Note'].map((head) => (
                  <th key={head} style={{ textAlign: 'left', padding: '9px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No history entries found.</td></tr>
              ) : (
                filteredHistory.map((entry, idx) => {
                  const style = getStatusStyle(entry.status);
                  return (
                    <tr key={entry.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '9px', color: 'var(--text-muted)', fontSize: '11px' }}>{formatTime(entry.editedAt)}</td>
                      <td style={{ padding: '9px', fontWeight: 500, color: 'var(--text-main)' }}>{entry.employeeName || 'Unknown'}</td>
                      <td style={{ padding: '9px', color: 'var(--text-muted)' }}>{formatDate(entry.date)}</td>
                      <td style={{ padding: '9px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, color: style.color, background: style.bg }}>
                          {style.icon} {entry.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px', color: 'var(--text-muted)' }}>{entry.editor || 'System'}</td>
                      <td title={entry.note || ''} style={{ padding: '9px', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.note || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HistoryPage;