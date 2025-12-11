import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';

export type BlockType = 'h1' | 'h2' | 'p';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  citationIds?: string[];
}

export interface BlockEditorProps {
  initialBlocks?: Block[];
  projectId: string;
}

export interface Citation {
  id: string;
  title: string;
  source: string;
  url?: string;
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
  const [citations, setCitations] = useState<Citation[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey + ':citations');
      if (raw) return JSON.parse(raw) as Citation[];
    } catch {}
    return [];
  });
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

  useEffect(() => {
    try {
      localStorage.setItem(storageKey + ':citations', JSON.stringify(citations));
    } catch {}
  }, [citations, storageKey]);

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
            <GripVertical size={16} />
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
          {block.citationIds && block.citationIds.length > 0 ? (
            <span className="ml-2 text-xs text-blue-600 select-none">
              {block.citationIds.map((cid) => {
                const idx = citations.findIndex((c) => c.id === cid);
                return (
                  <sup key={cid} className="ml-1">[{idx + 1}]</sup>
                );
              })}
            </span>
          ) : null}
          <button
            className="opacity-0 group-hover:opacity-100 text-red-600 px-2"
            title="Delete block"
            onClick={() => deleteBlock(block.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </Tag>
    );
  }

  return (
    <div>
      {/* Inline toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => toolbarAction('bold')} className="btn btn-secondary btn-sm font-semibold">B</button>
        <button onClick={() => toolbarAction('italic')} className="btn btn-secondary btn-sm italic">I</button>
        <button onClick={() => toolbarAction('strike')} className="btn btn-secondary btn-sm line-through">S</button>
        <button onClick={() => toolbarAction('h1')} className="btn btn-secondary btn-sm">H1</button>
        <button onClick={() => toolbarAction('h2')} className="btn btn-secondary btn-sm">H2</button>
        <button onClick={() => toolbarAction('p')} className="btn btn-secondary btn-sm">P</button>
        <div className="ml-auto text-xs text-gray-500">{activeIndex >= 0 ? `Block ${activeIndex + 1} of ${blocks.length}` : ''}</div>
      </div>

      {/* AI draft/regenerate hooks (mock) */}
      <div className="flex items-center gap-2 mb-3">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            // Seed an AI draft with citations
            const c1: Citation = { id: uuidv4(), title: 'Monthly Field Report – Oct', source: 'Internal Logs' };
            const c2: Citation = { id: uuidv4(), title: 'City Work Order 24-1102', source: 'City Portal', url: 'https://example.org/work-orders/24-1102' };
            setCitations((prev) => [...prev, c1, c2]);
            setBlocks((prev) => {
              const next = prev.slice();
              const firstParaIdx = next.findIndex((b) => b.type === 'p');
              if (firstParaIdx >= 0) {
                next[firstParaIdx] = {
                  ...next[firstParaIdx],
                  text: 'Operations performance improved week-over-week with reduced response times and higher completion rates.',
                  citationIds: [c1.id, c2.id],
                };
              } else {
                next.push({ id: uuidv4(), type: 'p', text: 'AI draft: Executive summary content.', citationIds: [c1.id, c2.id] });
              }
              return next;
            });
          }}
        >
          ✨ Draft with AI
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            // Simple regenerate: tweak text and add a new citation
            const c3: Citation = { id: uuidv4(), title: 'Patrol Metrics Snapshot', source: 'Operations Dashboard' };
            setCitations((prev) => [...prev, c3]);
            setBlocks((prev) => prev.map((b, i) =>
              i === 1 && b.type === 'p'
                ? { ...b, text: b.text + ' Notably, incident backlog decreased 12% this period.', citationIds: [...(b.citationIds || []), c3.id] }
                : b
            ));
          }}
        >
          ↻ Regenerate
        </button>
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

      {/* Citations UI */}
      {citations.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">References</h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            {citations.map((c, i) => (
              <li key={c.id}>
                <span className="font-medium">[{i + 1}]</span> {c.title} — {c.source}
                {c.url ? (
                  <>
                    {' '}
                    <a className="text-blue-600 underline" href={c.url} target="_blank" rel="noreferrer">
                      source
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
};

export default BlockEditor;
