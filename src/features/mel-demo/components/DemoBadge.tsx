import { Shield } from 'lucide-react';

export function DemoBadge() {
  return (
    <div className="fixed top-4 right-4 z-50 group" title="Using mock data for demonstration">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium shadow-sm">
        <Shield size={12} />
        <span>Demo Mode</span>
      </div>
    </div>
  );
}
