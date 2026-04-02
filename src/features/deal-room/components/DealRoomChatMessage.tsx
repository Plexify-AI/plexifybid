import React, { useState } from 'react';
import { Paperclip, ClipboardCopy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { DealRoomMessage } from '../../../types/dealRoom';

interface DealRoomChatMessageProps {
  message: DealRoomMessage;
  onCopyToEditor?: (content: string) => void;
}

const DealRoomChatMessage: React.FC<DealRoomChatMessageProps> = ({ message, onCopyToEditor }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
            <img src="/assets/logos/flat_P_logo.png" alt="P" className="w-5 h-5" />
          </div>
        </div>
      )}

      <div className={`max-w-[92%] ${isUser ? 'ml-auto' : ''}`}>
        {/* Message bubble */}
        <div
          className={`px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl rounded-br-sm'
              : 'bg-white/[0.06] text-white/90 rounded-2xl rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-white [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.citations.map((citation, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-indigo-500/20 text-indigo-300 cursor-pointer hover:bg-indigo-500/30 transition-colors"
              >
                <Paperclip size={10} className="mr-1 flex-shrink-0" />
                {citation.source_name || `Source ${citation.source_id.slice(0, 8)}`}, Chunk {citation.chunk_index}
              </span>
            ))}
          </div>
        )}

        {/* Copy to Editor chip — assistant messages only */}
        {!isUser && onCopyToEditor && (
          <button
            onClick={() => {
              onCopyToEditor(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors"
          >
            {copied ? <Check size={10} /> : <ClipboardCopy size={10} />}
            {copied ? 'Copied to Editor' : 'Copy to Editor'}
          </button>
        )}
      </div>
    </div>
  );
};

export default DealRoomChatMessage;
