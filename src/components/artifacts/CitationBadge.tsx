import React from 'react';
import { Paperclip } from 'lucide-react';

interface CitationBadgeProps {
  citation: string; // e.g. "[Source: file.pdf, Chunk 3]"
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}

/**
 * Clickable citation badge — matches the chat panel citation style.
 * Parses "[Source: filename, Chunk N]" format and fires onCitationClick
 * to highlight the source in the left panel.
 */
export default function CitationBadge({ citation, onCitationClick }: CitationBadgeProps) {
  const parsed = parseCitation(citation);

  const handleClick = () => {
    if (parsed && onCitationClick) {
      onCitationClick(parsed.fileName, parsed.chunkIndex);
    }
  };

  const displayText = parsed
    ? `${parsed.fileName}, Chunk ${parsed.chunkIndex}`
    : citation.replace(/^\[/, '').replace(/\]$/, '');

  return (
    <span
      onClick={handleClick}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 cursor-pointer hover:bg-indigo-500/30 transition-colors ml-1"
    >
      <Paperclip size={9} className="mr-0.5 flex-shrink-0" />
      {displayText}
    </span>
  );
}

/**
 * Inline citation mark (superscript style) for use inside text content.
 * Matches the existing CitationMark pattern but with click handling.
 */
export function InlineCitation({
  text,
  onCitationClick,
}: {
  text: string;
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}) {
  // Split text on citation patterns and render badges inline
  const parts = text.split(/(\[Source:[^\]]+\]|\[Unverified\]|\[Inferred[^\]]*\]|\[Anticipated\])/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('[Source:')) {
          return <CitationBadge key={i} citation={part} onCitationClick={onCitationClick} />;
        }
        if (part === '[Unverified]') {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 ml-1">
              Unverified
            </span>
          );
        }
        if (part.startsWith('[Inferred') || part === '[Anticipated]') {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-500/20 text-slate-400 ml-1">
              {part.replace(/^\[|\]$/g, '')}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function parseCitation(citation: string): { fileName: string; chunkIndex: number } | null {
  const match = citation.match(/\[Source:\s*(.+?),\s*Chunk\s*(\d+)\]/);
  if (!match) return null;
  return { fileName: match[1], chunkIndex: parseInt(match[2], 10) };
}
