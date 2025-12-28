import type { ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { PlexifyTheme } from '../../types/theme';
import { EditorBlock } from '../../types/workspace';
import EditorToolbar from './EditorToolbar';

interface BlockEditorProps {
  theme: PlexifyTheme;
  content?: string;
  blocks?: EditorBlock[];
  placeholder?: string;
  onChange?: (content: string) => void;
  onBlocksChange?: (blocks: EditorBlock[]) => void;
  renderStructuredOutputBlock?: (block: EditorBlock) => ReactNode;
  onStructuredOutputExport?: (block: EditorBlock, format: 'docx' | 'pdf') => void;
  onStructuredOutputRegenerate?: (block: EditorBlock) => void;
  onStructuredOutputDelete?: (block: EditorBlock) => void;
  structuredOutputBusy?: boolean;
  readOnly?: boolean;
}

export default function BlockEditor({
  theme,
  content = '',
  blocks,
  placeholder = 'Start writing your report...',
  onChange,
  renderStructuredOutputBlock,
  onStructuredOutputExport,
  onStructuredOutputRegenerate,
  onStructuredOutputDelete,
  structuredOutputBusy = false,
  readOnly = false,
}: BlockEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      {blocks && blocks.length > 0 ? (
        <div className="p-4 border-b border-gray-200 space-y-4">
          {blocks.map((block) => {
            if (block.type === 'structured-output') {
              return (
                <div
                  key={block.id}
                  className="group relative rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 p-1 z-10">
                    <button
                      type="button"
                      onClick={() => onStructuredOutputExport?.(block, 'docx')}
                      disabled={structuredOutputBusy}
                      className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      DOCX
                    </button>
                    <button
                      type="button"
                      onClick={() => onStructuredOutputExport?.(block, 'pdf')}
                      disabled={structuredOutputBusy}
                      className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      PDF
                    </button>
                    <div className="w-px h-6 bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => onStructuredOutputRegenerate?.(block)}
                      disabled={structuredOutputBusy}
                      className="px-3 py-1.5 rounded text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() => onStructuredOutputDelete?.(block)}
                      disabled={structuredOutputBusy}
                      className="px-2 py-1.5 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Delete"
                    >
                      Delete
                    </button>
                  </div>

                  {renderStructuredOutputBlock ? (
                    renderStructuredOutputBlock(block)
                  ) : (
                    <div className="text-sm text-slate-500">
                      Structured output is not supported in this view.
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      ) : null}

      {!readOnly && editor && (
        <EditorToolbar editor={editor} theme={theme} />
      )}
      <div
        className="relative"
        style={{
          ['--tw-prose-links' as string]: theme.primaryColor,
          ['--tw-prose-headings' as string]: theme.textPrimary || '#111827',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
