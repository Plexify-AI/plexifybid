import { Mail, RefreshCw } from 'lucide-react';
import { CopyToClipboard } from '../../agent-management/components/shared/CopyToClipboard';
import type { OutreachResponse } from '../MelDemo.types';

interface EmailPreviewProps {
  data: OutreachResponse;
}

export function EmailPreview({ data }: EmailPreviewProps) {
  const { email, stats } = data;
  const fullText = `To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}\n\n${email.signature}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Email Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Mail size={14} className="text-gray-500" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Generated Outreach</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex">
            <span className="w-16 text-gray-400 font-medium">To:</span>
            <span className="text-gray-900">{email.to}</span>
          </div>
          <div className="flex">
            <span className="w-16 text-gray-400 font-medium">Subject:</span>
            <span className="font-medium text-gray-900">{email.subject}</span>
          </div>
          <div className="flex">
            <span className="w-16 text-gray-400 font-medium">Preview:</span>
            <span className="text-gray-500 italic">{email.preheader}</span>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="px-4 py-4 text-sm text-gray-800 leading-relaxed whitespace-pre-line">
        {email.body}
      </div>

      {/* Signature */}
      <div className="px-4 pb-4 text-sm text-gray-500 whitespace-pre-line border-t border-gray-100 pt-3">
        {email.signature}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs">
        <div className="flex items-center gap-3 text-gray-500">
          <span>{stats.wordCount} words</span>
          <span className="text-gray-300">|</span>
          <span>{stats.readingTime} read</span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-green-600">
            {stats.personalizationScore}% personalized
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <CopyToClipboard text={fullText} label="Copy" size="sm" />
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md
              bg-white text-gray-700 border border-gray-300 hover:bg-gray-50
              transition-all duration-200"
          >
            <RefreshCw size={12} />
            Variant
          </button>
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2.5 bg-green-50 border-t border-green-100 text-xs text-green-700">
        <span>&#10003; Project name referenced</span>
        <span>&#10003; Pain point addressed</span>
        <span>&#10003; Case study with ROI</span>
        <span>&#10003; Warm intro mentioned</span>
        <span>&#10003; Clear CTA</span>
        <span>&#10003; Signature complete</span>
      </div>
    </div>
  );
}
