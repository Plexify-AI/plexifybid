// @ts-nocheck
import React, { useState } from 'react';
import { X, Send, AlertTriangle, Mail, Users } from 'lucide-react';
import { useSandbox } from '../../contexts/SandboxContext';

interface EmailDraft {
  draft_id: string;
  to?: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  subject?: string;
  body_html?: string;
  importance?: string;
  from?: string;
  // Reply-specific
  message_id?: string;
  reply_all?: boolean;
  original_subject?: string;
}

interface EmailPreviewModalProps {
  draft: EmailDraft;
  isReply?: boolean;
  onClose: () => void;
  onSent: () => void;
}

const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  draft,
  isReply = false,
  onClose,
  onSent,
}) => {
  const { token } = useSandbox();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRecipients =
    (draft.to?.length || 0) + (draft.cc?.length || 0);

  const handleSend = async () => {
    setSending(true);
    setError(null);

    try {
      const res = await fetch('/api/email/confirm-send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draft_id: draft.draft_id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send email');
      }

      onSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const formatRecipient = (r: { name?: string; email: string }) =>
    r.name ? `${r.name} <${r.email}>` : r.email;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/40">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              {isReply ? 'Review Reply' : 'Review Email'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning for many recipients */}
          {totalRecipients > 10 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                This email will be sent to {totalRecipients} people. Please review carefully.
              </span>
            </div>
          )}

          {/* From */}
          {draft.from && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">From</label>
              <p className="text-sm text-gray-300 mt-0.5">{draft.from}</p>
            </div>
          )}

          {/* To */}
          {draft.to && draft.to.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Users size={12} />
                To
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {draft.to.map((r, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 text-sm bg-gray-700/50 text-gray-300 rounded"
                  >
                    {formatRecipient(r)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CC */}
          {draft.cc && draft.cc.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">CC</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {draft.cc.map((r, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 text-sm bg-gray-700/50 text-gray-300 rounded"
                  >
                    {formatRecipient(r)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</label>
            <p className="text-sm text-white mt-0.5 font-medium">
              {isReply ? `Re: ${draft.original_subject || ''}` : draft.subject}
            </p>
          </div>

          {/* Importance */}
          {draft.importance && draft.importance !== 'normal' && (
            <div>
              <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                draft.importance === 'high'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {draft.importance === 'high' ? 'High Importance' : 'Low Importance'}
              </span>
            </div>
          )}

          {/* Email body */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Body</label>
            <div
              className="mt-2 p-4 rounded-lg bg-gray-900/50 border border-gray-700/40 text-sm text-gray-300 prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: draft.body_html || '' }}
            />
          </div>

          {/* Reply context */}
          {isReply && draft.reply_all && (
            <p className="text-xs text-gray-500">
              This will reply to all recipients in the thread.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {sending ? 'Sending...' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreviewModal;
