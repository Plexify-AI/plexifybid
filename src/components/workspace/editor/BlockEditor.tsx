import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  projectId: string;
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

const BlockEditor: React.FC<BlockEditorProps> = ({ initialBlocks, projectId }) => {
  const storageKey = `workspace:project:${projectId}:blocks`;
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as Block[];
    } catch {}
    return initialBlocks || defaultBlocks;
  });
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

  // Persist to localStorage whenever blocks change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(blocks));
    } catch {}
  }, [blocks, storageKey]);

  // Drag and drop reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);
    setBlocks(prev => arrayMove(prev, oldIndex, newIndex));
  };

  const deleteBlock = (id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      const next = prev.filter(b => b.id !== id);
      const newActive = next[Math.max(0, idx - 1)]?.id ?? next[0]?.id ?? null;
      setActiveId(newActive);
      return next.length ? next : [{ id: uuidv4(), type: 'p', text: '' }];
    });
  };

  function SortableBlock({ block }: { block: Block }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
    const Tag: any = block.type === 'h1' ? 'h1' : block.type === 'h2' ? 'h2' : 'p';
    const base = 'outline-none rounded px-1 flex items-start gap-2 group';
    const styleText = `${block.bold ? 'font-semibold ' : ''}${block.italic ? 'italic ' : ''}${block.strike ? 'line-through ' : ''}`;
    const size = block.type === 'h1' ? 'text-3xl font-semibold' : block.type === 'h2' ? 'text-2xl font-semibold' : 'text-base';
    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      background: isDragging ? '#f9fafb' : undefined,
    };
    return (
      <Tag ref={setNodeRef} style={style} className={`${size}`}>
        <div className={base}>
          <button
            className="opacity-60 hover:opacity-100 cursor-grab select-none mt-1"
            title="Drag"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <div
            role="textbox"
            contentEditable
            suppressContentEditableWarning
            className={`${styleText} flex-1`}
            onFocus={() => setActiveId(block.id)}
            onInput={(e) => updateBlock(block.id, { text: (e.target as HTMLDivElement).innerText })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addBlockBelow(block.id);
                setTimeout(() => {
                  const idx = blocks.findIndex(x => x.id === block.id);
                  const next = document.querySelectorAll('[role="textbox"]')[idx + 1] as HTMLElement | null;
                  next?.focus();
                }, 0);
              } else if (e.key === 'Backspace') {
                const text = (e.currentTarget as HTMLDivElement).innerText;
                if (text.length === 0) {
                  e.preventDefault();
                  removeEmptyBlock(block.id);
                }
              }
            }}
            dangerouslySetInnerHTML={{ __html: block.text.replace(/\n/g, '<br/>') }}
          />
          <button
            className="opacity-0 group-hover:opacity-100 text-red-600 px-2"
            title="Delete block"
            onClick={() => deleteBlock(block.id)}
          >
            🗑
          </button>
        </div>
      </Tag>
    );
  }

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

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocks.map((b) => (
              <SortableBlock key={b.id} block={b} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default BlockEditor;
