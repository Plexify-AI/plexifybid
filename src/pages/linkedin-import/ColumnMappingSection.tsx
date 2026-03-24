/**
 * LinkedIn Import — Column Mapping Section
 *
 * Shows "Column mapping confirmed" when auto_mapped is true,
 * plus "Start Import" button to kick off the pipeline.
 */

import { useState } from 'react';
import { CheckCircle, Lock, Play } from 'lucide-react';

interface ColumnMappingSectionProps {
  autoMapped: boolean | null;
  isActive: boolean;
  isPipelineStarted: boolean;
  onStartPipeline: () => void;
}

export function ColumnMappingSection({ autoMapped, isActive, isPipelineStarted, onStartPipeline }: ColumnMappingSectionProps) {
  const [isStarting, setIsStarting] = useState(false);

  if (!isActive) {
    return (
      <div className="rounded-xl border border-gray-700/20 bg-gray-800/20 p-6 opacity-50">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-500">Column mapping — upload a file first</span>
        </div>
      </div>
    );
  }

  if (autoMapped) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <span className="text-sm text-emerald-300">Column mapping confirmed — all required fields auto-detected</span>
        </div>

        {!isPipelineStarted && (
          <button
            onClick={async () => {
              setIsStarting(true);
              try {
                await onStartPipeline();
              } finally {
                setIsStarting(false);
              }
            }}
            disabled={isStarting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              bg-purple-600/20 text-purple-200 border border-purple-500/30
              hover:bg-purple-600/30 hover:text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all"
          >
            <Play className="h-4 w-4" />
            {isStarting ? 'Starting...' : 'Start Import'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-900/10 p-6">
      <div className="flex items-center gap-3">
        <Lock className="h-4 w-4 text-amber-400" />
        <span className="text-sm text-amber-300">Manual column mapping required — coming soon</span>
      </div>
    </div>
  );
}
