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
  readOnly?: boolean;
}

export default function BlockEditor({
  theme,
  content = '',
  blocks,
  placeholder = 'Start writing your report...',
  onChange,
  renderStructuredOutputBlock,
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
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
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
