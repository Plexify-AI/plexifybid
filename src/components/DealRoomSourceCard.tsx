/**
 * DealRoomSourceCard — Displays a single source document in the Deal Room.
 *
 * Shows file name, type badge, processing status, AI summary,
 * chunk count, and a delete button.
 *
 * Named DealRoomSourceCard to avoid conflicts with the existing SourceCard
 * component used by the ReportEditorWorkspace / SourcesPanel.
 */

import React from 'react';
import {
  FileText, File, Trash2, Loader2, CheckCircle2,
  AlertCircle, Clock, Hash
} from 'lucide-react';

export interface SourceDoc {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  processing_status: 'pending' | 'processing' | 'ready' | 'error';
  summary?: string;
  chunk_count?: number;
  uploaded_at: string;
}

interface DealRoomSourceCardProps {
  source: SourceDoc;
  onDelete?: (sourceId: string) => void;
  isDeleting?: boolean;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/15 text-red-400 border-red-500/25',
  docx: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  txt: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
  md: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  csv: 'bg-green-500/15 text-green-400 border-green-500/25',
};

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string; animate?: boolean }> = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
  },
  processing: {
    icon: Loader2,
    label: 'Processing',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    animate: true,
  },
  ready: {
    icon: CheckCircle2,
    label: 'Ready',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const DealRoomSourceCard: React.FC<DealRoomSourceCardProps> = ({ source, onDelete, isDeleting }) => {
  const status = STATUS_CONFIG[source.processing_status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const typeColor = FILE_TYPE_COLORS[source.file_type] || FILE_TYPE_COLORS.txt;
  const FileIcon = source.file_type === 'pdf' ? FileText : File;

  return (
    <div className="group bg-gray-800/50 border border-gray-700/40 rounded-lg p-3 hover:bg-gray-800/70 transition-colors">
      {/* Top row: icon + name + delete */}
      <div className="flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-lg ${typeColor} border flex items-center justify-center shrink-0 mt-0.5`}>
          <FileIcon size={15} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate" title={source.file_name}>
            {source.file_name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-medium uppercase ${typeColor.split(' ')[1]}`}>
              {source.file_type}
            </span>
            <span className="text-[10px] text-gray-500">{formatFileSize(source.file_size)}</span>
            <span className="text-[10px] text-gray-600">{timeAgo(source.uploaded_at)}</span>
          </div>
        </div>

        {onDelete && (
          <button
            onClick={() => onDelete(source.id)}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/15 text-gray-500 hover:text-red-400 transition-all"
            title="Remove source"
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        )}
      </div>

      {/* Status + chunks */}
      <div className="flex items-center gap-2 mt-2">
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${status.bg} ${status.color}`}>
          <StatusIcon size={10} className={status.animate ? 'animate-spin' : ''} />
          <span>{status.label}</span>
        </div>

        {source.processing_status === 'ready' && source.chunk_count != null && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Hash size={10} />
            <span>{source.chunk_count} chunks</span>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {source.summary && source.processing_status === 'ready' && (
        <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-2">
          {source.summary}
        </p>
      )}
    </div>
  );
};

export default DealRoomSourceCard;
