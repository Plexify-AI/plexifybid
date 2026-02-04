import React from 'react';
import { FileText } from 'lucide-react';

export function TemplateListPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <FileText size={32} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Prompt Templates</h3>
      <p className="text-sm text-gray-600 text-center max-w-md">
        Template management coming soon. You'll be able to create, edit, and version
        prompt templates with variable injection.
      </p>
    </div>
  );
}

export default TemplateListPlaceholder;
