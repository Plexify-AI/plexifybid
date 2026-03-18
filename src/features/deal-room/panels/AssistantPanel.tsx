import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';
import DealRoomChatMessage from '../components/DealRoomChatMessage';
import type { DealRoomMessage } from '../../../types/dealRoom';

interface OpportunityContext {
  contact_name?: string;
  account_name?: string;
  contact_email?: string;
}

interface AssistantPanelProps {
  messages: DealRoomMessage[];
  sending: boolean;
  onSendMessage: (message: string, actionChip?: string) => Promise<any>;
  opportunity?: OpportunityContext | null;
}

const DEFAULT_ACTION_CHIPS = [
  { label: 'Generate Board Brief', icon: '📄' },
  { label: 'Extract Assessment Trends', icon: '📊' },
  { label: 'Draft OZRF Section', icon: '🏛️' },
];

function getOpportunityChips(opp: OpportunityContext) {
  const name = opp.contact_name || opp.account_name || 'this contact';
  return [
    { label: `Draft Outreach Email for ${name}`, icon: '✉️' },
    { label: `Meeting Prep Brief for ${name}`, icon: '📋' },
    { label: `Follow-Up Message for ${name}`, icon: '🔄' },
  ];
}

const AssistantPanel: React.FC<AssistantPanelProps> = ({ messages, sending, onSendMessage, opportunity }) => {
  const [input, setInput] = useState('');
  const actionChips = opportunity ? getOpportunityChips(opportunity) : DEFAULT_ACTION_CHIPS;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input;
    setInput('');
    await onSendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">
          AI Research Assistant
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
            <img src="/assets/logos/flat_P_logo.png" alt="Plexify" className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Plexify AI Assistant</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-300">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action chips */}
      <div className="px-4 py-2 border-b border-white/10 flex flex-wrap gap-1.5">
        {actionChips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => onSendMessage(chip.label, chip.label)}
            disabled={sending}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors disabled:opacity-50"
          >
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="text-center text-white/30 text-sm mt-8">
            <p className="mb-2">Ask me anything about this deal.</p>
            <p>Try clicking an action chip above or type a question.</p>
          </div>
        )}
        {messages.map((msg) => (
          <DealRoomChatMessage key={msg.id} message={msg} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-white/40 text-sm mb-3">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <img src="/assets/logos/flat_P_logo.png" alt="P" className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl border border-white/10 px-3 py-2">
          <button className="text-white/30 hover:text-white/60 transition-colors">
            <Paperclip size={16} />
          </button>
          <button className="text-white/30 hover:text-white/60 transition-colors">
            <Mic size={16} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about this deal..."
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 disabled:text-white/20 flex items-center justify-center text-white transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;
