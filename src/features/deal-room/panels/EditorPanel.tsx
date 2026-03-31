import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, Quote, Code, Undo, Redo,
  Sparkles,
} from 'lucide-react';
import type { DealRoomTab, DealRoomArtifact } from '../../../types/dealRoom';
import { DEAL_ROOM_TAB_LABELS } from '../../../types/dealRoom';
import ArtifactRenderer from '../../../components/artifacts/ArtifactRenderer';

interface EditorPanelProps {
  content: string;
  activeTab: DealRoomTab;
  wordCount: number;
  saving: boolean;
  lastSaved: Date | null;
  onContentChange: (tab: DealRoomTab, content: string) => void;
  /** Latest ready artifact for the active tab (if one exists) */
  activeArtifact?: DealRoomArtifact | null;
  /** Whether a skill generation is in progress */
  generatingSkill?: string | null;
  /** Trigger skill generation for the active tab */
  onGenerateSkill?: (skillKey: string, label: string) => void;
}

type EditorSubTab = 'chat' | 'editor' | 'artifacts';

const EditorPanel: React.FC<EditorPanelProps> = ({
  content,
  activeTab,
  wordCount,
  saving,
  lastSaved,
  onContentChange,
  activeArtifact,
  generatingSkill,
  onGenerateSkill,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<EditorSubTab>('editor');
  const [localWordCount, setLocalWordCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(false);
  const pendingContentRef = useRef<{ tab: DealRoomTab; html: string } | null>(null);
  const prevTabRef = useRef<DealRoomTab>(activeTab);

  // Calculate word count from plain text
  const calcWordCount = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing or paste content...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Underline,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-3',
      },
    },
    onCreate: ({ editor }) => {
      // Calculate word count on initial content load
      setLocalWordCount(calcWordCount(editor.getText()));
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
      const html = editor.getHTML();

      // Update local word count
      setLocalWordCount(calcWordCount(editor.getText()));

      // Track pending content for flush on tab switch
      pendingContentRef.current = { tab: activeTab, html };

      // Debounce auto-save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onContentChange(activeTab, html);
        pendingContentRef.current = null;
      }, 500);
    },
  });

  // Flush pending edits when tab changes, THEN sync new content
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      // Flush any pending debounced save for the previous tab
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (pendingContentRef.current) {
        onContentChange(pendingContentRef.current.tab, pendingContentRef.current.html);
        pendingContentRef.current = null;
      }
      prevTabRef.current = activeTab;
    }

    // Sync editor content to new tab
    if (editor && content !== undefined) {
      isUpdatingRef.current = true;
      editor.commands.setContent(content || '');
      setLocalWordCount(calcWordCount(editor.getText()));
      isUpdatingRef.current = false;
    }
  }, [content, activeTab]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      // Flush on unmount too
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pendingContentRef.current) {
        onContentChange(pendingContentRef.current.tab, pendingContentRef.current.html);
        pendingContentRef.current = null;
      }
    };
  }, []);

  function formatTimeSince(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }

  // Toolbar button helper
  const ToolbarBtn = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-white/10">
        {(['chat', 'editor', 'artifacts'] as EditorSubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              activeSubTab === tab
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab === 'chat' ? 'Chat' : tab === 'editor' ? 'Report Editor' : 'Artifacts'}
            {activeSubTab === tab && tab === 'editor' && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase">
                Active
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      {activeSubTab === 'editor' && editor && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-4 py-2 border-b border-white/10 flex-wrap">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
              <Bold size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
              <Italic size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
              <Strikethrough size={16} />
            </ToolbarBtn>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
              <Heading1 size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
              <Heading2 size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
              <Heading3 size={16} />
            </ToolbarBtn>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
              <AlignLeft size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
              <AlignCenter size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
              <AlignRight size={16} />
            </ToolbarBtn>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
              <Quote size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
              <Code size={16} />
            </ToolbarBtn>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
              <Undo size={16} />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
              <Redo size={16} />
            </ToolbarBtn>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto deal-room-editor">
            <EditorContent editor={editor} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-white/40">
            <span>{localWordCount} words</span>
            <span>
              {saving ? (
                <span className="text-amber-300">Saving...</span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Saved {formatTimeSince(lastSaved)}
                </span>
              ) : null}
            </span>
          </div>
        </>
      )}

      {activeSubTab === 'chat' && (
        <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
          Use the AI Assistant panel on the right →
        </div>
      )}

      {activeSubTab === 'artifacts' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeArtifact && activeArtifact.content ? (
            <ArtifactRenderer
              artifactType={activeArtifact.artifact_type}
              contentJson={activeArtifact.content}
            />
          ) : generatingSkill === activeTab ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-white/60 text-sm">Generating {DEAL_ROOM_TAB_LABELS[activeTab]}...</p>
              <p className="text-white/30 text-xs mt-1">This may take 15-30 seconds</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles size={32} className="text-white/20 mb-3" />
              <p className="text-white/50 text-sm mb-3">
                No {DEAL_ROOM_TAB_LABELS[activeTab]} generated yet
              </p>
              {onGenerateSkill && (
                <button
                  onClick={() => onGenerateSkill(activeTab, `Generate ${DEAL_ROOM_TAB_LABELS[activeTab]}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors text-sm"
                >
                  <Sparkles size={14} />
                  Generate {DEAL_ROOM_TAB_LABELS[activeTab]}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorPanel;
