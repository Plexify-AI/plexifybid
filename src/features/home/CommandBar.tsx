/**
 * CommandBar — Home screen command interface
 *
 * Time-of-day greeting + natural language input + quick-action chips.
 * All interactions navigate to /ask-plexi?prefill=... for processing.
 * No inline results on Home (Sprint 3: inline when PlexiCoS can process).
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Flame, Calendar, Send, BarChart3 } from 'lucide-react';
import { useSandbox } from '../../contexts/SandboxContext';

const QUICK_ACTIONS = [
  {
    label: 'Top warm prospects',
    prompt: 'Show me my warmest prospects ranked by engagement score',
    icon: Flame,
  },
  {
    label: 'Prep next meeting',
    prompt: 'Help me prepare for my next highest-value meeting with a briefing',
    icon: Calendar,
  },
  {
    label: 'Draft outreach',
    prompt: 'Draft personalized outreach for my top prospect',
    icon: Send,
  },
  {
    label: 'Pipeline status',
    prompt: 'Show me my pipeline status and recommended next moves',
    icon: BarChart3,
  },
];

function getGreeting(tenantName: string | undefined): { line1: string; line2: string } {
  const hour = new Date().getHours();
  let timeGreeting: string;

  if (hour < 12) {
    timeGreeting = 'Good morning';
  } else if (hour < 17) {
    timeGreeting = 'Good afternoon';
  } else {
    timeGreeting = 'Good evening';
  }

  // Extract first name from tenant name (e.g., "Mel Wallace" → "Mel")
  const firstName = tenantName?.split(' ')[0];

  const line1 = firstName ? `${timeGreeting}, ${firstName}.` : 'Welcome back.';
  const line2 = 'What revenue move do you want to make?';

  return { line1, line2 };
}

const CommandBar: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useSandbox();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { line1, line2 } = getGreeting(tenant?.name);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    navigate(`/ask-plexi?prefill=${encodeURIComponent(trimmed)}`);
  };

  const handleChipClick = (prompt: string) => {
    navigate(`/ask-plexi?prefill=${encodeURIComponent(prompt)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-blue-900/60 via-gray-800/80 to-gray-900/60 border border-gray-700/40 p-8 overflow-hidden">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Greeting */}
        <h1 className="text-2xl font-bold text-white mb-1">{line1}</h1>
        <p className="text-gray-400 text-sm mb-6">{line2}</p>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mb-5">
          <div className="relative">
            <Sparkles
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400/60"
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Find my best prospects today..."
              className="w-full pl-11 pr-4 py-3.5 bg-gray-800/60 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </form>

        {/* Quick action chips */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleChipClick(action.prompt)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded-full hover:bg-blue-600/20 hover:border-blue-500/40 hover:text-blue-300 transition-all"
              >
                <Icon size={14} />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommandBar;
