/**
 * LinkedIn Import — Column Mapping Section
 *
 * Phase A: Shows "Column mapping confirmed" when auto_mapped is true.
 * Phase B: Manual mapping UI when auto_mapped is false.
 */

import { CheckCircle, Lock } from 'lucide-react';

interface ColumnMappingSectionProps {
  autoMapped: boolean | null;
  isActive: boolean;
}

export function ColumnMappingSection({ autoMapped, isActive }: ColumnMappingSectionProps) {
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
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <span className="text-sm text-emerald-300">Column mapping confirmed — all required fields auto-detected</span>
        </div>
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
