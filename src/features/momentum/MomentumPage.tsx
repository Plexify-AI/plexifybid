/**
 * MomentumPage — Warmth-driven opportunity pipeline view
 *
 * Route: /momentum
 * Header with "+ Log Signal" button. Stage filter tabs.
 * Opportunity cards sorted by warmth DESC. Dark theme.
 */

import React, { useState } from 'react';
import { Plus, Flame, Loader2 } from 'lucide-react';
import OpportunityCard from './OpportunityCard';
import SignalLogModal from './SignalLogModal';
import { useMomentum, MomentumFilter } from './useMomentum';
import { useSignalLog } from './useSignalLog';

const FILTER_TABS: { key: MomentumFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Hot (75+)' },
  { key: 'warm', label: 'Warm (40-74)' },
  { key: 'cold', label: 'Cold (<40)' },
  { key: 'promoted', label: 'Promoted' },
];

const MomentumPage: React.FC = () => {
  const { opportunities, loading, error, refetch, filter, setFilter } = useMomentum();
  const { logSignal } = useSignalLog();
  const [showModal, setShowModal] = useState(false);
  const [selectedOppId, setSelectedOppId] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);

  const handleLogSignal = (oppId: string) => {
    setSelectedOppId(oppId);
    setShowModal(true);
  };

  const handleSubmitSignal = async (oppId: string, eventType: string, payload?: any) => {
    const result = await logSignal(oppId, eventType, payload);
    if (result?.warmth) {
      const w = result.warmth;
      const deltaStr = w.delta >= 0 ? `+${w.delta}` : `${w.delta}`;
      setToast(`Warmth: ${w.scoreBefore} → ${w.scoreAfter} (${deltaStr})`);
      setTimeout(() => setToast(null), 4000);
      refetch();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
            <Flame size={20} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Momentum</h1>
            <p className="text-xs text-gray-400">Warmth-driven pipeline intelligence</p>
          </div>
        </div>

        <button
          onClick={() => { setSelectedOppId(undefined); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          <Plus size={16} /> Log Signal
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 bg-gray-800/40 rounded-lg p-1 border border-gray-700/30">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === tab.key
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-blue-400 animate-spin" />
          <span className="ml-2 text-gray-400 text-sm">Loading opportunities...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-400 text-sm mb-2">Failed to load opportunities</p>
          <p className="text-gray-500 text-xs">{error}</p>
          <button
            onClick={refetch}
            className="mt-3 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-16">
          <Flame size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No opportunities found</p>
          <p className="text-gray-500 text-xs mt-1">
            {filter !== 'all' ? 'Try a different filter' : 'Create your first opportunity to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onLogSignal={handleLogSignal}
            />
          ))}
        </div>
      )}

      {/* Signal Log Modal */}
      <SignalLogModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        opportunities={opportunities}
        selectedOpportunityId={selectedOppId}
        onSubmit={handleSubmitSignal}
      />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <Flame size={16} className="text-orange-400" />
          <span className="text-sm text-white font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default MomentumPage;
