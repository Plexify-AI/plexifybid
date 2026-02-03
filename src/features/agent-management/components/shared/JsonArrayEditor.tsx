import React, { useCallback } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

export interface ItemHandlers<T> {
  /** Update the item at this index */
  update: (newValue: T) => void;
  /** Remove this item */
  remove: () => void;
  /** Move this item up (swap with previous) */
  moveUp: () => void;
  /** Move this item down (swap with next) */
  moveDown: () => void;
  /** Whether this is the first item */
  isFirst: boolean;
  /** Whether this is the last item */
  isLast: boolean;
}

export interface JsonArrayEditorProps<T> {
  /** The array value */
  value: T[];
  /** Callback when array changes */
  onChange: (value: T[]) => void;
  /** Render function for each item */
  renderItem: (item: T, index: number, handlers: ItemHandlers<T>) => React.ReactNode;
  /** Factory function to create a new empty item */
  createItem: () => T;
  /** Label for add button (default: "Add Item") */
  addLabel?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether to show reorder controls (default: true) */
  showReorder?: boolean;
  /** Maximum number of items allowed */
  maxItems?: number;
  /** Minimum number of items required */
  minItems?: number;
  /** Empty state message */
  emptyMessage?: string;
}

export function JsonArrayEditor<T>({
  value,
  onChange,
  renderItem,
  createItem,
  addLabel = 'Add Item',
  className = '',
  showReorder = true,
  maxItems,
  minItems = 0,
  emptyMessage = 'No items yet',
}: JsonArrayEditorProps<T>) {
  const canAdd = maxItems === undefined || value.length < maxItems;
  const canRemove = value.length > minItems;

  const handleAdd = useCallback(() => {
    if (!canAdd) return;
    onChange([...value, createItem()]);
  }, [value, onChange, createItem, canAdd]);

  const handleRemove = useCallback(
    (index: number) => {
      if (!canRemove) return;
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange, canRemove]
  );

  const handleUpdate = useCallback(
    (index: number, newItem: T) => {
      const newValue = [...value];
      newValue[index] = newItem;
      onChange(newValue);
    },
    [value, onChange]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newValue = [...value];
      [newValue[index - 1], newValue[index]] = [newValue[index], newValue[index - 1]];
      onChange(newValue);
    },
    [value, onChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === value.length - 1) return;
      const newValue = [...value];
      [newValue[index], newValue[index + 1]] = [newValue[index + 1], newValue[index]];
      onChange(newValue);
    },
    [value, onChange]
  );

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Items */}
      {value.length === 0 ? (
        <div className="text-sm text-gray-500 italic py-3 text-center border border-dashed border-gray-300 rounded-md">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((item, index) => {
            const handlers: ItemHandlers<T> = {
              update: (newValue) => handleUpdate(index, newValue),
              remove: () => handleRemove(index),
              moveUp: () => handleMoveUp(index),
              moveDown: () => handleMoveDown(index),
              isFirst: index === 0,
              isLast: index === value.length - 1,
            };

            return (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md group"
              >
                {/* Reorder controls */}
                {showReorder && value.length > 1 && (
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <GripVertical size={14} className="text-gray-300" />
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === value.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                )}

                {/* Item content */}
                <div className="flex-1 min-w-0">
                  {renderItem(item, index, handlers)}
                </div>

                {/* Remove button */}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add button */}
      {canAdd && (
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <Plus size={14} />
          <span>{addLabel}</span>
        </button>
      )}
    </div>
  );
}

export default JsonArrayEditor;
