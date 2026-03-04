import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Clock, Target, BarChart3, Mail, Copy, Check, AlertCircle, Zap } from 'lucide-react';
import Markdown from 'react-markdown';
import { useSandbox } from '../contexts/SandboxContext';
import ProspectCardList from './ProspectCardList';
import OutreachPreview, { parseEmail } from './OutreachPreview';
import PipelineAnalysis from './PipelineAnalysis';
import { POWERFLOW_LEFT_PROMPTS } from '../constants/powerflowLeftPyramidPrompts';

// Structured tool result from the API
interface ToolResult {
  tool: string;
  input: Record<string, any>;
  result: any;
}

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  toolsUsed?: string[];
  toolResults?: ToolResult[];
  isError?: boolean;
}

// Conversation history for the API (role/content pairs)
interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

// Loading status messages — rotate every 2.5s
const LOADING_MESSAGES = [
  'Searching your pipeline...',
  'Analyzing prospect data...',
  'Checking your connections...',
  'Reviewing case studies...',
  'Preparing your intelligence briefing...',
];

const DEEP_ANALYSIS_MSG = 'Plexi is doing deep analysis. Hang tight.';
const DEEP_ANALYSIS_THRESHOLD = 10_000; // 10 seconds

const AskPlexiInterface: React.FC = () => {
  const { token, logout } = useSandbox();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoSent, setAutoSent] = useState(false);
  const [powerflowLevel, setPowerflowLevel] = useState<number | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const deepTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingMessage]);

  // Rotate loading messages + deep analysis fallback
  useEffect(() => {
    if (isLoading) {
      let i = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);

      loadingInterval.current = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[i]);
      }, 2500);

      deepTimeout.current = setTimeout(() => {
        setLoadingMessage(DEEP_ANALYSIS_MSG);
        if (loadingInterval.current) {
          clearInterval(loadingInterval.current);
          loadingInterval.current = null;
        }
      }, DEEP_ANALYSIS_THRESHOLD);
    } else {
      if (loadingInterval.current) {
        clearInterval(loadingInterval.current);
        loadingInterval.current = null;
      }
      if (deepTimeout.current) {
        clearTimeout(deepTimeout.current);
        deepTimeout.current = null;
      }
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
      if (deepTimeout.current) clearTimeout(deepTimeout.current);
    };
  }, [isLoading]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content:
        "I'm your AI business development specialist for AEC. " +
        'I have access to your **live prospect pipeline**, contact network, and case study library.\n\n' +
        'Try asking me to find prospects, draft outreach emails, or analyze your pipeline.',
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  // Auto-send from ?q= URL param (e.g., from Home action cards)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoSent && messages.length > 0) {
      setAutoSent(true);
      // Clear the ?q= param from URL so refresh doesn't re-send
      setSearchParams({}, { replace: true });
      // Small delay so welcome message renders first
      setTimeout(() => handleSendMessage(q), 300);
    }
  }, [searchParams, autoSent, messages.length]);

  // Prefill from ?prefill= URL param (e.g., from PowerflowPyramid capsule buttons)
  // Sets input text WITHOUT auto-sending — user reviews and clicks Send
  useEffect(() => {
    const prefill = searchParams.get('prefill');
    const level = searchParams.get('level');
    if (prefill && !prefillApplied) {
      setPrefillApplied(true);
      setCurrentQuery(prefill);
      if (level) {
        setPowerflowLevel(parseInt(level, 10));
      }
      // Clear URL params so refresh doesn't re-prefill
      setSearchParams({}, { replace: true });
      // Focus and auto-grow the textarea
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
      }, 100);
    }
  }, [searchParams, prefillApplied]);

  // Auto-grow textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentQuery(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  // Friendly error messages
  const getFriendlyError = (err: any, status?: number): string => {
    if (status === 401) {
      // Token expired — trigger logout after showing message
      setTimeout(() => logout(), 3000);
      return 'Your session has expired. Redirecting to sign in...';
    }
    if (status === 429) {
      return "You're moving fast! Give Plexi a moment to catch up. Try again in 30 seconds.";
    }
    if (err?.message?.includes('fetch') || err?.message?.includes('network') || err?.name === 'TypeError') {
      return 'Connection timed out. Check your internet and try again.';
    }
    return 'Plexi is having trouble connecting. Try again in a moment.';
  };

  const handleSendMessage = async (queryOverride?: string) => {
    const query = (queryOverride || currentQuery).trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: query,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentQuery('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    setLoadingMessage(LOADING_MESSAGES[0]);

    let status: number | undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout

      const response = await fetch('/api/ask-plexi/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: query,
          conversation_id: conversationId,
          history: chatHistory,
          ...(powerflowLevel ? { powerflow_level: powerflowLevel } : {}),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      status = response.status;

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (err.details) {
          console.error('[AskPlexi] Server error details:', err.details);
        }
        throw new Error(err.error || `Request failed (${response.status})`);
      }

      const data = await response.json();

      // Track conversation
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      // Update chat history for context
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: query },
        { role: 'assistant', content: data.reply },
      ]);

      // Build tool labels + structured results for rich rendering
      const toolsUsed = data.tool_results?.map((t: any) => t.tool) || [];
      const toolResults: ToolResult[] = data.tool_results || [];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.reply,
        isUser: false,
        timestamp: new Date(),
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('[AskPlexi] Error:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: getFriendlyError(err, status),
        isUser: false,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Clear powerflow level after send (one-shot)
      if (powerflowLevel) setPowerflowLevel(null);
      // Re-focus input after response
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy message content to clipboard
  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Tool name -> friendly label + emoji
  const toolLabel = (name: string) => {
    const labels: Record<string, string> = {
      search_prospects: 'Pipeline Search',
      draft_outreach: 'Email Draft',
      analyze_pipeline: 'Pipeline Analysis',
    };
    return labels[name] || name;
  };

  const toolEmoji = (name: string) => {
    const emojis: Record<string, string> = {
      search_prospects: '\u{1F50D}',
      draft_outreach: '\u{1F4E7}',
      analyze_pipeline: '\u{1F4CA}',
    };
    return emojis[name] || '\u{2699}';
  };

  // Tool name -> icon component
  const toolIcon = (name: string) => {
    switch (name) {
      case 'search_prospects':
        return <Target size={12} className="inline" />;
      case 'draft_outreach':
        return <Mail size={12} className="inline" />;
      case 'analyze_pipeline':
        return <BarChart3 size={12} className="inline" />;
      default:
        return null;
    }
  };

  // Action: send "Draft outreach for [prospect]" into chat
  const handleDraftOutreach = (prospectName: string, refId: string) => {
    handleSendMessage(`Draft an outreach email for ${prospectName} (${refId})`);
  };

  /**
   * Strip raw data dumps from Claude's text when the UI renders structured cards.
   * Aggressively removes markdown tables, numbered/bullet data lists, intro
   * preamble, and bold-labeled prospect entries that duplicate card content.
   * Keeps only narrative insights, recommendations, and commentary.
   */
  const stripRawDataFromText = (text: string): string => {
    const lines = text.split('\n');
    const cleaned: string[] = [];
    let inTable = false;
    let inDataList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      const pipeCount = (trimmed.match(/\|/g) || []).length;

      // --- TABLE DETECTION (aggressive) ---
      // Any line with 3+ pipe characters is almost certainly a table row
      if (pipeCount >= 3) {
        inTable = true;
        continue;
      }
      // Standard table rows (start + end with |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && pipeCount >= 1) {
        inTable = true;
        continue;
      }
      // Table separator rows: |---|---|
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      // Table ended when we hit a line with fewer than 2 pipes
      if (inTable && pipeCount < 2 && !trimmed.startsWith('|')) {
        inTable = false;
      }
      if (inTable) continue;

      // --- DATA LIST DETECTION ---
      // Numbered items with prospect data (warmth, score, value, phase, etc.)
      // e.g. "1. **555 W 34th St** — Warmth: 87, Turner Construction"
      if (/^\d+\.\s/.test(trimmed) && /(warmth|score|warm|phase|stage|\$[\d,]+[MmKk]?|\/100)/i.test(trimmed)) {
        inDataList = true;
        continue;
      }
      // Bullet items with prospect data
      if (/^[-•*]\s/.test(trimmed) && /(warmth|score|warm|phase|stage|\$[\d,]+[MmKk]?|\/100)/i.test(trimmed)) {
        inDataList = true;
        continue;
      }
      // Numbered items with bold names followed by details (common Claude data dump pattern)
      if (/^\d+\.\s+\*\*[^*]+\*\*/.test(trimmed) && trimmed.length > 60) {
        inDataList = true;
        continue;
      }
      // If we were in a data list, skip continuation list items
      if (inDataList) {
        if (/^\d+\.\s/.test(trimmed) || /^[-•*]\s/.test(trimmed)) {
          continue; // still in list
        }
        if (trimmed === '') {
          continue; // blank line between list items
        }
        // Non-list content → list ended
        inDataList = false;
      }

      // --- HEADING DETECTION ---
      // Skip headings that label data sections
      if (/^#{1,3}\s*(Your\s+)?(Top|Warmest|Hottest|Best|Key)\s+\d*\s*(Deals|Opportunities|Prospects|Projects)/i.test(trimmed)) continue;
      if (/^#{1,3}\s*Pipeline\s+(Overview|Snapshot|Summary|Analysis|Breakdown|Health)/i.test(trimmed)) continue;
      if (/^#{1,3}\s*(Deal|Opportunity|Prospect|Project)\s+(Details|Breakdown|List|Rankings?|Overview|Summary)/i.test(trimmed)) continue;
      if (/^#{1,3}\s*(Ranked|Complete|Full|Detailed)\s+(List|Breakdown|Overview|Summary)/i.test(trimmed)) continue;
      // "### Summary Table" / "### Data Overview"
      if (/^#{1,3}\s*(Summary|Overview|Breakdown)\s*(Table|Data|of\s)/i.test(trimmed)) continue;
      // Bold-only headings acting as section labels for data dumps
      if (/^\*\*(Your\s+)?(Top|Warmest|Hottest|Best)\s+\d*\s*(Deals|Opportunities|Prospects|Projects)/i.test(trimmed)) continue;
      if (/^\*\*Pipeline\s+(Overview|Summary|Breakdown)/i.test(trimmed)) continue;

      // --- PREAMBLE / INTRO SENTENCES ---
      // "Here are your top 5 warmest deals:" / "Here is a breakdown..."
      if (/^(Here (are|is)|Below (are|is))\s.*(top|warmest|hottest|coldest|pipeline|prospects?|deals?|opportunities?|ranked|sorted|breakdown)/i.test(trimmed)) continue;
      // "Based on your pipeline data:" (only when ending with colon = introducing a list)
      if (/^Based on\s.*(pipeline|data|analysis|warmth|score|prospects)/i.test(trimmed) && trimmed.endsWith(':')) continue;
      // "I found X prospects/deals matching..."
      if (/^I (found|identified)\s+\d+\s+(prospects?|deals?|opportunities?|projects?)/i.test(trimmed)) continue;
      // "Looking at your pipeline/data:" (colon ending = introducing a list)
      if (/^Looking at\s.*(pipeline|data|deals|prospects)/i.test(trimmed) && trimmed.endsWith(':')) continue;
      // "Let me rank/list/show them..." (introducing data)
      if (/^Let me\s+(rank|list|show|break|lay)/i.test(trimmed) && trimmed.endsWith(':')) continue;

      // --- STANDALONE DATA LINES ---
      // "**Project Name** - Warmth Score: 87/100"
      if (/^\*\*[^*]+\*\*\s*[-—–:]\s*(Warmth|Score|Rating|Value|Phase|Stage|Est)/i.test(trimmed)) continue;

      cleaned.push(line);
    }

    // Collapse multiple blank lines
    return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  // Render structured tool results as rich UI components
  const renderToolResults = (message: Message) => {
    if (!message.toolResults || message.toolResults.length === 0) return null;

    return message.toolResults.map((tr, i) => {
      // search_prospects → ProspectCardList
      if (tr.tool === 'search_prospects' && tr.result?.prospects?.length > 0) {
        return (
          <ProspectCardList
            key={`tool-${i}`}
            data={tr.result}
            onDraftOutreach={handleDraftOutreach}
          />
        );
      }

      // draft_outreach → OutreachPreview (email is in Claude's text reply)
      if (tr.tool === 'draft_outreach' && tr.result?.email_context) {
        return (
          <OutreachPreview
            key={`tool-${i}`}
            replyContent={message.content}
            emailContext={tr.result.email_context}
          />
        );
      }

      // analyze_pipeline → PipelineAnalysis
      if (tr.tool === 'analyze_pipeline' && tr.result?.total_prospects != null) {
        return (
          <PipelineAnalysis
            key={`tool-${i}`}
            data={tr.result}
            onDraftOutreach={handleDraftOutreach}
          />
        );
      }

      return null;
    });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img
                src="/assets/logos/plexify-mark-gray.png"
                alt="Ask Plexi"
                className="w-8 h-8 filter brightness-0 invert"
              />
              <h1 className="text-xl font-bold text-white">Ask Plexi</h1>
            </div>
            <div className="flex items-center space-x-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-300 font-medium">Live Data</span>
            </div>
            {powerflowLevel && (() => {
              const entry = POWERFLOW_LEFT_PROMPTS.find((p) => p.level === powerflowLevel);
              return entry ? (
                <div className="flex items-center space-x-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">
                  <Zap size={12} className="text-blue-400" />
                  <span className="text-xs text-blue-300 font-medium">
                    Level {entry.level} &mdash; {entry.maslow} &rarr; {entry.bloom}
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-5 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-2xl ${
                  message.isUser
                    ? 'max-w-3xl bg-blue-600 text-white ml-12 px-4 py-3'
                    : message.isError
                    ? 'max-w-3xl bg-red-900/30 backdrop-blur-sm border border-red-500/30 mr-12 px-5 py-4'
                    : message.toolResults?.length
                    ? 'w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 mr-4 px-5 py-4'
                    : 'max-w-3xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 mr-12 px-5 py-4'
                }`}
              >
                {/* Error icon for error messages */}
                {message.isError && (
                  <div className="flex items-center gap-2 mb-2 text-red-300">
                    <AlertCircle size={16} />
                    <span className="text-sm font-medium">Connection Issue</span>
                  </div>
                )}

                {/* Message content — markdown for assistant, plain for user */}
                {message.isUser ? (
                  <div className="text-sm leading-relaxed">{message.content}</div>
                ) : (
                  <>
                    {/* For draft_outreach: OutreachPreview for email, Markdown for commentary */}
                    {message.toolResults?.some((tr) => tr.tool === 'draft_outreach') ? (
                      <>
                        {renderToolResults(message)}
                        {/* Render post-email commentary (e.g. "Why this works") through Markdown */}
                        {(() => {
                          const { commentary } = parseEmail(message.content);
                          if (!commentary) return null;
                          return (
                            <div className="plexi-prose text-sm leading-relaxed mt-3 pt-3 border-t border-gray-700/50">
                              <Markdown
                                components={{
                                  h1: ({ children }) => <h3 className="text-lg font-bold text-white mt-3 mb-2">{children}</h3>,
                                  h2: ({ children }) => <h3 className="text-base font-bold text-white mt-3 mb-2">{children}</h3>,
                                  h3: ({ children }) => <h4 className="text-sm font-semibold text-white mt-2 mb-1">{children}</h4>,
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  strong: ({ children }) => <strong className="font-semibold text-blue-200">{children}</strong>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-gray-200">{children}</li>,
                                  hr: () => <hr className="border-gray-600 my-3" />,
                                }}
                              >
                                {commentary}
                              </Markdown>
                            </div>
                          );
                        })()}
                      </>
                    ) : message.toolResults?.some((tr) => tr.tool === 'analyze_pipeline' || tr.tool === 'search_prospects') ? (
                      <>
                        {/* Strip raw tables/data from Claude's text — the cards render it visually */}
                        {(() => {
                          const cleaned = stripRawDataFromText(message.content);
                          if (!cleaned) return null;
                          return (
                            <div className="plexi-prose text-sm leading-relaxed mb-3">
                              <Markdown
                                components={{
                                  h1: ({ children }) => <h3 className="text-lg font-bold text-white mt-3 mb-2">{children}</h3>,
                                  h2: ({ children }) => <h3 className="text-base font-bold text-white mt-3 mb-2">{children}</h3>,
                                  h3: ({ children }) => <h4 className="text-sm font-semibold text-white mt-2 mb-1">{children}</h4>,
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  strong: ({ children }) => <strong className="font-semibold text-blue-200">{children}</strong>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-gray-200">{children}</li>,
                                  hr: () => <hr className="border-gray-600 my-3" />,
                                  // Suppress any tables that survive text stripping — cards handle data display
                                  table: () => null,
                                  thead: () => null,
                                  tbody: () => null,
                                  tr: () => null,
                                  th: () => null,
                                  td: () => null,
                                }}
                              >
                                {cleaned}
                              </Markdown>
                            </div>
                          );
                        })()}
                        {renderToolResults(message)}
                      </>
                    ) : (
                      <>
                        <div className="plexi-prose text-sm leading-relaxed">
                          <Markdown
                            components={{
                              h1: ({ children }) => <h3 className="text-lg font-bold text-white mt-3 mb-2">{children}</h3>,
                              h2: ({ children }) => <h3 className="text-base font-bold text-white mt-3 mb-2">{children}</h3>,
                              h3: ({ children }) => <h4 className="text-sm font-semibold text-white mt-2 mb-1">{children}</h4>,
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-blue-200">{children}</strong>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-gray-200">{children}</li>,
                              a: ({ href, children }) => (
                                <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
                                  {children}
                                </a>
                              ),
                              code: ({ children }) => (
                                <code className="bg-gray-700/50 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300">{children}</code>
                              ),
                              hr: () => <hr className="border-gray-600 my-3" />,
                            }}
                          >
                            {message.content}
                          </Markdown>
                        </div>
                        {/* Structured tool results below the markdown text */}
                        {renderToolResults(message)}
                      </>
                    )}
                  </>
                )}

                {/* Tool badges */}
                {!message.isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-600/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      {message.toolsUsed.map((tool, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-500/15 border border-blue-500/30 rounded-full text-blue-300 font-medium"
                        >
                          {toolIcon(tool)} {toolLabel(tool)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer: timestamp + copy button */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Clock size={10} />
                    <span>{message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  {!message.isUser && !message.isError && message.id !== 'welcome' && (
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check size={12} className="text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3xl px-5 py-4 rounded-2xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 mr-12">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                  <span className="text-gray-300 text-sm">{loadingMessage}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Suggestions — only show when few messages */}
      {messages.length <= 2 && !isLoading && (
        <div className="px-6 py-3 border-t border-gray-700/50">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-gray-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Show me my best prospects',
                'Draft outreach for the top prospect',
                "How's my pipeline looking?",
                'Find healthcare projects with high warmth',
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(suggestion)}
                  className="px-3 py-1.5 text-xs bg-gray-800/50 border border-gray-600 rounded-full hover:bg-blue-600/20 hover:border-blue-500/40 hover:text-blue-300 transition-all cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-700/50 bg-gray-900/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={currentQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder="Ask about prospects, draft outreach, or analyze your pipeline..."
                className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none transition-colors"
                rows={1}
                disabled={isLoading}
                style={{ maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => handleSendMessage()}
              disabled={!currentQuery.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-xl transition-all hover:scale-105 active:scale-95"
              title="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskPlexiInterface;
