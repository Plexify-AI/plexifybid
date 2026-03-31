import React from 'react';
import {
  Play,
  MonitorPlay,
  GitBranch,
  Table,
  ClipboardList,
  BarChart3,
  Users,
  FileSearch,
  PieChart,
  FileText,
  Mail,
  Landmark,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DealRoomArtifact } from '../../../types/dealRoom';

interface ArtifactThumbnailProps {
  artifact: DealRoomArtifact;
  onClick?: () => void;
}

const ARTIFACT_COLORS: Record<string, string> = {
  board_brief: 'from-blue-600/40 to-blue-800/40',
  competitive_analysis: 'from-purple-600/40 to-purple-800/40',
  meeting_prep: 'from-emerald-600/40 to-emerald-800/40',
  deal_summary: 'from-indigo-600/40 to-indigo-800/40',
  ozrf_section: 'from-slate-600/40 to-slate-800/40',
  outreach_sequence: 'from-pink-600/40 to-pink-800/40',
  slide_deck: 'from-amber-600/40 to-amber-800/40',
  podcast: 'from-rose-600/40 to-rose-800/40',
  audio_briefing: 'from-rose-600/40 to-rose-800/40',
  presentation: 'from-amber-600/40 to-amber-800/40',
  video_summary: 'from-cyan-600/40 to-cyan-800/40',
  data_table: 'from-teal-600/40 to-teal-800/40',
  infographic: 'from-violet-600/40 to-violet-800/40',
  knowledge_graph: 'from-sky-600/40 to-sky-800/40',
};

const ARTIFACT_ICONS: Record<string, LucideIcon> = {
  presentation: MonitorPlay,
  knowledge_graph: GitBranch,
  data_table: Table,
  board_brief: ClipboardList,
  competitive_analysis: BarChart3,
  meeting_prep: Users,
  deal_summary: FileSearch,
  ozrf_section: Landmark,
  outreach_sequence: Mail,
  slide_deck: MonitorPlay,
  infographic: PieChart,
};

const AUDIO_VIDEO_TYPES = ['podcast', 'video_summary'];

const ArtifactThumbnail: React.FC<ArtifactThumbnailProps> = ({ artifact, onClick }) => {
  const gradient = ARTIFACT_COLORS[artifact.artifact_type] || 'from-gray-600/40 to-gray-800/40';
  const showPlayIcon = AUDIO_VIDEO_TYPES.includes(artifact.artifact_type);
  const IconComponent = ARTIFACT_ICONS[artifact.artifact_type] || FileText;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      {/* Thumbnail */}
      <div className={`relative aspect-[4/3] rounded-lg bg-gradient-to-br ${gradient} border border-white/10 overflow-hidden flex items-center justify-center`}>
        {/* Type-specific icon */}
        <IconComponent size={32} className="text-white opacity-60" />
        {/* Play icon overlay */}
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Play size={14} className="text-white ml-0.5" />
            </div>
          </div>
        )}
        {/* Status badge */}
        {artifact.status === 'generating' && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/80 text-white flex items-center gap-1">
            <RefreshCw size={9} className="animate-spin" />
            Generating
          </div>
        )}
        {artifact.status === 'ready' && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/80 text-white flex items-center gap-1">
            <CheckCircle2 size={9} />
            Ready
          </div>
        )}
        {(artifact.status === 'error' || artifact.status === 'failed') && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-red-500/80 text-white flex items-center gap-1">
            <AlertCircle size={9} />
            Retry
          </div>
        )}
      </div>
      {/* Label */}
      <div className="mt-1.5">
        <div className="flex items-center gap-1">
          <p className="text-xs text-white/80 truncate flex-1">{artifact.title}</p>
          {(artifact as any).version > 1 && (
            <span className="text-[9px] text-white/30 shrink-0">v{(artifact as any).version}</span>
          )}
        </div>
        {artifact.subtitle && (
          <p className="text-[11px] text-white/40 truncate">{artifact.subtitle}</p>
        )}
      </div>
    </button>
  );
};

export default ArtifactThumbnail;
