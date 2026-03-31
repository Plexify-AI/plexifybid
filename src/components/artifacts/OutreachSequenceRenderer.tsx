/**
 * OutreachSequenceRenderer — Renders an outreach email preview.
 *
 * Unlike report-style renderers, this shows: subject line header,
 * preheader (muted), formatted body, CTA button (teal pill),
 * voice match score badge, and a disabled "Send via Email" placeholder.
 */

import React from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { InlineCitation } from './CitationBadge';

interface OutreachSequenceOutput {
  subject: string;
  preheader?: string;
  body_html?: string;
  body?: string;
  cta?: string;
  voice_match_score?: number;
}

interface Props {
  output: OutreachSequenceOutput;
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}

const OutreachSequenceRenderer: React.FC<Props> = ({ output, onCitationClick }) => {
  const bodyContent = output.body_html || output.body || '';
  const hasVoiceScore = typeof output.voice_match_score === 'number';

  return (
    <div className="space-y-4">
      {/* Email envelope */}
      <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl overflow-hidden">
        {/* Subject line header */}
        <div className="px-5 py-4 border-b border-gray-700/40">
          <div className="flex items-center gap-2 mb-1">
            <Mail size={16} className="text-blue-400" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Subject</span>
          </div>
          <h3 className="text-base font-semibold text-white">{output.subject}</h3>
          {output.preheader && (
            <p className="text-xs text-gray-500 mt-1">{output.preheader}</p>
          )}
        </div>

        {/* Email body */}
        <div className="px-5 py-4">
          {output.body_html ? (
            <div
              className="text-sm text-gray-300 leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:text-white [&_a]:text-emerald-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: bodyContent }}
            />
          ) : (
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              <InlineCitation text={bodyContent} onCitationClick={onCitationClick} />
            </p>
          )}
        </div>

        {/* CTA button */}
        {output.cta && (
          <div className="px-5 pb-4">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-medium">
              {output.cta}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Voice match score + Send placeholder */}
      <div className="flex items-center justify-between">
        {hasVoiceScore && (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className={output.voice_match_score! >= 85 ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="text-xs text-gray-400">
              Voice Match: <span className={`font-semibold ${output.voice_match_score! >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {output.voice_match_score}%
              </span>
            </span>
          </div>
        )}

        <button
          disabled
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700/40 border border-gray-600/30 text-gray-500 text-sm cursor-not-allowed"
          title="Email send flow coming soon"
        >
          <Send size={14} />
          Send via Email
        </button>
      </div>
    </div>
  );
};

export default OutreachSequenceRenderer;
