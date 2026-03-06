import React from 'react';
import { FileText, File, Trash2 } from 'lucide-react';
import type { DealRoomSource } from '../../../types/dealRoom';

interface SourceFileCardProps {
  source: DealRoomSource;
  onDelete?: (sourceId: string) => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(fileType: string | null) {
  switch (fileType) {
    case 'pdf': return <FileText size={16} className="text-red-400" />;
    case 'docx': return <FileText size={16} className="text-blue-400" />;
    case 'txt':
    case 'md': return <File size={16} className="text-gray-400" />;
    case 'csv': return <File size={16} className="text-green-400" />;
    default: return <File size={16} className="text-white/50" />;
  }
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  ready: { bg: 'bg-emerald-500', text: 'text-white', label: 'Ready' },
  processing: { bg: 'bg-amber-500', text: 'text-white', label: 'Processing' },
  pending: { bg: 'bg-gray-500', text: 'text-white', label: 'Pending' },
  error: { bg: 'bg-red-500', text: 'text-white', label: 'Error' },
};

const SourceFileCard: React.FC<SourceFileCardProps> = ({ source, onDelete }) => {
  const badge = statusBadge[source.processing_status] || statusBadge.pending;

  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-white/5 rounded-lg group transition-colors">
      <input
        type="checkbox"
        checked={source.is_selected !== false}
        readOnly
        className="mt-1 accent-emerald-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {getFileIcon(source.file_type)}
          <span className="text-sm text-white/90 truncate">{source.file_name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-white/40">{formatFileSize(source.file_size || source.file_size_bytes || null)}</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
          {source.chunk_count > 0 && (
            <span className="text-xs text-white/40">{source.chunk_count} chunks</span>
          )}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(source.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

export default SourceFileCard;
