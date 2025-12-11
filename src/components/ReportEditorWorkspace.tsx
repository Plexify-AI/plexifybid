import React, { useEffect } from 'react';

interface ReportEditorWorkspaceProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ReportEditorWorkspace: React.FC<ReportEditorWorkspaceProps> = ({ projectId, isOpen, onClose }) => {
  if (!isOpen) return null;

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Report Editor Workspace</h2>
        <p className="mb-4">Project ID: {projectId}</p>
        <p className="text-gray-600 mb-6">
          Placeholder for Phase 1 shell. This verifies project-specific opening.
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportEditorWorkspace;