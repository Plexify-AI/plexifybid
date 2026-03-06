import React, { useState } from 'react';
import { X, Briefcase, Loader2 } from 'lucide-react';
import { useSandbox } from '../../../contexts/SandboxContext';

interface CreateDealRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (dealRoomId: string) => void;
  defaultName?: string;
  opportunityId?: string;
}

const CreateDealRoomDialog: React.FC<CreateDealRoomDialogProps> = ({
  isOpen,
  onClose,
  onCreated,
  defaultName = '',
  opportunityId,
}) => {
  const { token } = useSandbox();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState<'aec' | 'bid' | 'general'>('aec');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim() || !token) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/deal-rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          room_type: roomType,
          opportunity_id: opportunityId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' }));
        throw new Error(err.error || 'Create failed');
      }

      const data = await res.json();
      onCreated(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-emerald-400" />
            <h2 className="text-white font-semibold">Create Deal Room</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Room Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Golden Triangle BID"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this deal room..."
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Room Type</label>
            <div className="flex gap-2">
              {[
                { value: 'aec', label: 'AEC' },
                { value: 'bid', label: 'BID' },
                { value: 'general', label: 'General' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRoomType(opt.value as any)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    roomType === opt.value
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium transition-colors"
          >
            {creating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Room'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateDealRoomDialog;
