/**
 * DealRoomListPage — Lists all deal rooms for the tenant.
 *
 * Shows a grid of deal room cards with source/message counts,
 * plus a "Create Deal Room" dialog.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Plus, MessageSquare, FileText, Clock,
  Loader2, ArrowRight, FolderOpen
} from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

interface DealRoom {
  id: string;
  name: string;
  description?: string;
  status: string;
  source_count: number;
  message_count: number;
  created_at: string;
  updated_at: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}

const DealRoomListPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useSandbox();
  const [rooms, setRooms] = useState<DealRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/deal-rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load deal rooms');
      const data = await res.json();
      setRooms(data.deal_rooms || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreate = async () => {
    if (!createName.trim() || !token) return;
    setCreating(true);
    try {
      const res = await fetch('/api/deal-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create deal room');
      const room = await res.json();
      // Navigate to the new room
      navigate(`/deal-rooms/${room.id}`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Briefcase size={22} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Deal Rooms</h1>
              <p className="text-sm text-blue-300/70">Upload documents, get AI-powered deal intelligence</p>
            </div>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Deal Room
          </button>
        </div>

        {/* Create Dialog */}
        {showCreate && (
          <div className="mb-6 bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Create Deal Room</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Hexagon Safety — 175 Greenwich"
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Brief description of this deal..."
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={!createName.trim() || creating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Create
                </button>
                <button
                  onClick={() => { setShowCreate(false); setCreateName(''); setCreateDesc(''); }}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading deal rooms...</span>
            </div>
          </div>
        ) : rooms.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/50 border border-gray-700/40 flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={28} className="text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No deal rooms yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Create a deal room to upload proposals, RFPs, and market reports. Plexi will analyze them and answer your questions with source citations.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Create Your First Deal Room
            </button>
          </div>
        ) : (
          /* Room Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/deal-rooms/${room.id}`)}
                className="group text-left bg-gray-800/40 border border-gray-700/40 rounded-xl p-5 hover:bg-gray-800/60 hover:border-gray-600/50 transition-all overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                      <Briefcase size={17} className="text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                        {room.name}
                      </h3>
                      {room.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 overflow-hidden text-ellipsis">{room.description}</p>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-600 group-hover:text-blue-400 transition-colors shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-4 text-[11px] text-gray-500">
                  <div className="flex items-center gap-1">
                    <FileText size={12} />
                    <span>{room.source_count} source{room.source_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare size={12} />
                    <span>{room.message_count} message{room.message_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <Clock size={12} />
                    <span>{timeAgo(room.updated_at)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealRoomListPage;
