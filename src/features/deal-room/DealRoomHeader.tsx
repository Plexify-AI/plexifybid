import React, { useState } from 'react';
import { ArrowLeft, Share2, Clipboard, FileDown, Presentation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSandbox } from '../../contexts/SandboxContext';
import type { DealRoom, DealRoomTab } from '../../types/dealRoom';

interface DealRoomHeaderProps {
  room: DealRoom;
  activeTab?: DealRoomTab;
  editorContent?: string;
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

const TAB_LABELS: Record<string, string> = {
  deal_summary: 'Deal Summary',
  competitive_analysis: 'Competitive Analysis',
  meeting_prep: 'Meeting Prep',
  board_brief: 'Board Brief',
  ozrf_section: 'OZRF Section',
};

const DealRoomHeader: React.FC<DealRoomHeaderProps> = ({ room, activeTab, editorContent }) => {
  const navigate = useNavigate();
  const { token } = useSandbox();
  const [exporting, setExporting] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

  const handleExportDocx = async () => {
    if (!editorContent?.trim() || !token) return;
    setExporting(true);

    try {
      const tabLabel = TAB_LABELS[activeTab || ''] || activeTab || 'Report';
      const filename = `${room.name}_${tabLabel}`.replace(/[^a-zA-Z0-9\-_ ]/g, '');

      const res = await fetch('/api/export/docx', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardBrief: null,
          editorContent,
          filename,
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[DealRoomHeader] DOCX export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPptx = async () => {
    if (!editorContent?.trim() || !token) return;
    setExportingPptx(true);

    try {
      const tabLabel = TAB_LABELS[activeTab || ''] || activeTab || 'Report';
      const filename = `${room.name}_${tabLabel}`.replace(/[^a-zA-Z0-9\-_ ]/g, '');

      const res = await fetch('/api/export/pptx', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ editorContent, filename }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[DealRoomHeader] PPTX export error:', err);
    } finally {
      setExportingPptx(false);
    }
  };

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
        <button
          onClick={handleExportDocx}
          disabled={exporting || !editorContent?.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileDown size={14} />
          {exporting ? 'Exporting...' : 'Export DOCX'}
        </button>
        <button
          onClick={handleExportPptx}
          disabled={exportingPptx || !editorContent?.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Presentation size={14} />
          {exportingPptx ? 'Exporting...' : 'Export PPTX'}
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/80 hover:bg-white/5 transition-colors text-sm">
          <Share2 size={14} />
          Share Room
        </button>
      </div>
    </div>
  );
};

export default DealRoomHeader;
