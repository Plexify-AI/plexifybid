/**
 * InfographicRenderer — Visual one-pager for deal/opportunity data.
 *
 * Renders a branded infographic from structured JSON output:
 * metrics cards, timeline, key contacts, strengths/risks, recommendation.
 *
 * Brand: Deep Louvre Navy bg, Signal Teal metrics, Warm Amber highlights,
 * Electric Violet accents. Glassmorphism cards.
 */

import React, { useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Download, Check } from 'lucide-react';

// Icon map — simple SVG icons for metric cards
const ICONS: Record<string, React.ReactNode> = {
  dollar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
};

interface Metric {
  label: string;
  value: string;
  icon?: string;
}

interface TimelineEvent {
  date: string;
  event: string;
  status: 'complete' | 'in_progress' | 'upcoming';
}

interface Contact {
  name: string;
  title: string;
  warmth?: number | null;
}

interface InfographicOutput {
  title: string;
  subtitle?: string;
  metrics?: Metric[];
  timeline?: TimelineEvent[];
  key_contacts?: Contact[];
  strengths?: string[];
  risks?: string[];
  recommendation?: string;
}

interface InfographicRendererProps {
  output: InfographicOutput;
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}

function warmthColor(score: number): string {
  if (score >= 70) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  if (score >= 40) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
  return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
}

function statusColor(status: string): { dot: string; line: string; text: string } {
  switch (status) {
    case 'complete':
      return { dot: 'bg-emerald-400', line: 'bg-emerald-500/40', text: 'text-emerald-300' };
    case 'in_progress':
      return { dot: 'bg-amber-400 animate-pulse', line: 'bg-amber-500/40', text: 'text-amber-300' };
    default:
      return { dot: 'bg-gray-500', line: 'bg-gray-600/40', text: 'text-gray-400' };
  }
}

const InfographicRenderer: React.FC<InfographicRendererProps> = ({ output }) => {
  const captureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: '#0D1B3E',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `infographic-${output.title?.replace(/\s+/g, '-').toLowerCase() || 'export'}.png`;
      link.href = dataUrl;
      link.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (err) {
      console.error('Failed to export infographic:', err);
    } finally {
      setDownloading(false);
    }
  }, [output.title]);

  const {
    title,
    subtitle,
    metrics = [],
    timeline = [],
    key_contacts = [],
    strengths = [],
    risks = [],
    recommendation,
  } = output;

  return (
    <div className="space-y-5 pb-4">
      {/* Download button — floating at top */}
      <div className="flex justify-end">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-colors text-xs disabled:opacity-50"
        >
          {downloaded ? (
            <><Check size={13} /> Saved</>
          ) : downloading ? (
            <><Download size={13} className="animate-pulse" /> Exporting...</>
          ) : (
            <><Download size={13} /> Download PNG</>
          )}
        </button>
      </div>

      {/* Capturable content area */}
      <div ref={captureRef} className="space-y-5 p-4 rounded-xl" style={{ backgroundColor: '#0D1B3E' }}>
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-violet-300 mt-1">{subtitle}</p>
        )}
        <div className="mt-3 mx-auto w-16 h-0.5 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500 rounded-full" />
      </div>

      {/* Metrics Grid */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-sm p-3 text-center"
            >
              <div className="flex items-center justify-center mb-2 text-emerald-400">
                {ICONS[m.icon || 'chart'] || ICONS.chart}
              </div>
              <div className="text-lg font-bold text-white leading-tight">{m.value}</div>
              <div className="text-[11px] text-emerald-300/70 mt-0.5 uppercase tracking-wider">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-4 h-4 text-violet-400">{ICONS.clock}</span>
            Timeline
          </h3>
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-white/10" />
            <div className="space-y-3">
              {timeline.map((t, i) => {
                const sc = statusColor(t.status);
                return (
                  <div key={i} className="flex items-start gap-3 relative">
                    <div className={`w-[15px] h-[15px] rounded-full ${sc.dot} flex-shrink-0 mt-0.5 border-2 border-[#0D1B3E] z-10`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-medium ${sc.text}`}>{t.date}</span>
                        <span className="text-[10px] text-white/30 capitalize">{t.status.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-white/80 mt-0.5">{t.event}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Key Contacts */}
      {key_contacts.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-4 h-4 text-violet-400">{ICONS.users}</span>
            Key Contacts
          </h3>
          <div className="space-y-2">
            {key_contacts.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                  {c.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  <p className="text-xs text-white/50 truncate">{c.title}</p>
                </div>
                {c.warmth != null && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${warmthColor(c.warmth)}`}>
                    {c.warmth}/100
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Risks — Two Column */}
      {(strengths.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-2 gap-2.5">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Strengths</h3>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-white/70">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {risks.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Risks</h3>
              <ul className="space-y-1.5">
                {risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-white/70">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">!</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-4 h-4">{ICONS.target}</span>
            Recommendation
          </h3>
          <p className="text-sm text-white/90 leading-relaxed">{recommendation}</p>
        </div>
      )}
      </div>{/* end capturable area */}
    </div>
  );
};

export default InfographicRenderer;
