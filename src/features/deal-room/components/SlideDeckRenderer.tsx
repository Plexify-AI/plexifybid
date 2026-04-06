/**
 * SlideDeckRenderer — Displays a preview of the generated slide deck
 * with a "Download PPTX" button. Shows slide thumbnails in a vertical
 * list with the structured content.
 */

import React, { useState } from 'react';
import { Download, MonitorPlay, Loader2 } from 'lucide-react';
import { useSandbox } from '../../../contexts/SandboxContext';

interface SlideData {
  type: string;
  title?: string;
  subtitle?: string;
  content?: string;
  bullets?: string[];
  metrics?: Array<{ label: string; value: string; context?: string }>;
  left_header?: string;
  left_bullets?: string[];
  right_header?: string;
  right_bullets?: string[];
  source_citations?: string[];
}

interface DeckOutput {
  title: string;
  subtitle?: string;
  date?: string;
  slides: SlideData[];
}

interface SlideDeckRendererProps {
  output: DeckOutput;
  dealRoomId?: string;
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  title: 'Title Slide',
  executive_summary: 'Executive Summary',
  metrics: 'Key Metrics',
  two_column: 'Comparison',
  recommendations: 'Recommendations',
  closing: 'Closing',
};

const SlideDeckRenderer: React.FC<SlideDeckRendererProps> = ({ output, dealRoomId }) => {
  const { token } = useSandbox();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!dealRoomId || !token) return;
    setDownloading(true);

    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/generate-deck`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skillKey: 'board_deck' }),
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${output.title || 'Board-Deck'}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[SlideDeckRenderer] Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const slides = output?.slides || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
            Board Deck
          </span>
          <span className="text-xs text-white/40">{slides.length} slides</span>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors text-sm disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {downloading ? 'Generating...' : 'Download PPTX'}
        </button>
      </div>

      {/* Deck title */}
      {output.title && (
        <div className="p-4 rounded-xl bg-[#0D1B3E] border border-white/10">
          <h2 className="text-xl font-bold text-white mb-1">{output.title}</h2>
          {output.subtitle && <p className="text-sm text-white/60">{output.subtitle}</p>}
          {output.date && <p className="text-xs text-white/40 mt-1">{output.date}</p>}
        </div>
      )}

      {/* Slide previews */}
      {slides.map((slide, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-[#0D1B3E]/60 border border-white/10 space-y-2"
        >
          {/* Slide number + type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-white/30">Slide {i + 1}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-500/20 text-violet-300 border border-violet-400/20">
              {SLIDE_TYPE_LABELS[slide.type] || slide.type}
            </span>
          </div>

          {/* Slide title */}
          {slide.title && (
            <h3 className="text-base font-semibold text-white">{slide.title}</h3>
          )}

          {/* Subtitle (title slide) */}
          {slide.subtitle && slide.type === 'title' && (
            <p className="text-sm text-white/60">{slide.subtitle}</p>
          )}

          {/* Content (closing slide) */}
          {slide.content && (
            <p className="text-sm text-white/70 leading-relaxed">{slide.content}</p>
          )}

          {/* Bullets */}
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="space-y-1 ml-4">
              {slide.bullets.map((bullet, j) => (
                <li key={j} className="text-sm text-white/70 list-disc">
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          {/* Metrics */}
          {slide.metrics && slide.metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {slide.metrics.map((m, j) => (
                <div key={j} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-lg font-bold text-emerald-400">{m.value}</div>
                  <div className="text-xs font-medium text-white/80">{m.label}</div>
                  {m.context && <div className="text-[10px] text-white/40">{m.context}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Two column */}
          {slide.type === 'two_column' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                {slide.left_header && (
                  <div className="text-xs font-semibold text-emerald-400 mb-1">{slide.left_header}</div>
                )}
                <ul className="space-y-1 ml-3">
                  {(slide.left_bullets || []).map((b, j) => (
                    <li key={j} className="text-xs text-white/70 list-disc">{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                {slide.right_header && (
                  <div className="text-xs font-semibold text-amber-400 mb-1">{slide.right_header}</div>
                )}
                <ul className="space-y-1 ml-3">
                  {(slide.right_bullets || []).map((b, j) => (
                    <li key={j} className="text-xs text-white/70 list-disc">{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Citations */}
          {slide.source_citations && slide.source_citations.length > 0 && (
            <div className="text-[10px] text-white/30 italic mt-1">
              {slide.source_citations.join(' | ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SlideDeckRenderer;
