import React, { useCallback, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type BlockType = 'h1' | 'h2' | 'p';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

export interface BlockEditorProps {
  initialBlocks?: Block[];
}

const defaultBlocks: Block[] = [
  { id: uuidv4(), type: 'h1', text: 'Executive Summary' },
  {
    id: uuidv4(),
    type: 'p',
    text: 'Block editor coming in Phase 3. Use this space to draft the executive summary…',
  },
  { id: uuidv4(), type: 'h2', text: 'Critical Path Progress' },
  { id: uuidv4(), type: 'p', text: '• North Wing structural steel at 65% completion' },
  { id: uuidv4(), type: 'p', text: '• MEP rough-in scheduled to begin next week' },
  { id: uuidv4(), type: 'p', text: '• All quality inspections passed' },
];

const BlockEditor: React.FC<BlockEditorProps> = ({ initialBlocks }) => {
  const [blocks, setBlocks] = useState<Block[]>(() => initialBlocks || defaultBlocks);
  const [activeId, setActiveId] = useState<string | null>(blocks[0]?.id || null);
  const activeIndex = useMemo(() => blocks.findIndex(b => b.id === activeId), [blocks, activeId]);

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const addBlockBelow = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const next: Block = { id: uuidv4(), type: 'p', text: '' };
      const copy = prev.slice();
      copy.splice(idx + 1, 0, next);
      return copy;
    });
  }, []);

  const removeEmptyBlock = useCallback((id: string) => {
    setBlocks(prev => (prev.length > 1 ? prev.filter(b => b.id !== id) : prev));
  }, []);

  const toolbarAction = (action: 'bold' | 'italic' | 'strike' | 'h1' | 'h2' | 'p') => {
    if (activeId == null) return;
    if (action === 'h1' || action === 'h2' || action === 'p') {
      updateBlock(activeId, { type: action });
    } else if (action === 'bold') {
      const b = blocks.find(b => b.id === activeId);
      updateBlock(activeId, { bold: !b?.bold });
    } else if (action === 'italic') {
      const b = blocks.find(b => b.id === activeId);
      updateBlock(activeId, { italic: !b?.italic });
    } else if (action === 'strike') {
      const b = blocks.find(b => b.id === activeId);
      updateBlock(activeId, { strike: !b?.strike });
    }
  };

  return (
    <div>
      {/* Inline toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => toolbarAction('bold')} className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 font-semibold">B</button>
        <button onClick={() => toolbarAction('italic')} className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 italic">I</button>
        <button onClick={() => toolbarAction('strike')} className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 line-through">S</button>
        <button onClick={() => toolbarAction('h1')} className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50">H1</button>
        <button onClick={() => toolbarAction('h2')} className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50">H2</button>
        <button onClick={() => toolbarAction('p')} className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50">P</button>
        <div className="ml-auto text-xs text-gray-500">{activeIndex >= 0 ? `Block ${activeIndex + 1} of ${blocks.length}` : ''}</div>
      </div>

      <div className="space-y-3">
        {blocks.map((b) => {
          const Tag: any = b.type === 'h1' ? 'h1' : b.type === 'h2' ? 'h2' : 'p';
          const ref = useRef<HTMLDivElement | null>(null);
          const base = 'outline-none rounded px-1';
          const style = `${b.bold ? 'font-semibold ' : ''}${b.italic ? 'italic ' : ''}${b.strike ? 'line-through ' : ''}`;
          const size = b.type === 'h1' ? 'text-3xl font-semibold' : b.type === 'h2' ? 'text-2xl font-semibold' : 'text-base';
          return (
            <Tag key={b.id} className={`${size}`}>
              <div
                ref={ref}
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                className={`${base} ${style}`}
                onFocus={() => setActiveId(b.id)}
                onInput={(e) => updateBlock(b.id, { text: (e.target as HTMLDivElement).innerText })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBlockBelow(b.id);
                    setTimeout(() => {
                      const idx = blocks.findIndex(x => x.id === b.id);
                      const next = document.querySelectorAll('[role="textbox"]')[idx + 1] as HTMLElement | null;
                      next?.focus();
                    }, 0);
                  } else if (e.key === 'Backspace') {
                    const text = (e.currentTarget as HTMLDivElement).innerText;
                    if (text.length === 0) {
                      e.preventDefault();
                      removeEmptyBlock(b.id);
                    }
                  }
                }}
                dangerouslySetInnerHTML={{ __html: b.text.replace(/\n/g, '<br/>') }}
              />
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

export default BlockEditor;
