import React from 'react';

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[3000] p-5" onClick={onCancel}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-main text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold text-accent mb-2">Are you sure?</h3>
        <p className="text-muted text-sm mb-5">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-input border border-main rounded-xl font-semibold text-sm text-muted hover:bg-card transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-[var(--accent-red)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--accent-red-hover)] transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
