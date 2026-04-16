// @ts-nocheck
/**
 * ConversationLibrary — collapsible sidebar listing past AskPlexi conversations.
 * Sprint B / B3.
 *
 * Contract:
 *   - Loads the list on mount and whenever `refreshKey` ticks (parent bumps
 *     after an exchange saves so the newest conversation surfaces at the top).
 *   - Click a row to load that conversation into the chat view.
 *   - "+ New Chat" clears the chat (parent handles by calling clearChat).
 *   - Pin/unpin and soft-delete hit PUT/DELETE /api/askplexi/conversations/:id.
 *
 * UX constraints (per spec):
 *   - Max width ~220px when expanded
 *   - Collapsible via hamburger
 *   - Default expanded on desktop, collapsed on mobile (≤768px)
 *   - Doesn't push chat area off-screen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';
import { useAskPlexiChat } from '../contexts/AskPlexiChatContext';

interface LibraryItem {
  id: string;
  title: string;
  pinned: boolean;
  message_count: number;
  updated_at: string;
  created_at: string;
}

interface ConversationLibraryProps {
  /** Tick this counter to force a refresh (parent bumps after new exchange). */
  refreshKey: number;
  /** Called when user clicks "+ New Chat" — parent clears chat. */
  onNewChat: () => void;
}

function formatRelative(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ConversationLibrary: React.FC<ConversationLibraryProps> = ({ refreshKey, onNewChat }) => {
  const { token } = useSandbox();
  const { conversationId, loadConversation } = useAskPlexiChat();

  // Default: expanded on desktop, collapsed on small screens.
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/askplexi/conversations?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data?.conversations) ? data.conversations : []);
    } catch (err: any) {
      console.error('[ConversationLibrary] fetch failed:', err);
      setError(err.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchList();
  }, [fetchList, refreshKey]);

  const handleClick = async (id: string) => {
    if (!token || busyId) return;
    if (id === conversationId) return; // already loaded
    setBusyId(id);
    const result = await loadConversation(id, token);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error || 'Load failed');
    }
  };

  const handleTogglePin = async (item: LibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/askplexi/conversations/${item.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pinned: !item.pinned }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchList();
    } catch (err: any) {
      setError(err.message || 'Pin failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: LibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    const label = item.title.length > 40 ? item.title.slice(0, 40) + '…' : item.title;
    if (!window.confirm(`Archive "${label}"? You can restore it later.`)) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/askplexi/conversations/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchList();
      // If we just archived the currently-open conversation, clear the chat.
      if (item.id === conversationId) onNewChat();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  // ------------------------- Collapsed rail -------------------------
  if (!expanded) {
    return (
      <div className="flex-shrink-0 w-10 border-r border-gray-700/40 bg-gray-900/40 flex flex-col items-center py-3 gap-2">
        <button
          onClick={() => setExpanded(true)}
          title="Open conversation library"
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/30 transition-colors"
        >
          <PanelLeftOpen size={16} />
        </button>
        <button
          onClick={onNewChat}
          title="New chat"
          className="p-1.5 rounded-md text-gray-400 hover:text-blue-300 hover:bg-gray-700/30 transition-colors"
        >
          <MessageSquarePlus size={16} />
        </button>
      </div>
    );
  }

  // ------------------------- Expanded panel -------------------------
  return (
    <div className="flex-shrink-0 w-56 border-r border-gray-700/40 bg-gray-900/40 flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/40">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Library</span>
        <button
          onClick={() => setExpanded(false)}
          title="Hide library"
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/30 transition-colors"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* New chat */}
      <button
        onClick={onNewChat}
        className="mx-2 mt-2 mb-1 inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-200 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 rounded-lg transition-colors"
      >
        <MessageSquarePlus size={14} />
        New Chat
      </button>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && items.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-500 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-xs text-red-400">
            {error}
            <button onClick={fetchList} className="block mt-2 text-gray-300 hover:text-white underline">
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-xs text-gray-500 text-center">
            No past conversations yet. Start chatting with Plexi and your history will appear here.
          </div>
        ) : (
          items.map(item => {
            const isActive = item.id === conversationId;
            const isBusy = busyId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={`group mx-2 mb-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors border ${
                  isActive
                    ? 'bg-blue-500/15 border-blue-500/40'
                    : 'border-transparent hover:bg-gray-700/40 hover:border-gray-700/40'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {item.pinned && (
                    <Pin size={10} className="text-amber-300 mt-0.5 flex-shrink-0" fill="currentColor" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs leading-snug line-clamp-2 ${isActive ? 'text-white font-medium' : 'text-gray-200'}`}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                      <span>{formatRelative(item.updated_at)}</span>
                      {item.message_count > 0 && <span>· {item.message_count} msg{item.message_count !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  <div className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${isBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {isBusy ? (
                      <Loader2 size={12} className="animate-spin text-gray-400" />
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleTogglePin(item, e)}
                          title={item.pinned ? 'Unpin' : 'Pin to top'}
                          className="p-0.5 text-gray-400 hover:text-amber-300"
                        >
                          {item.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                        </button>
                        <button
                          onClick={(e) => handleDelete(item, e)}
                          title="Archive conversation"
                          className="p-0.5 text-gray-400 hover:text-red-300"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationLibrary;
