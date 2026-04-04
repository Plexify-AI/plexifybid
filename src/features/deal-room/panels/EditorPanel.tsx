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
  Sparkles, Info, Upload,
} from 'lucide-react';
import type { DealRoomTab, DealRoomArtifact } from '../../../types/dealRoom';
import { DEAL_ROOM_TAB_LABELS } from '../../../types/dealRoom';
import ArtifactRenderer from '../../../components/artifacts/ArtifactRenderer';
import { boardBriefToHtml } from '../../../components/BoardBriefRenderer';
import { ozrfSectionToHtml } from '../../../components/OZRFSectionRenderer';

/**
 * Convert artifact JSON to TipTap-compatible HTML.
 * Uses dedicated converters for board_brief and ozrf_section,
 * generic section-based converter for all other types.
 */
function artifactToHtml(artifactType: string, contentJson: any): string {
  const output = contentJson?.output ?? contentJson;
  if (!output) return '';

  try {
    if (artifactType === 'board_brief') {
      const envelope = contentJson.agentId ? contentJson : {
        agentId: 'board-brief' as const,
        schemaVersion: '1.0' as const,
        generatedAt: contentJson.generated_at || new Date().toISOString(),
        projectId: contentJson.deal_room_id || '',
        sourcesUsed: [],
        output,
      };
      return boardBriefToHtml(envelope);
    }

    if (artifactType === 'ozrf_section') {
      const envelope = contentJson.agentId ? contentJson : {
        agentId: 'ozrf-section' as const,
        schemaVersion: '1.0' as const,
        generatedAt: contentJson.generated_at || new Date().toISOString(),
        projectId: contentJson.deal_room_id || '',
        sourcesUsed: [],
        output,
      };
      return ozrfSectionToHtml(envelope);
    }

    // Generic converter for deal_summary, competitive_analysis, meeting_prep, etc.
    return genericArtifactToHtml(artifactType, output);
  } catch {
    return `<h1>${artifactType.replace(/_/g, ' ')}</h1><p>Content loaded — edit below.</p>`;
  }
}

function genericArtifactToHtml(type: string, output: any): string {
  const esc = (s: string) => s?.toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') ?? '';
  const ul = (items: string[]) =>
    items?.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';

  const parts: string[] = [];

  if (output.title) parts.push(`<h1>${esc(output.title)}</h1>`);

  // deal_summary
  if (output.executive_summary) {
    parts.push('<h2>Executive Summary</h2>', ul(output.executive_summary));
  }
  if (output.key_metrics?.length) {
    parts.push('<h2>Key Metrics</h2>',
      `<ul>${output.key_metrics.map((m: any) => `<li><strong>${esc(m.label || m.metric)}:</strong> ${esc(m.value)}</li>`).join('')}</ul>`);
  }
  if (output.key_players?.length) {
    parts.push('<h2>Key Players</h2>',
      `<ul>${output.key_players.map((p: any) => `<li><strong>${esc(p.name)}</strong> — ${esc(p.role || p.title || '')}</li>`).join('')}</ul>`);
  }
  if (output.timeline) {
    parts.push('<h2>Timeline</h2>', ul(output.timeline));
  }
  if (output.risks?.length) {
    parts.push('<h2>Risks</h2>',
      `<ul>${output.risks.map((r: any) => typeof r === 'string' ? `<li>${esc(r)}</li>` : `<li><strong>[${esc(r.severity || '')}]</strong> ${esc(r.description || r.risk || '')}</li>`).join('')}</ul>`);
  }
  if (output.next_steps) {
    parts.push('<h2>Next Steps</h2>', ul(output.next_steps));
  }

  // competitive_analysis
  if (output.competitors?.length) {
    parts.push('<h2>Competitors</h2>');
    for (const c of output.competitors) {
      parts.push(`<h3>${esc(c.name)} (${esc(c.threat_level || '')})</h3>`);
      if (c.strengths?.length) parts.push('<p><strong>Strengths:</strong></p>', ul(c.strengths));
      if (c.weaknesses?.length) parts.push('<p><strong>Weaknesses:</strong></p>', ul(c.weaknesses));
      if (c.differentiator) parts.push(`<p><strong>Differentiator:</strong> ${esc(c.differentiator)}</p>`);
    }
  }
  if (output.market_position) {
    parts.push('<h2>Market Position</h2>', `<p>${esc(output.market_position)}</p>`);
  }
  if (output.strategy_recommendations) {
    parts.push('<h2>Strategy Recommendations</h2>', ul(output.strategy_recommendations));
  }

  // meeting_prep
  if (output.meeting_context) {
    parts.push('<h2>Meeting Context</h2>', `<p>${esc(output.meeting_context)}</p>`);
  }
  if (output.agenda?.length) {
    parts.push('<h2>Agenda</h2>',
      `<ul>${output.agenda.map((a: any) => `<li><strong>${esc(a.topic)}</strong> (${a.duration_minutes} min)${a.owner ? ` — ${esc(a.owner)}` : ''}</li>`).join('')}</ul>`);
  }
  if (output.talking_points) {
    parts.push('<h2>Talking Points</h2>', ul(output.talking_points));
  }
  if (output.objection_handlers?.length) {
    parts.push('<h2>Objection Handlers</h2>',
      `<ul>${output.objection_handlers.map((o: any) => `<li><strong>${esc(o.objection)}:</strong> ${esc(o.response)}</li>`).join('')}</ul>`);
  }
  if (output.key_questions) {
    parts.push('<h2>Key Questions</h2>', ul(output.key_questions));
  }
  if (output.background_context) {
    parts.push('<h2>Background Context</h2>', `<p>${esc(output.background_context)}</p>`);
  }

  return parts.filter(Boolean).join('\n');
}

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
  /** Info message when sources are insufficient for the active tab */
  insufficientDataMessage?: string;
}

