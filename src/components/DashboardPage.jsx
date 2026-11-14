import React, { useMemo } from 'react';
import { Users, UserCheck, UserX, Percent, ArrowRight, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DashboardPage({ employees, attendance, history, currentMonth, currentYear, setActivePage }) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const activeRoster = useMemo(() => employees.filter(e => !e.isDeleted), [employees]);

  const stats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    const chartData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      let dailyPresent = 0;
      
      activeRoster.forEach(emp => {
        const status = attendance[emp.id]?.[dateKey];
        if (status === 'present' || status === 'late' || status === 'early') {
          totalPresent++;
          dailyPresent++;
          if (status === 'late') totalLate++;
        } else if (status === 'absent') {
          totalAbsent++;
        }
      });
      chartData.push({ day, present: dailyPresent, total: activeRoster.length });
    }

    const totalMarks = totalPresent + totalAbsent;
    const attendanceRate = totalMarks > 0 ? Math.round((totalPresent / totalMarks) * 100) : 0;

    return { totalPresent, totalAbsent, totalLate, attendanceRate, chartData };
  }, [attendance, activeRoster, daysInMonth, currentMonth, currentYear]);

  const recentActivity = history.slice(0, 5);

  return (
    <div style={{ padding: '19px', flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: 'var(--bg-body)' }}>
      
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Dashboard Overview</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Summary for {MONTHS[currentMonth]} {currentYear}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent-blue)', padding: '9px', borderRadius: '50%', color: 'var(--accent-blue-text)' }}><Users size={24} /></div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Employees</p>
            <p style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-main)' }}>{activeRoster.length}</p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--status-p-bg)', padding: '9px', borderRadius: '50%', color: 'var(--status-p-text)' }}><UserCheck size={24} /></div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Present</p>
            <p style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalPresent}</p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent-red)', padding: '9px', borderRadius: '50%', color: 'var(--accent-red-text)' }}><UserX size={24} /></div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Absent</p>
            <p style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalAbsent}</p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent-yellow)', padding: '9px', borderRadius: '50%', color: 'var(--accent-yellow-text)' }}><Percent size={24} /></div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Avg Attendance</p>
            <p style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-main)' }}>{stats.attendanceRate}%</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        
        <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '15px' }}>Daily Attendance (Present vs Total)</h2>
          {/* Explicit pixel height: a percentage height inside a flex child resolves to 0 and hides the chart */}
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-hover)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                />
                <Bar dataKey="total" name="Total Staff" fill="var(--border-color)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="present" name="Present" fill="var(--status-p-text)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px' }}>Quick Actions</h2>
            <button onClick={() => setActivePage('register')} style={{ width: '100%', padding: '9px', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--text-main)' }}>
              Go to Register <ArrowRight size={16} color="var(--text-muted)" />
            </button>
            <button onClick={() => setActivePage('email')} style={{ width: '100%', padding: '9px', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--text-main)' }}>
              Generate Email Report <ArrowRight size={16} color="var(--text-muted)" />
            </button>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={18} color="var(--text-muted)"/> Recent Activity
            </h2>
            {recentActivity.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No recent activity.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActivity.map((item, idx) => (
                  <div key={idx} style={{ borderBottom: idx !== recentActivity.length -1 ? '1px solid var(--border-color)' : 'none', paddingBottom: idx !== recentActivity.length -1 ? '12px' : '0' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-main)', margin: 0, fontWeight: 500 }}>
                      {item.type === 'employee' ? <>{item.employeeName}: <strong style={{ color: (item.status === 'Employee Deleted' || item.status === 'Employee Permanently Deleted') ? 'var(--status-a-text)' : (item.status === 'Employee Added' || item.status === 'Employee Restored') ? 'var(--status-p-text)' : 'var(--accent-blue-text)' }}>{item.status}</strong></> : <>{item.employeeName} was marked <strong style={{ color: item.status === 'Present' ? 'var(--status-p-text)' : item.status === 'Absent' ? 'var(--status-a-text)' : 'var(--text-muted)' }}>{item.status}</strong>
                    </>}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      By {item.editor} • {new Date(item.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}