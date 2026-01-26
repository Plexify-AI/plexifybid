import { useMemo, useState, type DragEvent } from 'react';
import type { RealDocument } from '../types/realDocs';
import {
  formatFileSize,
  formatUploadDate,
  getDocumentTypeColor,
  getDocumentTypeLabel,
} from '../services/realDocsService';
import './SourceCard.css';

interface SourceCardProps {
  document: RealDocument;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onMoveDocument: (dragIndex: number, hoverIndex: number) => void;
}

const agentLabel = (agentId: RealDocument['agents'][number]) => {
  switch (agentId) {
    case 'board-brief':
      return '🧾 Board Brief';
    case 'assessment-trends':
      return '📊 Assessment Trends';
    case 'ozrf-section':
      return '📝 OZRF Section';
    default:
      return agentId;
  }
};

export default function SourceCard({
  document,
  index,
  isSelected,
  onToggleSelect,
  onMoveDocument,
}: SourceCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const badgeColor = useMemo(() => getDocumentTypeColor(document.type), [document.type]);
  const typeLabel = useMemo(() => getDocumentTypeLabel(document.type), [document.type]);

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setIsDragOver(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const dragIndex = Number(raw);
    if (Number.isFinite(dragIndex) && dragIndex !== index) {
      onMoveDocument(dragIndex, index);
    }
    setIsDragOver(false);
  };

  return (
    <div
      className={[
        'source-card',
        isDragging ? 'source-card--dragging' : '',
        isDragOver ? 'source-card--dragover' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          className="source-card__handle pt-1"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          aria-label="Drag"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M7 4a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0zM7 8a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0zM7 12a1 1 0 112 0 1 1 0 01-2 0zm4 0a1 1 0 112 0 1 1 0 01-2 0z" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {document.displayName}
                </h4>
                <span className="source-card__badge" style={{ backgroundColor: badgeColor }}>
                  {typeLabel}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                <span>{formatUploadDate(document.uploadedAt)}</span>
                <span className="mx-2">•</span>
                <span>{formatFileSize(document.fileSize)}</span>
                {typeof document.pageCount === 'number' ? (
                  <>
                    <span className="mx-2">•</span>
                    <span>{document.pageCount} pages</span>
                  </>
                ) : null}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(document.id)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Use
            </label>
          </div>

          {document.agents.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {document.agents.map((agent) => (
                <span key={agent} className="source-card__agent-tag">
                  {agentLabel(agent)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