type EditorSubTab = 'editor' | 'artifacts';

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
  insufficientDataMessage,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<EditorSubTab>('editor');
  const [localWordCount, setLocalWordCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpdatingRef = useRef(false);
  const pendingContentRef = useRef<{ tab: DealRoomTab; html: string } | null>(null);
  const prevTabRef = useRef<DealRoomTab>(activeTab);
  const lastSyncedContentRef = useRef<string>(content || '');

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

      // Track what the editor has so sync effect doesn't re-set it
      lastSyncedContentRef.current = html;

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

    // Sync editor content when content prop changes from parent
    // (tab switch, Copy to Editor, etc.) but skip if editor already has it
    const incoming = content || '';
    if (editor && incoming !== lastSyncedContentRef.current) {
      lastSyncedContentRef.current = incoming;
      isUpdatingRef.current = true;
      editor.commands.setContent(incoming);
      setLocalWordCount(calcWordCount(editor.getText()));
      isUpdatingRef.current = false;
    }
  }, [content, activeTab]);

  // One-time auto-populate: load artifact HTML into TipTap when editor is empty
  const populatedArtifactsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!editor || !activeArtifact?.content) return;
    // Skip if we already populated this artifact for this tab
    const key = `${activeTab}:${activeArtifact.id || activeArtifact.artifact_type}`;
    if (populatedArtifactsRef.current.has(key)) return;
    // Only populate if editor is empty (no user edits)
    const currentText = editor.getText().trim();
    if (currentText.length > 0) return;
    const html = artifactToHtml(activeArtifact.artifact_type, activeArtifact.content);
    if (!html) return;
    populatedArtifactsRef.current.add(key);
    isUpdatingRef.current = true;
    editor.commands.setContent(html);
    setLocalWordCount(calcWordCount(editor.getText()));
    isUpdatingRef.current = false;
    // Save so it persists — use setTimeout to avoid sync re-render cascade
    setTimeout(() => onContentChange(activeTab, html), 0);
  }, [editor, activeArtifact, activeTab]);

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

  // Teal info card for insufficient source data
  const InsufficientDataCard = insufficientDataMessage ? (
    <div className="mx-4 mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08]">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Info size={16} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-emerald-300 text-sm font-medium mb-1">More sources needed</p>
          <p className="text-emerald-200/70 text-xs leading-relaxed">{insufficientDataMessage}</p>
          <div className="flex items-center gap-1.5 mt-3 text-emerald-300/60 text-xs">
            <Upload size={12} />
            <span>Drag files to the Sources panel on the left</span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

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
        {(['editor', 'artifacts'] as EditorSubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              activeSubTab === tab
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab === 'editor' ? 'Report Editor' : 'Artifacts'}
            {activeSubTab === tab && tab === 'editor' && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase">
                Active
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      {activeSubTab === 'editor' && (
        generatingSkill === activeTab ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/60 text-sm">Generating {DEAL_ROOM_TAB_LABELS[activeTab]}...</p>
            <p className="text-white/30 text-xs mt-1">This may take 15-30 seconds</p>
          </div>
        ) : editor ? (
        <>
          {/* Toolbar — always visible */}
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
            {/* Generate button — inline in toolbar when no content and no artifact */}
            {!content && !activeArtifact?.content && onGenerateSkill && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <button
                  onClick={() => onGenerateSkill(activeTab, `Generate ${DEAL_ROOM_TAB_LABELS[activeTab]}`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors text-xs"
                >
                  <Sparkles size={12} />
                  Generate
                </button>
              </>
            )}
          </div>

          {/* Insufficient data info (shown above editor when empty) */}
          {InsufficientDataCard && !content && !activeArtifact?.content && InsufficientDataCard}

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
        ) : null
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
          ) : insufficientDataMessage ? (
            <div className="flex flex-col items-center justify-center h-full">
              {InsufficientDataCard}
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
