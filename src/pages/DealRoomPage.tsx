/**
 * DealRoomPage — Two-panel Deal Room workspace.
 *
 * LEFT (40%): Source library with drag-drop upload + source cards.
 * RIGHT (60%): RAG-grounded chat with citation chips.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Briefcase, Upload, Send, ArrowLeft, Loader2,
  FileText, MessageSquare, Sparkles, BookOpen, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import DealRoomSourceCard, { type SourceDoc } from '../components/DealRoomSourceCard';
import { useSandbox } from '../contexts/SandboxContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealRoom {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
}

interface Citation {
  source_id: string;
  source_name: string;
  chunk_index: number;
  text: string;
}

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  { label: 'Summarize all sources', query: 'Summarize all my sources' },
  { label: 'Key risks', query: 'What are the key risks in this deal?' },
  { label: 'Talking points', query: 'Draft talking points for the next meeting' },
  { label: 'Competitive landscape', query: 'Compare the competitive landscape' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DealRoomPage: React.FC = () => {
  const { id: dealRoomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useSandbox();

  // Room state
  const [room, setRoom] = useState<DealRoom | null>(null);
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const jsonHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  // Load deal room data
  const fetchRoom = useCallback(async () => {
    if (!token || !dealRoomId) return;
    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}`, { headers: headers() });
      if (!res.ok) throw new Error('Failed to load deal room');
      const data = await res.json();
      setRoom(data.deal_room);
      setSources(data.sources || []);
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, dealRoomId, headers]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Upload handler
  // ---------------------------------------------------------------------------

  const handleUpload = async (file: File) => {
    if (!token || !dealRoomId) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'docx', 'txt', 'md', 'csv'];
    if (!ext || !allowed.includes(ext)) {
      setError(`Unsupported file type: .${ext}. Allowed: ${allowed.join(', ')}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/deal-rooms/${dealRoomId}/sources`, {
        method: 'POST',
        headers: headers(),
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      const newSource = await res.json();
      setSources((prev) => [newSource, ...prev]);
      setUploadProgress(null);
    } catch (err: any) {
      setError(err.message);
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  // ---------------------------------------------------------------------------
  // Delete source
  // ---------------------------------------------------------------------------

  const handleDeleteSource = async (sourceId: string) => {
    if (!token || !dealRoomId) return;
    setDeletingId(sourceId);
    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/sources/${sourceId}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) throw new Error('Failed to delete source');
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Chat handler
  // ---------------------------------------------------------------------------

  const handleSend = async (message?: string) => {
    const text = message || chatInput.trim();
    if (!text || !token || !dealRoomId || sending) return;

    setChatInput('');
    setSending(true);
    setError(null);

    // Optimistic add user message
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/chat`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Chat failed (${res.status})`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        citations: data.citations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message);
      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading deal room...</span>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-300">Deal room not found</p>
          <button
            onClick={() => navigate('/deal-rooms')}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            Back to Deal Rooms
          </button>
        </div>
      </div>
    );
  }

  const readySources = sources.filter((s) => s.processing_status === 'ready').length;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      {/* Top Bar */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-700/40 bg-gray-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/deal-rooms')}
            className="p-1.5 rounded-lg hover:bg-gray-700/30 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Briefcase size={16} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{room.name}</h1>
            {room.description && (
              <p className="text-[11px] text-gray-500 truncate">{room.description}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-gray-500">
            <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
            <span>{readySources} ready</span>
          </div>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle size={14} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-300 text-xs">dismiss</button>
        </div>
      )}

      {/* Two-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT PANEL — Sources (40%) */}
        <div className="w-[40%] border-r border-gray-700/40 flex flex-col overflow-hidden">
          {/* Upload Zone */}
          <div className="shrink-0 p-4">
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-gray-700/50 hover:border-gray-600/60 hover:bg-gray-800/20'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">{uploadProgress || 'Processing...'}</span>
                </div>
              ) : (
                <>
                  <Upload size={20} className={`mx-auto mb-1 ${dragOver ? 'text-blue-400' : 'text-gray-500'}`} />
                  <p className="text-xs text-gray-400">
                    Drop files here or <span className="text-blue-400">browse</span>
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">PDF, DOCX, TXT, MD, CSV (max 10MB)</p>
                </>
              )}
            </div>
          </div>

          {/* Source List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {sources.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen size={24} className="text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No sources yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Upload documents to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => (
                  <DealRoomSourceCard
                    key={source.id}
                    source={source}
                    onDelete={handleDeleteSource}
                    isDeleting={deletingId === source.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Chat (60%) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              /* Empty chat state */
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Sparkles size={24} className="text-blue-400" />
                </div>
                <h3 className="text-base font-medium text-gray-300 mb-1">Ask about your sources</h3>
                <p className="text-xs text-gray-500 mb-6 max-w-sm text-center">
                  Upload documents, then ask Plexi to analyze, summarize, or compare them. All answers are grounded in your source material.
                </p>

                {/* Suggested prompts */}
                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                  {SUGGESTED_PROMPTS.map((sp) => (
                    <button
                      key={sp.label}
                      onClick={() => handleSend(sp.query)}
                      disabled={sending || readySources === 0}
                      className="px-3 py-1.5 bg-gray-800/50 border border-gray-700/40 rounded-full text-xs text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
                {readySources === 0 && sources.length > 0 && (
                  <p className="text-[10px] text-amber-400/70 mt-3">Sources are still processing...</p>
                )}
              </div>
            ) : (
              /* Message list */
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-blue-500/20 border border-blue-500/30 text-white'
                          : 'bg-gray-800/50 border border-gray-700/40 text-gray-200'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1 [&_li]:my-0.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}

                      {/* Citation chips */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-700/30">
                          {msg.citations.map((cite, ci) => (
                            <span
                              key={ci}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-300"
                              title={cite.text}
                            >
                              <FileText size={9} />
                              {cite.source_name}, Chunk {cite.chunk_index}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Thinking indicator */}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                        </div>
                        <span>Analyzing sources...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="shrink-0 p-4 border-t border-gray-700/40 bg-gray-900/40">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={readySources > 0 ? 'Ask about your sources...' : 'Upload sources to start chatting...'}
                  disabled={sending}
                  rows={1}
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!chatInput.trim() || sending}
                className="p-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                {sending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 px-1">
              {readySources} of {sources.length} sources ready. Responses cite uploaded documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealRoomPage;
