import React, { useEffect, useState } from 'react';
import AudioBriefingCard from './workspace/AudioBriefingCard';
import VideoSummaryCard from './workspace/VideoSummaryCard';
import SourceMaterialsList, { MaterialItem } from './workspace/SourceMaterialsList';
import BlockEditor from './workspace/editor/BlockEditor';

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

  const [materials, setMaterials] = useState<MaterialItem[]>([
    { id: 'm1', label: 'Daily Logs - Oct 9', meta: 'PDF' },
    { id: 'm2', label: 'RFI-H-042 Details', meta: 'RFI' },
    { id: 'm3', label: 'Site Photos (14)', meta: 'Images' },
    { id: 'm4', label: 'Centennial Tower Schedule Data', meta: 'XLSX' },
  ]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50">
      {/* Workspace Container */}
      <div className="h-full w-full bg-white flex flex-col shadow-2xl">
        {/* Header Bar */}
        <header className="bg-[#1e3a8a] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div aria-label="Plexify logo" className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center font-bold">P</div>
            <h1 className="text-xl font-semibold">PlexifyBID Report Editor Workspace</h1>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Help" className="p-2 hover:bg-white/10 rounded">?</button>
            <button aria-label="Field report" className="px-3 py-2 bg-white/10 rounded hover:bg-white/20">Field report</button>
            <button aria-label="Save" className="px-3 py-2 bg-[#3b82f6] rounded hover:brightness-110">?? Save</button>
            <button aria-label="Close workspace" onClick={onClose} className="p-2 hover:bg-white/10 rounded">?</button>
          </div>
        </header>

        {/* 3-Column Grid */}
        <div className="flex-1 overflow-hidden grid" style={{ gridTemplateColumns: '25% 50% 25%' }}>
          {/* LEFT PANEL - Inputs & Media Sources */}
          <aside className="bg-[#f9fafb] border-r border-[#e5e7eb] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Inputs & Media Sources</h2>
            <div className="space-y-5">
              <AudioBriefingCard
                audioUrl="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                duration={360}
                chapters={[
                  { label: 'Introduction', timestamp: 0 },
                  { label: 'Executive Summary', timestamp: 60 },
                  { label: 'Video Feed', timestamp: 180 },
                ]}
              />

              <VideoSummaryCard
                thumbnailUrl="https://images.unsplash.com/photo-1520975922284-5f22b7bbd2ae?q=80&w=900&auto=format&fit=crop"
                videoUrl="#"
                title="Visual Site Summary"
              />

              <SourceMaterialsList items={materials} onReorder={setMaterials} />
            </div>
          </aside>

          {/* CENTER PANEL - Block Editor Canvas */}
          <main className="bg-white overflow-y-auto p-8">
            <h1 className="text-[32px] font-semibold text-gray-900 mb-6">Project {projectId}: Executive Project Report</h1>
            <BlockEditor projectId={projectId} />
            <div className="mt-6 text-xs text-gray-500 text-right">Auto-save: Ready</div>
          </main>

          {/* RIGHT PANEL - AI Research Assistant */}
          <aside className="bg-[#f9fafb] border-l border-[#e5e7eb] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Plexify AI Assistant</h2>
            <div className="space-y-3">
              <div className="bg-white border border-[#e5e7eb] rounded-xl p-3 text-sm text-gray-800">
                I�ve drafted the executive summary based on today�s field reports and the new video feed. Would you like me to expand on the steel erection delays?
              </div>
              <div className="bg-[#3b82f6] text-white rounded-xl p-3 text-sm self-end ml-10">
                Yes, adjust the tone to be more urgent for external stakeholders.
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <input aria-label="Ask AI" className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded" placeholder="Ask AI to research, refine, or add data..." />
                <button aria-label="Attach" className="px-2 py-2 border border-[#e5e7eb] rounded">??</button>
                <button aria-label="Attach image" className="px-2 py-2 border border-[#e5e7eb] rounded">??</button>
                <button aria-label="Send" className="px-3 py-2 bg-[#3b82f6] text-white rounded">?</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ReportEditorWorkspace;