/**
 * ScanMarketDialog — styled replacement for the native prompt() originally
 * used by DealRoomHeader's "Scan this market" button (Sprint E / E5 polish).
 *
 * Matches brand palette (Deep Louvre Navy card on black overlay, Royal Purple
 * accents, Electric Violet for running state). Keyboard ergonomics:
 *   - Esc       — cancel
 *   - Enter     — submit (matches plain-prompt behavior users expect)
 *   - Shift+Enter — insert newline (multi-line queries)
 *
 * Autofocuses the textarea on open. Disables submit on empty / whitespace.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';

interface Props {
  defaultQuery?: string;
  roomName?: string;
  onSubmit: (query: string) => void;
  onClose: () => void;
  submitting?: boolean;
}

const ScanMarketDialog: React.FC<Props> = ({ defaultQuery = '', roomName, onSubmit, onClose, submitting = false }) => {
  const [query, setQuery] = useState(defaultQuery);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Autofocus + place cursor at end
  useEffect(() => {
    const t = textareaRef.current;
    if (t) {
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    }
  }, []);

  // Global Esc handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const canSubmit = query.trim().length > 0 && !submitting;

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit(query.trim());
    }
  }

  function handleSubmitClick() {
    if (canSubmit) onSubmit(query.trim());
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={() => { if (!submitting) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-market-dialog-title"
    >
      <div
        className="bg-[#0E1A33] border border-purple-500/40 rounded-xl shadow-2xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/40">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-purple-300" />
            <h2 id="scan-market-dialog-title" className="text-base font-semibold text-white">Scan this market</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">
            Research Scanner will run up to 5 web searches on this question and return a structured scan memo with citations.
            {roomName ? <> Anchored to <span className="text-gray-200">{roomName}</span>.</> : null}
          </p>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">
              Question to answer
            </label>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              rows={3}
              placeholder={'e.g. "Recent BID RFPs in Suffolk County Q2 2026" or "Connecticut municipal capital plans with TOD funding"'}
              className="w-full bg-gray-950/60 border border-gray-700/50 rounded px-2.5 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/60 resize-vertical min-h-[72px]"
              disabled={submitting}
            />
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500">
              <span>Enter to scan · Shift+Enter for newline · Esc to cancel</span>
              <span>{query.trim().length} chars</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-700/40 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitClick}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search size={14} />
            {submitting ? 'Queueing\u2026' : 'Scan market'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanMarketDialog;
