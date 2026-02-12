import React, { useState, useRef, useEffect } from 'react';
import { Send, Clock, Target, BarChart3, Mail } from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  toolsUsed?: string[];
}

// Conversation history for the API (role/content pairs)
interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

// Loading status messages based on what Plexi is doing
const LOADING_MESSAGES = [
  'Plexi is searching your pipeline...',
  'Analyzing prospect data...',
  'Checking your connections...',
];

const AskPlexiInterface: React.FC = () => {
  const { token } = useSandbox();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Rotate loading messages for long requests
  useEffect(() => {
    if (isLoading) {
      let i = 0;
      loadingInterval.current = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[i]);
      }, 2500);
    } else if (loadingInterval.current) {
      clearInterval(loadingInterval.current);
      loadingInterval.current = null;
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, [isLoading]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content:
        "Welcome to Ask Plexi! I'm your AI business development specialist for AEC. " +
        'I have access to your live prospect pipeline, contact network, and case study library. ' +
        'Ask me about prospects, draft outreach emails, or get a pipeline analysis.',
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  const handleSendMessage = async () => {
    if (!currentQuery.trim() || isLoading) return;

    const query = currentQuery.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      content: query,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentQuery('');
    setIsLoading(true);
    setLoadingMessage(LOADING_MESSAGES[0]);

    try {
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
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
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

      // Build tool labels for the footer
      const toolsUsed = data.tool_results?.map((t: any) => t.tool) || [];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.reply,
        isUser: false,
        timestamp: new Date(),
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('[AskPlexi] Error:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Sorry, I ran into an issue: ${err.message}. Please try again.`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Tool name → friendly label
  const toolLabel = (name: string) => {
    const labels: Record<string, string> = {
      search_prospects: 'Pipeline Search',
      draft_outreach: 'Email Draft',
      analyze_pipeline: 'Pipeline Analysis',
    };
    return labels[name] || name;
  };

  // Tool name → icon
  const toolIcon = (name: string) => {
    switch (name) {
      case 'search_prospects':
        return <Target size={10} className="inline" />;
      case 'draft_outreach':
        return <Mail size={10} className="inline" />;
      case 'analyze_pipeline':
        return <BarChart3 size={10} className="inline" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img
                src="/assets/logos/Gray Plexify P-only no bkgrd.png"
                alt="Ask Plexi"
                className="w-8 h-8 filter brightness-0 invert"
              />
              <h1 className="text-2xl font-bold text-white">Ask Plexi</h1>
            </div>
            <div className="flex items-center space-x-2 bg-green-600 bg-opacity-20 px-3 py-1 rounded-full border border-green-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-green-300">Live Data</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl p-4 rounded-2xl ${
                  message.isUser
                    ? 'bg-blue-600 text-white ml-8'
                    : 'bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 mr-8'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>

                {/* Tool badges */}
                {!message.isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="flex items-center gap-2 flex-wrap">
                      {message.toolsUsed.map((tool, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-600 bg-opacity-20 border border-blue-500 border-opacity-30 rounded-full text-blue-300"
                        >
                          {toolIcon(tool)} {toolLabel(tool)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
                  <Clock size={10} />
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3xl p-4 rounded-2xl bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 mr-8">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                  </div>
                  <span className="text-gray-300 text-sm">{loadingMessage}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="px-6 py-3 border-t border-gray-700">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-gray-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Show me my best prospects',
              'Draft outreach for the top prospect',
              "How's my pipeline looking?",
              'Find healthcare projects with high warmth',
            ].map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuery(suggestion)}
                className="px-3 py-1 text-xs bg-gray-800 bg-opacity-50 border border-gray-600 rounded-full hover:bg-gray-700 hover:border-gray-500 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-700">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <textarea
                value={currentQuery}
                onChange={(e) => setCurrentQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about prospects, draft outreach, or analyze your pipeline..."
                className="w-full px-4 py-3 bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!currentQuery.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl transition-colors"
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
