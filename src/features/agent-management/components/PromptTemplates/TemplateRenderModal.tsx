import React, { useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import type { PromptTemplate, TemplateVariable } from '../../AgentManagement.types';
import { CopyToClipboard } from '../shared';
import { TemplatePreview } from './TemplatePreview';

export interface TemplateRenderModalProps {
  /** The template to render */
  template: PromptTemplate;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Optional callback when copy is triggered (to increment usage_count) */
  onCopy?: () => void;
}

/**
 * Modal for rendering a template with variable inputs.
 * Shows form fields for each variable and a live preview.
 */
export function TemplateRenderModal({
  template,
  isOpen,
  onClose,
  onCopy,
}: TemplateRenderModalProps) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() =>
    buildInitialValues(template.variables)
  );

  const handleValueChange = useCallback(
    (name: string, value: string | number | boolean) => {
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleCopy = useCallback(() => {
    onCopy?.();
  }, [onCopy]);

  // Reset values when template changes
  useMemo(() => {
    setValues(buildInitialValues(template.variables));
  }, [template.id]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
            <p className="text-sm text-gray-500">Fill in variables to render the template</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Variables form */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-800 mb-3">Variables</h3>
              {template.variables.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  This template has no variables.
                </p>
              ) : (
                template.variables.map((variable) => (
                  <VariableField
                    key={variable.name}
                    variable={variable}
                    value={values[variable.name]}
                    onChange={(val) => handleValueChange(variable.name, val)}
                  />
                ))
              )}
            </div>

            {/* Preview pane */}
            <div className="min-h-[300px]">
              <TemplatePreview
                templateBody={template.template_body}
                variables={template.variables}
                values={values}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md
                       hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <CopyToClipboard
            text={renderTemplateForCopy(template.template_body, template.variables, values)}
            label="Copy to Clipboard"
            size="md"
            className="!bg-primary-600 !text-white !border-primary-600 hover:!bg-primary-700"
          />
        </div>
      </div>
    </div>
  );
}

// Build initial values from variable defaults
function buildInitialValues(
  variables: TemplateVariable[]
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const v of variables) {
    if (v.type === 'boolean') {
      values[v.name] = v.default_value === 'true';
    } else if (v.type === 'number') {
      values[v.name] = v.default_value ? Number(v.default_value) : 0;
    } else {
      values[v.name] = v.default_value || '';
    }
  }
  return values;
}

// Render template for copy (simple inline version)
function renderTemplateForCopy(
  templateBody: string,
  variables: TemplateVariable[],
  values: Record<string, string | number | boolean>
): string {
  let result = templateBody;
  for (const v of variables) {
    const val = values[v.name] ?? v.default_value ?? '';
    const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
    result = result.replace(regex, String(val));
  }
  return result;
}

// Individual variable field component
interface VariableFieldProps {
  variable: TemplateVariable;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}

function VariableField({ variable, value, onChange }: VariableFieldProps) {
  const inputId = `var-${variable.name}`;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
        {variable.name}
        {variable.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {variable.description && (
        <p className="text-xs text-gray-500 mb-1">{variable.description}</p>
      )}

      {variable.type === 'text' ? (
        <textarea
          id={inputId}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md
                     text-gray-900 placeholder-gray-400 resize-y
                     focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
        />
      ) : variable.type === 'boolean' ? (
        <div className="flex items-center h-9">
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-200"
          />
          <span className="ml-2 text-sm text-gray-700">
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      ) : variable.type === 'number' ? (
        <input
          id={inputId}
          type="number"
          value={value !== undefined ? Number(value) : ''}
          onChange={(e) => onChange(e.target.valueAsNumber || 0)}
          className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded-md
                     text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
        />
      ) : variable.type === 'date' ? (
        <input
          id={inputId}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded-md
                     text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded-md
                     text-gray-900 placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
        />
      )}
    </div>
  );
}

export default TemplateRenderModal;
