import React, { useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface AbandonSessionModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when abandon is confirmed */
  onConfirm: (reason: string) => Promise<void>;
  /** Whether abandon is in progress */
  loading?: boolean;
}

/**
 * Modal for confirming session abandonment with optional reason.
 */
export function AbandonSessionModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: AbandonSessionModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = useCallback(async () => {
    await onConfirm(reason.trim());
    setReason('');
  }, [reason, onConfirm]);

  const handleClose = useCallback(() => {
    if (!loading) {
      setReason('');
      onClose();
    }
  }, [loading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md transform rounded-lg bg-white shadow-xl transition-all"
          role="dialog"
          aria-modal="true"
          aria-labelledby="abandon-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3
                id="abandon-modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                Abandon Session
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 mb-4">
              Abandoning this session will mark it as incomplete. No handoff will be generated.
              You can optionally provide a reason for future reference.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for abandoning
              <span className="font-normal text-gray-500 ml-1">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={loading}
              placeholder="e.g., Context switch to higher priority task, blocked by external dependency..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300
                         disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                         rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg
                         hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Abandoning...' : 'Abandon Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AbandonSessionModal;
