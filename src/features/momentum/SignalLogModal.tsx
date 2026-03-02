/**
 * SignalLogModal — Manual signal entry modal
 *
 * Dropdown for opportunity + signal type → POST /api/signals.
 * Toast: "Warmth: 78 -> 85 (+7)"
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Opportunity {
  id: string;
  account_name: string;
  warmth_score: number;
}

interface SignalLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunities: Opportunity[];
  selectedOpportunityId?: string;
  onSubmit: (oppId: string, eventType: string, payload?: any) => Promise<void>;
}

const SIGNAL_TYPES = [
  { value: 'MEETING_BOOKED', label: 'Meeting Booked' },
  { value: 'MEETING_COMPLETED', label: 'Meeting Completed' },
  { value: 'OUTREACH_REPLIED_POSITIVE', label: 'Replied (Positive)', eventType: 'OUTREACH_REPLIED', payload: { sentiment: 'positive' } },
  { value: 'OUTREACH_REPLIED_NEUTRAL', label: 'Replied (Neutral)', eventType: 'OUTREACH_REPLIED', payload: { sentiment: 'neutral' } },
  { value: 'OUTREACH_CLICKED', label: 'Clicked Link' },
  { value: 'OUTREACH_OPENED', label: 'Opened Email' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'SIGNAL_LOGGED', label: 'Manual Note' },
];

const SignalLogModal: React.FC<SignalLogModalProps> = ({
  isOpen,
  onClose,
  opportunities,
  selectedOpportunityId,
  onSubmit,
}) => {
  const [oppId, setOppId] = useState(selectedOpportunityId || '');
  const [signalType, setSignalType] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset when opening
  React.useEffect(() => {
    if (isOpen) {
      setOppId(selectedOpportunityId || '');
      setSignalType('');
      setNote('');
    }
  }, [isOpen, selectedOpportunityId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oppId || !signalType) return;

    setSubmitting(true);
    try {
      const config = SIGNAL_TYPES.find(s => s.value === signalType);
      const eventType = config?.eventType || signalType;
      const payload = { ...config?.payload };
      if (note) payload.description = note;

      await onSubmit(oppId, eventType, Object.keys(payload).length > 0 ? payload : undefined);
      onClose();
    } catch (err) {
      console.error('[SignalLogModal] Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-white font-semibold text-base">Log Signal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Opportunity selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Opportunity</label>
            <select
              value={oppId}
              onChange={(e) => setOppId(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select opportunity...</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.account_name} ({o.warmth_score})
                </option>
              ))}
            </select>
          </div>

          {/* Signal type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Signal Type</label>
            <select
              value={signalType}
              onChange={(e) => setSignalType(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Select signal type...</option>
              {SIGNAL_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Optional note */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Met at NYC construction expo"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!oppId || !signalType || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? 'Logging...' : 'Log Signal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignalLogModal;
