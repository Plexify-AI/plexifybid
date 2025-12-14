import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlexifyTheme } from '../../types/theme';
import { SourceMaterial } from '../../types/workspace';

interface SourceMaterialsListProps {
  theme: PlexifyTheme;
  materials: SourceMaterial[];
  title?: string;
  onReorder?: (materials: SourceMaterial[]) => void;
  onMaterialClick?: (material: SourceMaterial) => void;
  onDragToEditor?: (material: SourceMaterial) => void;
}

function SortableItem({
  material,
  theme,
  onClick,
}: {
  material: SourceMaterial;
  theme: PlexifyTheme;
  onClick?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: material.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTypeIcon = (type: SourceMaterial['type']) => {
    switch (type) {
      case 'log':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        );
      case 'rfi':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        );
      case 'photo':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        );
      case 'schedule':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        );
      case 'document':
      default:
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 cursor-grab active:cursor-grabbing transition-colors"
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${theme.primaryColor}20` }}
      >
        <svg
          className="w-4 h-4"
          style={{ color: theme.primaryColor }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {getTypeIcon(material.type)}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {material.label}
        </p>
        {material.date && (
          <p className="text-xs text-gray-500">{material.date}</p>
        )}
      </div>
      {material.count !== undefined && (
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${theme.primaryColor}20`,
            color: theme.primaryColor,
          }}
        >
          {material.count}
        </span>
      )}
      <svg
        className="w-4 h-4 text-gray-400 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 8h16M4 16h16"
        />
      </svg>
    </div>
  );
}

export default function SourceMaterialsList({
  theme,
  materials,
  title = 'Source Materials',
  onReorder,
  onMaterialClick,
}: SourceMaterialsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = materials.findIndex((m) => m.id === active.id);
      const newIndex = materials.findIndex((m) => m.id === over.id);

      const newMaterials = [...materials];
      const [removed] = newMaterials.splice(oldIndex, 1);
      newMaterials.splice(newIndex, 0, removed);

      onReorder?.(newMaterials);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div
        className="px-4 py-3 border-b border-gray-100"
        style={{ backgroundColor: `${theme.primaryColor}10` }}
      >
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{materials.length} items</p>
      </div>

      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={materials.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            {materials.map((material) => (
              <SortableItem
                key={material.id}
                material={material}
                theme={theme}
                onClick={() => onMaterialClick?.(material)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {materials.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-4">
            No source materials available
          </p>
        )}
      </div>
    </div>
  );
}
