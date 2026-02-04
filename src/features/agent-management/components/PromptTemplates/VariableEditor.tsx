import React, { useCallback } from 'react';
import type { TemplateVariable, TemplateVariableType } from '../../AgentManagement.types';
import { JsonArrayEditor } from '../shared';

export interface VariableEditorProps {
  /** Array of template variables */
  variables: TemplateVariable[];
  /** Callback when variables change */
  onChange: (variables: TemplateVariable[]) => void;
}

const VARIABLE_TYPES: Array<{ value: TemplateVariableType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'text', label: 'Text (multiline)' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'json', label: 'JSON' },
];

const createEmptyVariable = (): TemplateVariable => ({
  name: '',
  type: 'string',
  default_value: '',
  required: false,
  description: '',
});

/**
 * Editor for template variables using JsonArrayEditor.
 * Each row: name, type, default_value, required toggle, description.
 */
export function VariableEditor({ variables, onChange }: VariableEditorProps) {
  const renderVariable = useCallback(
    (
      variable: TemplateVariable,
      index: number,
      handlers: { update: (v: TemplateVariable) => void }
    ) => (
      <div className="grid grid-cols-12 gap-2 items-start">
        {/* Name */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={variable.name}
            onChange={(e) => handlers.update({ ...variable, name: e.target.value })}
            placeholder="variable_name"
            className="w-full h-8 px-2 text-sm bg-white border border-gray-300 rounded
                       text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
        </div>

        {/* Type */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={variable.type}
            onChange={(e) =>
              handlers.update({ ...variable, type: e.target.value as TemplateVariableType })
            }
            className="w-full h-8 px-2 text-sm bg-white border border-gray-300 rounded
                       text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          >
            {VARIABLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default Value */}
        <div className="col-span-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Default</label>
          <input
            type="text"
            value={variable.default_value}
            onChange={(e) => handlers.update({ ...variable, default_value: e.target.value })}
            placeholder="default value"
            className="w-full h-8 px-2 text-sm bg-white border border-gray-300 rounded
                       text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
        </div>

        {/* Required */}
        <div className="col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Req.</label>
          <div className="h-8 flex items-center">
            <input
              type="checkbox"
              checked={variable.required}
              onChange={(e) => handlers.update({ ...variable, required: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600
                         focus:ring-primary-200 cursor-pointer"
            />
          </div>
        </div>

        {/* Description */}
        <div className="col-span-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input
            type="text"
            value={variable.description}
            onChange={(e) => handlers.update({ ...variable, description: e.target.value })}
            placeholder="Describe this variable..."
            className="w-full h-8 px-2 text-sm bg-white border border-gray-300 rounded
                       text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
        </div>
      </div>
    ),
    []
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-800">Template Variables</h4>
        <span className="text-xs text-gray-500">
          Use <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> in template body
        </span>
      </div>
      <JsonArrayEditor
        value={variables}
        onChange={onChange}
        renderItem={renderVariable}
        createItem={createEmptyVariable}
        addLabel="Add Variable"
        emptyMessage="No variables defined. Add variables to make your template dynamic."
        showReorder={true}
      />
    </div>
  );
}

export default VariableEditor;
