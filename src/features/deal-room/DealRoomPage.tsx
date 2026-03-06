import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useDealRoom } from './hooks/useDealRoom';
import { useDealRoomSources } from './hooks/useDealRoomSources';
import { useDealRoomChat } from './hooks/useDealRoomChat';
import DealRoomHeader from './DealRoomHeader';
import DealRoomTabs from './DealRoomTabs';
import DealRoomLayout from './DealRoomLayout';
import SourcesPanel from './panels/SourcesPanel';
import EditorPanel from './panels/EditorPanel';
import AssistantPanel from './panels/AssistantPanel';
import type { DealRoomMessage, DealRoomTab } from '../../types/dealRoom';

const DealRoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<DealRoomMessage[]>([]);

  const {
    room,
    sources,
    messages: initialMessages,
    artifacts,
    loading,
    error,
    saving,
    lastSaved,
    activeTab,
    setActiveTab,
    saveTabContent,
    refetch,
  } = useDealRoom(id);

  // Sync initial messages once
  React.useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Chat hook with new message callback
  const handleNewMessages = useCallback((userMsg: DealRoomMessage, aiMsg: DealRoomMessage) => {
    setMessages(prev => [...prev, userMsg, aiMsg]);
  }, []);

  const { sending, sendMessage } = useDealRoomChat(id, handleNewMessages);

  // Source management
  const { uploading, uploadProgress, uploadFile, deleteSource } = useDealRoomSources(id, refetch);

  // Current tab content from room data
  const currentContent = useMemo(() => {
    if (!room?.tab_content) return '';
    return (room.tab_content as Record<string, string>)[activeTab] || '';
  }, [room?.tab_content, activeTab]);

  // Handle tab change — saves current content then switches
  const handleTabChange = useCallback((tab: DealRoomTab) => {
    setActiveTab(tab);
  }, [setActiveTab]);

  // Handle editor content change (debounced save)
  const handleContentChange = useCallback((tab: DealRoomTab, content: string) => {
    saveTabContent(tab, content);
  }, [saveTabContent]);

  // Handle chat send
  const handleSendMessage = useCallback(async (message: string, actionChip?: string) => {
    return sendMessage(message, actionChip);
  }, [sendMessage]);

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <img src="/assets/logos/flat_P_logo.png" alt="P" className="w-7 h-7" />
          </div>
          <p className="text-white/40 text-sm">Loading Deal Room...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !room) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error || 'Deal Room not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="text-sm text-white/60 hover:text-white underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0B1120]">
      <DealRoomHeader room={room} />
      <DealRoomTabs activeTab={activeTab} onTabChange={handleTabChange} />
      <DealRoomLayout
        leftPanel={
          <SourcesPanel
            sources={sources}
            artifacts={artifacts}
            uploading={uploading}
            uploadProgress={uploadProgress}
            onUploadFile={uploadFile}
            onDeleteSource={deleteSource}
          />
        }
        centerPanel={
          <EditorPanel
            content={currentContent}
            activeTab={activeTab}
            wordCount={room.word_count || 0}
            saving={saving}
            lastSaved={lastSaved}
            onContentChange={handleContentChange}
          />
        }
        rightPanel={
          <AssistantPanel
            messages={messages}
            sending={sending}
            onSendMessage={handleSendMessage}
          />
        }
      />
    </div>
  );
};

export default DealRoomPage;
