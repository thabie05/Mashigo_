import React from 'react';
import { createPortal } from 'react-dom';

function ContextMenu({ contextMenu, contextMenuRef, onViewReport, onRename, onEnrollFingerprint, onDelete }) {
  if (!contextMenu) return null;

  return createPortal(
    <div
      ref={contextMenuRef}
      className="absolute bg-card rounded-xl shadow-2xl border border-main p-1.5 flex flex-col gap-0.5 z-[1500] min-w-[180px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        onClick={onViewReport}
        className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-accent-light text-main flex items-center gap-2"
      >
        📊 View Report
      </button>
      <button
        onClick={onRename}
        className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-accent-light text-main flex items-center gap-2"
      >
        ✏️ Rename
      </button>
      <button
        onClick={onEnrollFingerprint}
        className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-accent-light text-main flex items-center gap-2"
      >
        <img src="/fingerprint-icon.png" alt="" className="w-4 h-4 object-contain" />
        Enroll Fingerprint
      </button>
      <button
        onClick={onDelete}
        className="bg-transparent text-left py-2.5 px-3.5 rounded-lg text-sm font-medium transition hover:bg-[var(--bg-red-soft)] text-[var(--accent-red)] flex items-center gap-2"
      >
        🗑️ Delete
      </button>
    </div>,
    document.body
  );
}

export default ContextMenu;
