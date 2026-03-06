import React from 'react';
import { ArrowLeft, Share2, Clipboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DealRoom } from '../../types/dealRoom';

interface DealRoomHeaderProps {
  room: DealRoom;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function getRoomSubtitle(room: DealRoom): string {
  switch (room.room_type) {
    case 'bid': return 'District Intelligence';
    case 'aec': return 'Scan & Model';
    default: return 'General';
  }
}

const DealRoomHeader: React.FC<DealRoomHeaderProps> = ({ room }) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B1120]">
      {/* Left: Back nav + room info */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/deal-rooms')}
          className="flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          <span>Deal Rooms</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Clipboard size={20} className="text-white/70" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{room.name}</h1>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <span>{getRoomSubtitle(room)}</span>
              {room.warmth_score > 0 && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {room.warmth_score >= 90 ? 'Takeover Ready' : 'Warming'} {room.warmth_score}/100
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Stats + Share button */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-white/40">
          {room.source_count} sources · {room.message_count} messages · {formatDate(room.created_at)}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/80 hover:bg-white/5 transition-colors text-sm">
          <Share2 size={14} />
          Share Room
        </button>
      </div>
    </div>
  );
};

export default DealRoomHeader;
