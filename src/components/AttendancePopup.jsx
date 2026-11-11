import React from 'react';
import { createPortal } from 'react-dom';

function AttendancePopup({ popup, popupNote, setPopupNote, popupRef, onMark, isAdmin, onConfirmClear, isLocked }) {
  if (!popup) return null;

  const showStatusButtons = isAdmin || !isLocked;

  // Adjust position if it goes off screen
  const isMobile = window.innerWidth <= 768;
  let popupStyle = {
    position: 'absolute', zIndex: 1000,
    background: '#fff', padding: '12px', borderRadius: '8px', 
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e0e0e0',
    minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '8px',
    left: popup.x, top: popup.y
  };

  if (isMobile) {
    // On mobile, center it or constrain it to the viewport
    popupStyle.left = Math.max(10, Math.min(popup.x, window.innerWidth - 270));
    popupStyle.top = Math.min(popup.y, window.innerHeight - 250);
  } else {
    // On desktop, just make sure it doesn't fall off the right edge
    if (popup.x + 250 > window.innerWidth) {
      popupStyle.left = popup.x - 250; 
    }
  }

  const btnStyle = {
    padding: '8px 12px', borderRadius: '6px', fontSize: '13px', 
    fontWeight: '600', cursor: 'pointer', border: '1px solid #e0e0e0', 
    transition: 'all 0.2s'
  };

  return createPortal(
    <div
      ref={popupRef}
      className="attendance-popup"
      style={popupStyle}
    >
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {showStatusButtons ? (
          <>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'present', popupNote)} style={{...btnStyle, background: '#d1f2e5', color: '#0f9d58'}}>✓ Present</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'absent', popupNote)} style={{...btnStyle, background: '#fce8e6', color: '#d93025'}}>✗ Absent</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'late', popupNote)} style={{...btnStyle, background: '#fef7e0', color: '#f29900'}}>⏰ Late</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'early', popupNote)} style={{...btnStyle, background: '#e8f0fe', color: '#1a73e8'}}>🚪 Early</button>
            <button onClick={() => onMark(popup.employeeId, popup.day, 'off', popupNote)} style={{...btnStyle, background: '#f0f0f0', color: '#666'}}>📋 Off</button>
          </>
        ) : (
          <div style={{ width: '100%', textAlign: 'center', padding: '8px 0' }}>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>This cell is locked.</p>
          </div>
        )}

        {isAdmin && (
          <button onClick={() => onConfirmClear(popup.employeeId, popup.day)} style={{...btnStyle, background: '#fff', color: '#d93025', border: '1px solid #d93025', width: '100%', marginTop: '4px'}}>
            🗑️ Clear Mark
          </button>
        )}
      </div>

      {showStatusButtons && (
        <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '8px', marginTop: '4px' }}>
          <input
            type="text"
            placeholder="Add a note..."
            value={popupNote}
            onChange={(e) => setPopupNote(e.target.value)}
            style={{
              width: '100%', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '4px', 
              fontSize: '12px', outline: 'none'
            }}
          />
        </div>
      )}
    </div>,
    document.body
  );
}

export default AttendancePopup;