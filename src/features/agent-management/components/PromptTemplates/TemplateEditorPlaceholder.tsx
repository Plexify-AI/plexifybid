import React from 'react';
import { ArrowLeft, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TemplateEditorPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => navigate('/agents/templates')}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span>Templates</span>
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Template Editor</span>
      </div>

      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Code size={32} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Template Editor</h3>
        <p className="text-sm text-gray-600 text-center max-w-md">
          The template editor is coming soon. You'll be able to edit prompt templates
          with syntax highlighting, variable detection, and live preview.
        </p>
      </div>
    </div>
  );
}

export default TemplateEditorPlaceholder;
