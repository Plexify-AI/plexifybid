/**
 * LinkedIn Import — Results Section (Locked Placeholder)
 *
 * Phase C: Will show import results, warmth distribution, top contacts.
 */

import { Lock } from 'lucide-react';

export function ResultsSection() {
  return (
    <div className="rounded-xl border border-gray-700/20 bg-gray-800/20 p-6 opacity-50">
      <div className="flex items-center gap-3">
        <Lock className="h-4 w-4 text-gray-600" />
        <span className="text-sm text-gray-500">Results will appear here after processing completes</span>
      </div>
    </div>
  );
}
