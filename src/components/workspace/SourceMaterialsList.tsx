import React, { useMemo } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type MaterialItem = {
  id: string;
  label: string;
  meta?: string;
};

export interface SourceMaterialsListProps {
  items: MaterialItem[];
  onReorder?: (items: MaterialItem[]) => void;
}

function Row({ id, label, meta }: MaterialItem) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? '#f3f4f6' : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className="px-3 py-2 flex items-center gap-2">
      <span className="text-gray-400 select-none cursor-grab" {...attributes} {...listeners} aria-label="Drag handle">
        ⋮⋮
      </span>
      <span className="text-sm text-gray-800 flex-1 truncate">{label}</span>
      {meta ? <span className="text-xs text-gray-400">{meta}</span> : null}
    </li>
  );
}

const SourceMaterialsList: React.FC<SourceMaterialsListProps> = ({ items, onReorder }) => {
  const ids = useMemo(() => items.map((i) => i.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    const next = arrayMove(items, oldIndex, newIndex);
    onReorder?.(next);
  };

  return (
    <div>
      <div className="text-sm font-medium text-gray-800 mb-2">Source Materials</div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="bg-white rounded-xl border border-[#e5e7eb] divide-y divide-[#e5e7eb]">
            {items.map((it) => (
              <Row key={it.id} {...it} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="mt-1 text-xs text-gray-500">Drag to reorder</div>
    </div>
  );
};

export default SourceMaterialsList;
