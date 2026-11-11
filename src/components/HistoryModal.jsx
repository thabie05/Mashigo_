import React from 'react';

function HistoryModal({ history, onClose }) {
  const sortedHistory = [...history].sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt));

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-5" onClick={onClose}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col relative border border-main"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-accent">📋 Attendance Edit History</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-main text-2xl leading-none transition"
          >
            &times;
          </button>
        </div>

        {sortedHistory.length === 0 ? (
          <p className="text-muted">No edits recorded yet.</p>
        ) : (
          <div className="overflow-y-auto flex-1 border border-main rounded-lg custom-scrollbar">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-input z-10">
                <tr>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent w-12">Type</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Editor</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Employee</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Day</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Date</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Status</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Note</th>
                  <th className="font-semibold py-2 px-3 text-left border-b border-main text-accent">Time</th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((entry) => {
                  const isFingerprint = entry.editor === 'Fingerprint Kiosk';
                  return (
                    <tr
                      key={entry.id}
                      className={isFingerprint ? 'bg-accent-light' : 'even:bg-card'}
                    >
                      <td className="py-2 px-3 border-b border-main text-center">
                        {isFingerprint ? '🖐️' : '✏️'}
                      </td>
                      <td className="py-2 px-3 border-b border-main text-main">
                        {entry.editor}
                      </td>
                      <td className="py-2 px-3 border-b border-main text-main">
                        {entry.employeeName}
                      </td>
                      <td className="py-2 px-3 border-b border-main text-main">
                        {entry.day}
                      </td>
                      <td className="py-2 px-3 border-b border-main text-main">
                        {entry.date}
                      </td>
                      <td
                        className={`py-2 px-3 border-b border-main ${
                          entry.status.includes('fingerprint')
                            ? 'text-accent font-semibold'
                            : 'text-main'
                        }`}
                      >
                        {entry.status}
                      </td>
                      <td className="py-2 px-3 border-b border-main text-muted">
                        {entry.note || '-'}
                      </td>
                      <td className="py-2 px-3 border-b border-main text-muted">
                        {new Date(entry.editedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryModal;
