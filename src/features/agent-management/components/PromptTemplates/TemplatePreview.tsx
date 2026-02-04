import React, { useMemo, useState, useEffect } from 'react';
import type { TemplateVariable } from '../../AgentManagement.types';
import { renderTemplateSimple } from '../../useTemplateRenderer';

export interface TemplatePreviewProps {
  /** The template body with {{variable}} placeholders */
  templateBody: string;
  /** Variable definitions (for defaults and types) */
  variables: TemplateVariable[];
  /** Current values for variables */
  values: Record<string, string | number | boolean>;
}

/**
 * Live preview of rendered template with dark code block styling.
 * Updates on every value change with debouncing.
 */
export function TemplatePreview({
  templateBody,
  variables,
  values,
}: TemplatePreviewProps) {
  const [debouncedValues, setDebouncedValues] = useState(values);

  // Debounce value changes (150ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValues(values);
    }, 150);
    return () => clearTimeout(timer);
  }, [values]);

  const rendered = useMemo(() => {
    if (!templateBody) return '';
    return renderTemplateSimple(templateBody, debouncedValues, variables);
  }, [templateBody, debouncedValues, variables]);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">Preview</span>
        <span className="text-xs text-gray-500">
          {rendered.length} chars
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {rendered ? (
          <pre className="text-sm font-mono text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
            {rendered}
          </pre>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Enter a template body to see the preview...
          </p>
        )}
      </div>
    </div>
  );
}

export default TemplatePreview;
