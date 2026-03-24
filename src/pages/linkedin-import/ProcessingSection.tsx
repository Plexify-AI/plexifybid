/**
 * LinkedIn Import — Processing Section
 *
 * Shows step-by-step pipeline progress with overall progress bar,
 * individual step indicators, and cancel button.
 */

import { useState } from 'react';
import { Lock, XCircle } from 'lucide-react';
import type { ImportJobStatus } from './LinkedInImport.types';
import { ImportStepIndicator } from './ImportStepIndicator';

interface ProcessingSectionProps {
  isActive: boolean;
  jobStatus: ImportJobStatus | null;
  onCancel: () => void;
}

export function ProcessingSection({ isActive, jobStatus, onCancel }: ProcessingSectionProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!isActive || !jobStatus) {
    return (
      <div className="rounded-xl border border-gray-700/20 bg-gray-800/20 p-6 opacity-50">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-500">Processing will begin after column mapping is confirmed</span>
        </div>
      </div>
    );
  }

  const { current_step, total_steps, step_name, steps, status } = jobStatus;
  const isProcessing = status === 'processing';
  const progressPct = total_steps > 0 ? Math.round(((current_step) / total_steps) * 100) : 0;

  return (
    <div className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-6 space-y-4">
      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-200">
            {status === 'complete' ? 'Import Complete' :
             status === 'error' ? 'Import Failed' :
             status === 'cancelled' ? 'Import Cancelled' :
             `Step ${current_step}/${total_steps}: ${step_name || 'Starting...'}`}
          </span>
          <span className="text-xs text-gray-400">{progressPct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-gray-700/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              status === 'complete' ? 'bg-emerald-500' :
              status === 'error' || status === 'cancelled' ? 'bg-red-500' :
              'bg-teal-500'
            }`}
            style={{ width: `${status === 'complete' ? 100 : progressPct}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="divide-y divide-gray-700/20">
        {(steps || []).map((step) => (
          <ImportStepIndicator
            key={step.step}
            step={step.step}
            name={step.name}
            status={step.status}
            batch={step.batch}
            totalBatches={step.total_batches}
          />
        ))}
      </div>

      {/* Error message */}
      {jobStatus.error_message && status !== 'cancelled' && (
        <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-3">
          <p className="text-sm text-red-300">{jobStatus.error_message}</p>
        </div>
      )}

      {/* Cancel button */}
      {isProcessing && (
        <div className="pt-2">
          {!showCancelConfirm ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancel Import
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-300">Cancel this import?</span>
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  onCancel();
                }}
                className="px-3 py-1 text-sm bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                Yes, cancel
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-3 py-1 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                No, continue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
