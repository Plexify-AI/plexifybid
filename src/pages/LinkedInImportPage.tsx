/**
 * LinkedIn Network Import Page
 *
 * Phase A: Upload + Validation
 * Phase B: Processing pipeline with progress polling
 * Phase C: Results + review queue (future)
 */

import { ArrowLeft, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSandbox } from '../contexts/SandboxContext';
import { useLinkedInImport } from './linkedin-import/useLinkedInImport';
import { UploadSection } from './linkedin-import/UploadSection';
import { ColumnMappingSection } from './linkedin-import/ColumnMappingSection';
import { ProcessingSection } from './linkedin-import/ProcessingSection';
import { ResultsSection } from './linkedin-import/ResultsSection';

export default function LinkedInImportPage() {
  const navigate = useNavigate();
  const { token } = useSandbox();
  const {
    state,
    uploadProgress,
    manifest,
    error,
    jobStatus,
    startUpload,
    startPipeline,
    cancelImport,
    reset,
  } = useLinkedInImport(token || '');

  const isUploadDone = state === 'mapping' || state === 'processing' || state === 'complete';
  const isPipelineStarted = state === 'processing' || state === 'complete';
  const isProcessingActive = state === 'processing';
  const isComplete = state === 'complete';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      {/* Back nav */}
      <div className="max-w-3xl mx-auto mb-6">
        <button
          onClick={() => navigate('/agents')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </button>
      </div>

      {/* Main card */}
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-gray-700/40 bg-gray-900/60 backdrop-blur-xl p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple-500/15 border border-purple-500/25">
              <Network className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">LinkedIn Network Import</h1>
              <p className="text-sm text-gray-400">Import and score your professional network</p>
            </div>
          </div>

          {/* Accordion Sections */}
          <div className="space-y-4">
            {/* Section 1: Upload */}
            <div>
              <SectionHeader number={1} title="Upload Export" active={!isUploadDone} complete={isUploadDone} />
              <div className="mt-3">
                <UploadSection
                  state={state}
                  uploadProgress={uploadProgress}
                  manifest={manifest}
                  error={error}
                  onFileSelected={startUpload}
                  onReset={reset}
                />
              </div>
            </div>

            {/* Section 2: Column Mapping */}
            <div>
              <SectionHeader
                number={2}
                title="Column Mapping"
                active={state === 'mapping'}
                complete={isPipelineStarted && manifest?.auto_mapped === true}
              />
              <div className="mt-3">
                <ColumnMappingSection
                  autoMapped={manifest?.auto_mapped ?? null}
                  isActive={isUploadDone}
                  isPipelineStarted={isPipelineStarted}
                  onStartPipeline={startPipeline}
                />
              </div>
            </div>

            {/* Section 3: Processing */}
            <div>
              <SectionHeader
                number={3}
                title="Processing"
                active={isProcessingActive}
                complete={isComplete}
              />
              <div className="mt-3">
                <ProcessingSection
                  isActive={isPipelineStarted}
                  jobStatus={jobStatus}
                  onCancel={cancelImport}
                />
              </div>
            </div>

            {/* Section 4: Results */}
            <div>
              <SectionHeader number={4} title="Results" active={isComplete} complete={false} />
              <div className="mt-3">
                <ResultsSection
                  isComplete={isComplete}
                  jobStatus={jobStatus}
                  onReset={reset}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ number, title, active, complete }: {
  number: number;
  title: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`
        flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold
        ${complete ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
          active ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
          'bg-gray-800/40 text-gray-600 border border-gray-700/30'}
      `}>
        {number}
      </div>
      <span className={`text-sm font-medium ${
        complete ? 'text-emerald-400' :
        active ? 'text-gray-200' :
        'text-gray-600'
      }`}>
        {title}
      </span>
    </div>
  );
}
