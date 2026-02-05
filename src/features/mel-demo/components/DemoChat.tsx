import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { DemoMessage } from './DemoMessage';
import { QuickActions } from './QuickActions';
import { DemoBadge } from './DemoBadge';
import { demoEngine } from '../services/DemoEngine';
import type {
  DemoMessage as DemoMessageType,
  DemoState,
  DemoStep,
  DemoAgent,
} from '../MelDemo.types';

function createId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function detectIntent(text: string): { step: DemoStep; agent: DemoAgent } | null {
  const lower = text.toLowerCase();
  if (lower.includes('prospect') || lower.includes('best') || lower.includes('q1') || lower.includes('show me'))
    return { step: 'prospect-query', agent: 'place-graph' };
  if (lower.includes('outreach') || lower.includes('draft') || lower.includes('email'))
    return { step: 'outreach', agent: 'ask-plexi' };
  if (lower.includes('win') || lower.includes('probability') || lower.includes('chance') || lower.includes('score'))
    return { step: 'win-probability', agent: 'notebook-bd' };
  return null;
}

function parseProspectIndex(text: string): number {
  const lower = text.toLowerCase();
  if (lower.includes('#3') || lower.includes('number 3') || lower.includes('three') || lower.includes('madison'))
    return 2;
  if (lower.includes('#2') || lower.includes('number 2') || lower.includes('two') || lower.includes('penn'))
    return 1;
  return 0;
}

export function DemoChat() {
  const [state, setState] = useState<DemoState>({
    step: 'idle',
    messages: [],
    isLoading: false,
    activeAgent: null,
    selectedProspectIndex: null,
  });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addMessage = useCallback((msg: DemoMessageType) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, msg] }));
  }, []);

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim() || state.isLoading) return;

    const userMsg: DemoMessageType = {
      id: createId(),
      role: 'user',
      contentType: 'text',
      text: text.trim(),
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInput('');

    const intent = detectIntent(text);
    if (!intent) {
      const fallback: DemoMessageType = {
        id: createId(),
        role: 'assistant',
        contentType: 'text',
        text: 'Try asking me to "Show me my best prospects for Q1", "Draft outreach for number 1", or "What\'s my win probability?"',
        timestamp: Date.now(),
      };
      addMessage(fallback);
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, activeAgent: intent.agent }));

    try {
      if (intent.step === 'prospect-query') {
        const response = await demoEngine.queryProspects(text);
        const msg: DemoMessageType = {
          id: createId(),
          role: 'assistant',
          contentType: 'prospect-query',
          agent: intent.agent,
          prospectQueryResponse: response,
          timestamp: Date.now(),
        };
        addMessage(msg);
        setState((prev) => ({
          ...prev,
          step: 'prospect-query',
          isLoading: false,
          activeAgent: null,
        }));
      } else if (intent.step === 'outreach') {
        const prospectIdx = parseProspectIndex(text);
        const response = await demoEngine.generateOutreach(prospectIdx);
        const msg: DemoMessageType = {
          id: createId(),
          role: 'assistant',
          contentType: 'outreach',
          agent: intent.agent,
          outreachResponse: response,
          timestamp: Date.now(),
        };
        addMessage(msg);
        setState((prev) => ({
          ...prev,
          step: 'outreach',
          isLoading: false,
          activeAgent: null,
          selectedProspectIndex: prospectIdx,
        }));
      } else if (intent.step === 'win-probability') {
        const prospectIdx = state.selectedProspectIndex ?? 0;
        const response = await demoEngine.scoreWinProbability(prospectIdx);
        const msg: DemoMessageType = {
          id: createId(),
          role: 'assistant',
          contentType: 'win-probability',
          agent: intent.agent,
          winProbabilityResponse: response,
          timestamp: Date.now(),
        };
        addMessage(msg);
        setState((prev) => ({
          ...prev,
          step: 'win-probability',
          isLoading: false,
          activeAgent: null,
        }));
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false, activeAgent: null }));
    }
  }, [state.isLoading, state.selectedProspectIndex, addMessage]);

  const handleReset = useCallback(() => {
    demoEngine.reset();
    setState({
      step: 'idle',
      messages: [],
      isLoading: false,
      activeAgent: null,
      selectedProspectIndex: null,
    });
    setInput('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{
        backgroundImage: "url('/demo-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <DemoBadge />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {state.messages.length === 0 && (
            <div className="text-center py-20">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Plexify Prospecting Agent
              </h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Ask me to find your best prospects, draft personalized outreach, or score your win probability.
              </p>
            </div>
          )}

          {state.messages.map((msg) => (
            <DemoMessage key={msg.id} message={msg} />
          ))}

          {/* Loading indicator */}
          {state.isLoading && state.activeAgent && (
            <div className="flex justify-start">
              <div className="max-w-2xl w-full">
                <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border-l-3 border-primary-500 rounded-r-lg text-sm text-primary-700">
                  <Loader2 size={14} className="animate-spin" />
                  <span>
                    {state.activeAgent === 'place-graph' && 'Scanning Dodge Construction Central data...'}
                    {state.activeAgent === 'ask-plexi' && 'Generating personalized outreach...'}
                    {state.activeAgent === 'notebook-bd' && 'Analyzing deal factors...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions
        currentStep={state.step}
        onAction={handleSubmit}
        onReset={handleReset}
        disabled={state.isLoading}
      />

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              state.step === 'idle'
                ? 'Try: "Show me my best prospects for Q1"'
                : state.step === 'prospect-query'
                  ? 'Try: "Draft outreach for number 1"'
                  : state.step === 'outreach'
                    ? 'Try: "What\'s my win probability?"'
                    : 'Type a message...'
            }
            disabled={state.isLoading}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm
              placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500
              focus:border-primary-500 disabled:opacity-50 transition-all duration-200"
          />
          <button
            type="button"
            onClick={() => handleSubmit(input)}
            disabled={state.isLoading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600
              text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200"
          >
            {state.isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
