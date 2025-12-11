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
              {/* Audio Briefing */}
              <div className="rounded-xl p-4 text-white shadow-md" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                <div className="text-sm font-medium mb-2">Audio Briefing</div>
                <div className="flex items-center gap-2 mb-2">
                  <button className="px-3 py-1.5 bg-white/20 rounded">?</button>
                  <div className="flex-1 h-2 bg-white/20 rounded">
                    <div className="h-2 w-1/3 bg-white rounded" />
                  </div>
                  <select className="bg-white/10 rounded px-2 py-1 text-xs">
                    <option>1x</option>
                    <option>1.25x</option>
                    <option>1.5x</option>
                    <option>2x</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Introduction','Executive Summary','Video Feed'].map(c => (
                    <span key={c} className="px-2 py-1 bg-white/15 rounded-full">{c}</span>
                  ))}
                </div>
                <div className="mt-2 text-xs opacity-90">Status: Ready — ?? Introduction</div>
              </div>

              {/* Video Summary */}
              <div className="bg-white rounded-xl border border-[#e5e7eb] p-3">
                <div className="relative aspect-video bg-gray-200 rounded">
                  <button className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 text-white">?</button>
                </div>
                <div className="mt-2 text-sm text-gray-600">Visual Site Summary</div>
              </div>

              {/* Source Materials */}
              <div>
                <div className="text-sm font-medium text-gray-800 mb-2">Source Materials</div>
                <ul className="bg-white rounded-xl border border-[#e5e7eb] divide-y divide-[#e5e7eb]">
                  {[
                    'Daily Logs - Oct 9',
                    'RFI-H-042 Details',
                    'Site Photos (14)',
                    'Centennial Tower Schedule Data',
                  ].map(item => (
                    <li key={item} className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50">
                      <span className="text-gray-400 select-none">??</span>
                      <span className="text-sm text-gray-800">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 text-xs text-gray-500">Draggable materials</div>
              </div>
            </div>
          </aside>

          {/* CENTER PANEL - Block Editor Canvas */}
          <main className="bg-white overflow-y-auto p-8">
            <h1 className="text-[32px] font-semibold text-gray-900 mb-6">Project {projectId}: Executive Project Report</h1>
            <div className="sticky top-0 bg-white pt-1 pb-3 -mt-1 z-10">
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50">B</button>
                <button className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 italic">I</button>
                <button className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50 line-through">S</button>
                <button className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50">H1</button>
                <button className="px-2 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50">H2</button>
                <button className="ml-auto px-3 py-1.5 rounded bg-[#3b82f6] text-white">? Regenerate with AI</button>
              </div>
            </div>
            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Executive Summary</h2>
                <p className="text-gray-800">Block editor coming in Phase 3. Use this space to draft the executive summary…</p>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Critical Path Progress</h2>
                <ul className="list-disc pl-6 text-gray-800">
                  <li>North Wing structural steel at 65% completion</li>
                  <li>MEP rough-in scheduled to begin next week</li>
                  <li>All quality inspections passed</li>
                </ul>
              </div>
            </section>
            <div className="mt-6 text-xs text-gray-500 text-right">Auto-save: Ready</div>
          </main>

          {/* RIGHT PANEL - AI Research Assistant */}
          <aside className="bg-[#f9fafb] border-l border-[#e5e7eb] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Plexify AI Assistant</h2>
            <div className="space-y-3">
              <div className="bg-white border border-[#e5e7eb] rounded-xl p-3 text-sm text-gray-800">
                I’ve drafted the executive summary based on today’s field reports and the new video feed. Would you like me to expand on the steel erection delays?
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