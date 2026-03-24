/**
 * Import Step Indicator — single row in the processing step list.
 *
 * Shows status icon, step name, and duration/batch progress.
 */

import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';

interface ImportStepIndicatorProps {
  step: number;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  batch?: number;
  totalBatches?: number;
}

export function ImportStepIndicator({ step, name, status, batch, totalBatches }: ImportStepIndicatorProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Status icon */}
      <div className="flex-shrink-0 w-5 h-5">
        {status === 'complete' && (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        )}
        {status === 'processing' && (
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        )}
        {status === 'pending' && (
          <Circle className="w-5 h-5 text-gray-600" />
        )}
        {status === 'error' && (
          <AlertCircle className="w-5 h-5 text-red-400" />
        )}
      </div>

      {/* Step number + name */}
      <span className={`text-sm font-medium flex-1 ${
        status === 'complete' ? 'text-emerald-300' :
        status === 'processing' ? 'text-gray-100' :
        status === 'error' ? 'text-red-300' :
        'text-gray-500'
      }`}>
        <span className="text-gray-500 mr-1">{step}.</span>
        {name}
      </span>

      {/* Right side: batch progress or status */}
      <div className="flex-shrink-0 text-xs text-gray-500">
        {status === 'processing' && totalBatches && totalBatches > 0 && (
          <span className="text-purple-300">
            Batch {batch || 0}/{totalBatches}
          </span>
        )}
        {status === 'processing' && (!totalBatches || totalBatches === 0) && (
          <span className="text-purple-300">Running...</span>
        )}
        {status === 'complete' && (
          <span className="text-emerald-500">Done</span>
        )}
      </div>
    </div>
  );
}
