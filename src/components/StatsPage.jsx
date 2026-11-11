import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { monthNames } from '../utils/holidays';

function StatsPage({ stats, currentMonth, currentYear, onClose }) {
  // Filter out "Unmarked" and "Weekend" from the stats
  const filteredStats = stats.filter(
    (stat) => stat.name !== 'Unmarked' && stat.name !== 'Weekend'
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-accent">📊 Attendance Statistics</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-main text-2xl leading-none transition"
          >
            &times;
          </button>
        </div>
        <p className="text-muted text-sm mb-4">
          {monthNames[currentMonth]} {currentYear}
        </p>

        <div className="bg-input rounded-xl p-5 border border-main mb-5">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={filteredStats}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                paddingAngle={5}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={true}
              >
                {filteredStats.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="var(--bg-card)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-muted)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {filteredStats.map((stat) => (
            <div
              key={stat.name}
              className="text-center py-3 px-2 rounded-xl bg-input border border-main"
              style={{ borderLeft: `4px solid ${stat.color}` }}
            >
              <span className="block text-xs text-muted mb-1">{stat.name}</span>
              <strong className="text-xl text-main">{stat.value}</strong>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 px-4 btn-accent rounded-lg font-medium text-sm hover:opacity-90 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default StatsPage;
