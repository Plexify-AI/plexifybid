/**
 * LinkedIn Import — Processing Section (Locked Placeholder)
 *
 * Phase B: Will show step-by-step pipeline progress.
 */

import { Lock } from 'lucide-react';

export function ProcessingSection() {
  return (
    <div className="rounded-xl border border-gray-700/20 bg-gray-800/20 p-6 opacity-50">
      <div className="flex items-center gap-3">
        <Lock className="h-4 w-4 text-gray-600" />
        <span className="text-sm text-gray-500">Processing will begin after column mapping is confirmed</span>
      </div>
    </div>
  );
}
