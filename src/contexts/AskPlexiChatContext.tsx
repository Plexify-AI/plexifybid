/**
 * AskPlexiChatContext — persists Ask Plexi chat state across sidebar navigation.
 *
 * React Router unmounts route components on navigation, destroying local state.
 * This context lives above the Router so messages, conversation ID, chat history,
 * and pending email drafts survive when the user switches to Deal Room / Home / etc.
 * and returns to Ask Plexi.
 *
 * State is session-scoped (React state only, no localStorage). Clears on page
 * refresh — matching sandbox auth behavior.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// Mirror the Message type from AskPlexiInterface
interface ToolResult {
  tool: string;
  input: Record<string, any>;
  result: any;
}

export interface PlexiMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  toolsUsed?: string[];
  toolResults?: ToolResult[];
  isError?: boolean;
}

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

interface AskPlexiChatState {
  messages: PlexiMessage[];
  conversationId: string | null;
  chatHistory: ChatEntry[];
  emailDraft: any | null;
  inputDraft: string;
}

interface AskPlexiChatContextValue extends AskPlexiChatState {
  setMessages: React.Dispatch<React.SetStateAction<PlexiMessage[]>>;
  setConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setEmailDraft: React.Dispatch<React.SetStateAction<any | null>>;
  setInputDraft: React.Dispatch<React.SetStateAction<string>>;
  clearChat: () => void;
  hasExistingChat: boolean;
  // Sprint B / B3 — load a historical conversation into the chat view
  loadConversation: (id: string, token: string) => Promise<{ ok: boolean; error?: string }>;
}

const AskPlexiChatContext = createContext<AskPlexiChatContextValue | null>(null);

export function AskPlexiChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<PlexiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [emailDraft, setEmailDraft] = useState<any | null>(null);
  const [inputDraft, setInputDraft] = useState('');

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setChatHistory([]);
    setEmailDraft(null);
    setInputDraft('');
  }, []);

  // A chat exists if there are messages beyond the welcome message
  const hasExistingChat = messages.length > 1;

  // Load a historical conversation from the library into the chat view.
  // Rehydrates ui_messages → messages, messages → chatHistory, and sets
  // conversationId so subsequent sends continue the same conversation.
  const loadConversation = useCallback(
    async (id: string, token: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/askplexi/conversations/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, error: err.error || `HTTP ${res.status}` };
        }
        const data = await res.json();
        const conv = data?.conversation;
        if (!conv) return { ok: false, error: 'Empty response' };

        // ui_messages may be empty for conversations created before B3 shipped.
        // In that case reconstruct a minimal render from messages.
        const rich = Array.isArray(conv.ui_messages) && conv.ui_messages.length > 0
          ? conv.ui_messages.map((m: any, idx: number) => ({
              id: m.id || `hist-${id}-${idx}`,
              content: m.content || '',
              isUser: !!m.isUser,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(conv.updated_at || Date.now()),
              toolsUsed: m.toolsUsed,
              toolResults: m.toolResults,
              isError: m.isError,
            }))
          : (Array.isArray(conv.messages) ? conv.messages : []).map((m: any, idx: number) => ({
              id: `legacy-${id}-${idx}`,
              content: m.content || '',
              isUser: m.role === 'user',
              timestamp: new Date(conv.updated_at || Date.now()),
            }));

        const history: ChatEntry[] = Array.isArray(conv.messages)
          ? conv.messages
              .filter((m: any) => m?.role === 'user' || m?.role === 'assistant')
              .map((m: any) => ({ role: m.role, content: m.content || '' }))
          : [];

        setMessages(rich);
        setChatHistory(history);
        setConversationId(conv.id);
        setEmailDraft(null);
        setInputDraft('');
        return { ok: true };
      } catch (err: any) {
        console.error('[AskPlexiChat] loadConversation failed:', err);
        return { ok: false, error: err.message || 'Load failed' };
      }
    },
    []
  );

  return (
    <AskPlexiChatContext.Provider
      value={{
        messages,
        conversationId,
        chatHistory,
        emailDraft,
        inputDraft,
        setMessages,
        setConversationId,
        setChatHistory,
        setEmailDraft,
        setInputDraft,
        clearChat,
        hasExistingChat,
        loadConversation,
      }}
    >
      {children}
    </AskPlexiChatContext.Provider>
  );
}

export function useAskPlexiChat(): AskPlexiChatContextValue {
  const context = useContext(AskPlexiChatContext);
  if (!context) {
    throw new Error('useAskPlexiChat must be used within an AskPlexiChatProvider');
  }
  return context;
}
