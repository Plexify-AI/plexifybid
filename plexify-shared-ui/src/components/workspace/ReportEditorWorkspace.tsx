import { useState, useEffect, type ReactNode } from 'react';
import {
  PlexifyTheme,
  TerminologySet,
  terminologyConfigs,
  SourceMaterial,
  Message,
  AudioChapter,
  WorkspaceConfig,
  EditorBlock,
} from '../../types';
import AIMediaSummary from './AIMediaSummary';
import SourceMaterialsList from './SourceMaterialsList';
import BlockEditor from './BlockEditor';
import RegenerateWithAIButton from './RegenerateWithAIButton';
import AIAssistantPanel from './AIAssistantPanel';

interface ReportEditorWorkspaceProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  theme: PlexifyTheme;
  terminology?: TerminologySet;
  config?: WorkspaceConfig;
  // Data props
  initialContent?: string;
  sourceMaterials?: SourceMaterial[];
  audioUrl?: string;
  audioDuration?: string;
  audioChapters?: AudioChapter[];
  videoUrl?: string;
  videoThumbnail?: string;
  videoDuration?: string;
  // Callbacks
  onSave?: (content: string) => Promise<void>;
  onRegenerate?: (instructions?: string) => Promise<string>;
  onAIMessage?: (message: string) => Promise<Message>;
  onRunAgent?: (
    agentId: string,
    args: { projectId: string; sourceIds: string[] }
  ) => Promise<unknown>;
  onSourceMaterialsChange?: (materials: SourceMaterial[]) => void;
  onExportPDF?: () => Promise<void>;
  onExportPPTX?: () => Promise<void>;
  renderStructuredOutputBlock?: (block: EditorBlock) => ReactNode;
}

export default function ReportEditorWorkspace({
  projectId,
  isOpen,
  onClose,
  theme,
  terminology = 'bid',
  config = {},
  initialContent = '',
  sourceMaterials = [],
  audioUrl,
  audioDuration,
  audioChapters = [],
  videoUrl,
  videoThumbnail,
  videoDuration,
  onSave,
  onRegenerate,
  onAIMessage,
  onRunAgent,
  onSourceMaterialsChange,
  onExportPDF,
  onExportPPTX,
  renderStructuredOutputBlock,
}: ReportEditorWorkspaceProps) {
  const terminologyConfig = terminologyConfigs[terminology];

  // These props are reserved for future integration with real media sources.
  void audioUrl;
  void audioDuration;
  void audioChapters;
  void videoUrl;
  void videoThumbnail;
  void videoDuration;

  const [content, setContent] = useState(initialContent);
  const [materials, setMaterials] = useState<SourceMaterial[]>(sourceMaterials);
  const [messages, setMessages] = useState<Message[]>([]);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    showAudioBriefing = true,
    showVideoSummary = true,
    showSourceMaterials = true,
    showAIAssistant = true,
    allowExport = true,
    exportFormats = ['pdf', 'pptx'],
  } = config;

  const showAIMediaSummary = showAudioBriefing || showVideoSummary;

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Update materials when sourceMaterials changes
  useEffect(() => {
    setMaterials(sourceMaterials);
  }, [sourceMaterials]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleToggleMaterialContext = (materialId: string, selected: boolean) => {
    setMaterials((prev) => {
      const next = prev.map((m) =>
        m.id === materialId ? { ...m, isSelectedForContext: selected } : m
      );
      onSourceMaterialsChange?.(next);
      return next;
    });
  };

  const handleReorderMaterials = (nextMaterials: SourceMaterial[]) => {
    setMaterials(nextMaterials);
    onSourceMaterialsChange?.(nextMaterials);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave?.(content);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async (instructions?: string) => {
    if (!onRegenerate) return;
    try {
      const newContent = await onRegenerate(instructions);
      setContent(newContent);
    } catch (error) {
      console.error('Regeneration failed:', error);
    }
  };

  const handleSendMessage = async (messageContent: string) => {
    if (!onAIMessage) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Get AI response
    setIsAILoading(true);
    try {
      const aiResponse = await onAIMessage(messageContent);
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error('AI message failed:', error);
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleRunAgent = async (agentId: string) => {
    if (!onRunAgent || isGenerating) return;
    setIsGenerating(true);
    try {
      const sourceIds = materials
        .filter((m) => m.isSelectedForContext)
        .map((m) => m.id);

      const output = await onRunAgent(agentId, { projectId, sourceIds });

      const block: EditorBlock = {
        id: `structured-${agentId}-${Date.now()}`,
        type: 'structured-output',
        content: '',
        data: output,
      };

      setBlocks((prev) => [block, ...prev]);
    } catch (error) {
      console.error('Agent generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-50 w-full h-full flex flex-col">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4 text-white"
          style={{
            background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold">
                {terminologyConfig.reportTitle}
              </h1>
              <p className="text-sm opacity-80">Project: {projectId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {allowExport && (
              <div className="flex items-center gap-2">
                {exportFormats.includes('pdf') && onExportPDF && (
                  <button
                    onClick={onExportPDF}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export PDF
                  </button>
                )}
                {exportFormats.includes('pptx') && onExportPPTX && (
                  <button
                    onClick={onExportPPTX}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    Export PPTX
                  </button>
                )}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
        </header>

        {/* Three Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Sources */}
          <aside className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">
                Inputs &amp; Media Sources
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {showAIMediaSummary ? <AIMediaSummary /> : null}

              {showSourceMaterials && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">
                    {terminologyConfig.sourceMaterialsLabel}
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">
                    Draggable materials
                  </p>
                  <SourceMaterialsList
                    theme={theme}
                    materials={materials}
                    showHeader={false}
                    onReorder={handleReorderMaterials}
                    onToggleContext={handleToggleMaterialContext}
                  />
                </div>
              )}
            </div>
          </aside>

          {/* Center Panel - Editor */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {terminologyConfig.reportTitle}
                </h2>
                {onRegenerate && (
                  <RegenerateWithAIButton
                    theme={theme}
                    label={terminologyConfig.regenerateButton}
                    onRegenerate={handleRegenerate}
                  />
                )}
              </div>

              <BlockEditor
                theme={theme}
                blocks={blocks}
                renderStructuredOutputBlock={renderStructuredOutputBlock}
                content={content}
                onChange={handleContentChange}
                placeholder={`Start writing your ${terminologyConfig.reportTitle.toLowerCase()}...`}
              />
            </div>
          </main>

          {/* Right Panel - AI Assistant */}
          {showAIAssistant && (
            <aside className="w-96 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-800">
                  AI Research Assistant
                </h2>
              </div>

              <div className="flex-1 flex flex-col m-3 rounded-xl border border-slate-200 overflow-hidden bg-white">
                <AIAssistantPanel
                  embedded={true}
                  theme={theme}
                  title="Plexify AI Assistant"
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onRunAgent={handleRunAgent}
                  isLoading={isAILoading || isGenerating}
                />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
