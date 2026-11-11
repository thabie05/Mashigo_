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
    if (s === 'present') return { color: '#0f9d58', bg: '#d1f2e5', icon: <CheckCircle size={14} /> };
    if (s === 'absent') return { color: '#d93025', bg: '#fce8e6', icon: <XCircle size={14} /> };
    if (s === 'late') return { color: '#f29900', bg: '#fef7e0', icon: <Clock size={14} /> };
    if (s === 'early' || s === 'early leave') return { color: '#1a73e8', bg: '#e8f0fe', icon: <DoorOpen size={14} /> };
    if (s === 'off duty') return { color: '#5f6368', bg: '#f1f3f4', icon: <Users size={14} /> };
    return { color: '#888888', bg: '#f8f9fa', icon: <AlertCircle size={14} /> };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d} ${monthNames[parseInt(m) - 1]} ${y}`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '25px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock color="#0f9d58" size={28} />
            History & Logs
          </h1>
          <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>View all attendance changes and edits</p>
        </div>
        <div style={{ fontSize: '13px', color: '#888', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '8px 16px' }}>
          Total Entries: <span style={{ fontWeight: 600, color: '#333' }}>{filteredHistory.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="#888" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" placeholder="Search employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <Filter size={16} color="#888" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', outline: 'none', appearance: 'none' }}>
            {statuses.map((status) => (
              <option key={status} value={status}>{status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
          <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <Calendar size={16} color="#888" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input type="month" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', outline: 'none', appearance: 'none' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="employee">Sort by Employee</option>
          </select>
          <ChevronDown size={16} color="#888" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* History Table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
              <tr>
                {['Time', 'Employee', 'Date', 'Status', 'Editor', 'Note'].map((head) => (
                  <th key={head} style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: '#888', fontSize: '11px', textTransform: 'uppercase' }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#888' }}>No history entries found.</td></tr>
              ) : (
                filteredHistory.map((entry, idx) => {
                  const style = getStatusStyle(entry.status);
                  return (
                    <tr key={entry.id || idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                      <td style={{ padding: '12px', color: '#888', fontSize: '12px' }}>{formatTime(entry.editedAt)}</td>
                      <td style={{ padding: '12px', fontWeight: 500, color: '#333' }}>{entry.employeeName || 'Unknown'}</td>
                      <td style={{ padding: '12px', color: '#888' }}>{formatDate(entry.date)}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: style.color, background: style.bg }}>
                          {style.icon} {entry.status || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#888' }}>{entry.editor || 'System'}</td>
                      <td style={{ padding: '12px', color: '#888', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.note || '—'}</td>
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