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
