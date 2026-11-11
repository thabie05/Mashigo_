import React from 'react';
import { createPortal } from 'react-dom';

function AttendancePopup({ popup, popupNote, setPopupNote, popupRef, onMark, isAdmin, isUser, isViewer, onConfirmClear, isLocked }) {
  if (!popup) return null;
  const showStatusButtons = isAdmin || isUser;

  let popupX = popup.x;
  let popupY = popup.y;
  if (typeof window !== 'undefined') {
    const screenWidth = window.innerWidth;
    if (popupX + 500 > screenWidth) popupX = screenWidth - 520; 
    if (popupX < 10) popupX = 10;
  }

  return createPortal(
    <div ref={popupRef} className="absolute rounded-xl shadow-2xl p-3 flex flex-col gap-2 z-[1000] w-max max-w-[95vw]" style={{ left: popupX, top: popupY, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div className="flex flex-row flex-nowrap gap-1.5 overflow-x-auto pb-1">
        {showStatusButtons && (
          <>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'present', popupNote)} className="whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-sm transition border" style={{ backgroundColor: 'var(--status-p-bg)', color: 'var(--status-p-text)', borderColor: 'transparent' }}>✓ Present</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'absent', popupNote)} className="whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-sm transition border" style={{ backgroundColor: 'var(--status-a-bg)', color: 'var(--status-a-text)', borderColor: 'transparent' }}>✗ Absent</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'late', popupNote)} className="whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-sm transition border" style={{ backgroundColor: 'var(--status-l-bg)', color: 'var(--status-l-text)', borderColor: 'transparent' }}>⏰ Late</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'early', popupNote)} className="whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-sm transition border" style={{ backgroundColor: 'var(--status-e-bg)', color: 'var(--status-e-text)', borderColor: 'transparent' }}>🚪 Early</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'off', popupNote)} className="whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-sm transition border" style={{ backgroundColor: 'var(--status-o-bg)', color: 'var(--status-o-text)', borderColor: 'transparent' }}>📋 Off Duty</button>
          </>
        )}
        {isAdmin && (
          <button onClick={() => { if (onConfirmClear) onConfirmClear(popup.employeeId, popup.day); }} className="whitespace-nowrap py-1.5 px-3 rounded-lg font-semibold text-sm transition border" style={{ backgroundColor: 'var(--status-a-bg)', color: 'var(--status-a-text)', borderColor: 'transparent' }}>🗑️ Clear</button>
        )}
      </div>

      {showStatusButtons && (
        <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border-color)' }}>
          <input type="text" placeholder="Add a note (e.g., Doctor's appointment)" value={popupNote} onChange={(e) => setPopupNote(e.target.value)} className="w-full py-1.5 px-2.5 rounded-lg text-xs outline-none transition" style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
        </div>
      )}
    </div>,
    document.body
  );
}

export default AttendancePopup;