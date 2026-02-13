/**
 * OutreachPreview — Styled email preview for draft_outreach results
 *
 * Parses the email from Claude's markdown reply and displays it
 * in a realistic email-card format with subject, body, and copy action.
 * Also shows context from the tool result (prospect, contact, case study).
 */

import React, { useState } from 'react';
import { Mail, Copy, Check, User, Building2, Award, Zap } from 'lucide-react';

interface OutreachContext {
  prospect?: {
    project_name?: string;
    gc_name?: string;
    warmth_score?: number;
    pain_points?: string[];
  };
  contact?: {
    name?: string;
    title?: string;
    company?: string;
    email?: string;
    decision_maker?: boolean;
  };
  case_study?: {
    project_name?: string;
    roi_display?: string;
    service?: string;
  };
  warm_intro?: {
    name?: string;
    company?: string;
  };
  requested_tone?: string;
  requested_focus?: string;
}

interface OutreachPreviewProps {
  /** Claude's full markdown reply — we'll extract subject/body from it */
  replyContent: string;
  /** The email_context from the tool result */
  emailContext?: OutreachContext;
}

/**
 * Try to extract subject line and body from Claude's markdown response.
 * Claude typically formats outreach as:
 *   **Subject:** ...
 *   ... body ...
 * or uses markdown headers.
 */
function parseEmail(content: string): { subject: string; body: string } {
  // Try "Subject:" pattern (bold or plain)
  const subjectMatch = content.match(/\*{0,2}Subject:?\*{0,2}\s*(.+?)(?:\n|$)/i);
  let subject = '';
  let body = content;

  if (subjectMatch) {
    subject = subjectMatch[1].trim().replace(/^\*{1,2}|\*{1,2}$/g, '');
    // Body is everything after the subject line
    const subjectEnd = (subjectMatch.index ?? 0) + subjectMatch[0].length;
    body = content.substring(subjectEnd).trim();
  }

  // Clean up body: remove leading --- or *** dividers
  body = body.replace(/^[-*]{3,}\s*\n/, '').trim();

  // Remove "Dear [Name]," if it starts with it (we show contact separately)
  // Actually keep it — it's part of the email

  return { subject, body };
}

const OutreachPreview: React.FC<OutreachPreviewProps> = ({ replyContent, emailContext }) => {
  const [copied, setCopied] = useState(false);
  const { subject, body } = parseEmail(replyContent);

  const handleCopy = async () => {
    const fullEmail = subject ? `Subject: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = fullEmail;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const ctx = emailContext;

  return (
    <div className="mt-3 mb-1">
      {/* Context chips */}
      {ctx && (
        <div className="flex flex-wrap gap-2 mb-3">
          {ctx.contact?.name && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-700/40 border border-gray-600/40 rounded-full text-xs text-gray-300">
              <User size={11} className="text-blue-400" />
              <span>{ctx.contact.name}</span>
              {ctx.contact.decision_maker && (
                <span className="text-[9px] text-green-400 font-medium">DM</span>
              )}
            </div>
          )}
          {ctx.prospect?.project_name && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-700/40 border border-gray-600/40 rounded-full text-xs text-gray-300">
              <Building2 size={11} className="text-orange-400" />
              <span className="truncate max-w-[180px]">{ctx.prospect.project_name}</span>
            </div>
          )}
          {ctx.case_study?.roi_display && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-300">
              <Award size={11} />
              <span>{ctx.case_study.roi_display}</span>
            </div>
          )}
          {ctx.warm_intro?.name && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-300">
              <Zap size={11} />
              <span>Warm intro via {ctx.warm_intro.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Email card */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        {/* Email header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-700/30 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-blue-400" />
            <span className="text-xs font-medium text-gray-300">Email Draft</span>
            {ctx?.requested_tone && (
              <span className="px-2 py-0.5 text-[10px] text-gray-400 bg-gray-700/50 rounded-full capitalize">
                {ctx.requested_tone}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md hover:bg-gray-600/50 transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} className="text-green-400" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} className="text-gray-400" />
                <span className="text-gray-400">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Subject line */}
        {subject && (
          <div className="px-4 py-2 border-b border-gray-700/30">
            <span className="text-xs text-gray-500">Subject: </span>
            <span className="text-sm font-medium text-white">{subject}</span>
          </div>
        )}

        {/* Email body */}
        <div className="px-4 py-3">
          <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutreachPreview;
