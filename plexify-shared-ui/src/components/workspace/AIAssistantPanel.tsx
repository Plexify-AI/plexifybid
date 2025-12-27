import React, { useState, useRef, useEffect } from 'react';
import { PlexifyTheme } from '../../types/theme';
import { Message, SuggestedAction } from '../../types/workspace';
import AIMessageBubble from './AIMessageBubble';
import PlexifyLogo from '../shared/PlexifyLogo';

interface AIAssistantPanelProps {
  theme: PlexifyTheme;
  title?: string;
  embedded?: boolean;
  messages?: Message[];
  onSendMessage?: (message: string) => Promise<void>;
  onSuggestedAction?: (action: SuggestedAction) => void;
  placeholder?: string;
  isLoading?: boolean;
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.44 11.05l-8.49 8.49a5 5 0 01-7.07-7.07l8.49-8.49a3.5 3.5 0 014.95 4.95l-8.84 8.84a2 2 0 11-2.83-2.83l8.49-8.49"
      />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10v2a7 7 0 01-14 0v-2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19v4m-4 0h8"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2L11 13"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2l-7 20-4-9-9-4 20-7z"
      />
    </svg>
  );
}

export default function AIAssistantPanel({
  theme,
  title = 'Plexify AI Assistant',
  embedded = false,
  messages = [],
  onSendMessage,
  onSuggestedAction,
  placeholder = 'Ask me anything about this report...',
  isLoading = false,
}: AIAssistantPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await onSendMessage?.(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const bidAgentChips = [
    {
      id: 'board-brief',
      label: 'Generate Board Brief',
      icon: '📋',
      prompt: 'Generate a Board Brief from the selected sources',
    },
    {
      id: 'assessment-trends',
      label: 'Extract Assessment Trends',
      icon: '📊',
      prompt: 'Extract assessment collection trends from the selected sources',
    },
    {
      id: 'ozrf-section',
      label: 'Draft OZRF Section',
      icon: '📝',
      prompt: 'Draft an OZRF compliance section from the selected sources',
    },
  ];

  return (
    <div
      className={
        embedded
          ? 'flex flex-col h-full bg-white'
          : 'flex flex-col h-full rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden'
      }
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-slate-200"
      >
        <PlexifyLogo size={28} />
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <span className="text-xs text-green-500">
            {isLoading ? 'Thinking...' : 'Online'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: theme.primaryColor }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              How can I help you with this report?
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {bidAgentChips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => onSendMessage?.(chip.prompt)}
                  className="px-3 py-1.5 text-xs rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true">{chip.icon}</span>
                    <span>{chip.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <AIMessageBubble
              key={message.id}
              message={message}
              theme={theme}
              onSuggestedAction={onSuggestedAction}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1 bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: theme.primaryColor,
                    animationDelay: '0ms',
                  }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: theme.primaryColor,
                    animationDelay: '150ms',
                  }}
                />
                <div
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    backgroundColor: theme.primaryColor,
                    animationDelay: '300ms',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 text-sm outline-none resize-none"
            />
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600"
              aria-label="Attach"
              disabled={isLoading}
            >
              <PaperclipIcon className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600"
              aria-label="Voice"
              disabled={isLoading}
            >
              <MicIcon className="w-[18px] h-[18px]" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-2">
              Send
              <SendIcon className="w-4 h-4" />
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
