/**
 * HomeOpportunityCards — Promoted + hot opportunity cards for Home screen
 *
 * Shows top 5 opportunities (warmth >= 40 or promoted_to_home = true).
 * Reuses WarmthBadge from Momentum. Uses OpportunityCard from Momentum.
 * Status badge: TAKEOVER READY (promoted), HOT (75+), WARMING (40-74).
 * Empty state guides user to Command Bar or Momentum.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ArrowRight, Search } from 'lucide-react';
import OpportunityCard from '../momentum/OpportunityCard';
import SignalLogModal from '../momentum/SignalLogModal';
import { useHomeOpportunities } from './useHomeOpportunities';
import { useSignalLog } from '../momentum/useSignalLog';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CardsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-700/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700/50 rounded w-2/3" />
              <div className="h-3 bg-gray-700/30 rounded w-1/2" />
              <div className="h-3 bg-gray-700/30 rounded w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeOpportunityCards component
// ---------------------------------------------------------------------------

const HomeOpportunityCards: React.FC = () => {
  const navigate = useNavigate();
  const { opportunities, loading, error, refetch } = useHomeOpportunities();
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
      setToast(`Warmth: ${w.scoreBefore} \u2192 ${w.scoreAfter} (${deltaStr})`);
      setTimeout(() => setToast(null), 4000);
      refetch();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hot Opportunities</h2>
        <CardsSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hot Opportunities</h2>
        <div className="text-center py-8">
          <p className="text-red-400 text-sm mb-2">Failed to load opportunities</p>
          <button
            onClick={refetch}
            className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (opportunities.length === 0) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hot Opportunities</h2>
        <div className="text-center py-10 bg-gray-800/20 border border-gray-700/30 rounded-xl">
          <Flame size={28} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm mb-1">No hot opportunities yet.</p>
          <p className="text-gray-500 text-xs mb-4">
            Use the command bar to find prospects, or visit Momentum for your full pipeline.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/momentum')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <Flame size={14} /> Go to Momentum
            </button>
            <button
              onClick={() => navigate('/ask-plexi?prefill=' + encodeURIComponent('Show me my best prospects'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-300 bg-blue-600/20 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors"
            >
              <Search size={14} /> Find prospects
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Populated state
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Hot Opportunities</h2>

      <div className="space-y-3">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onLogSignal={handleLogSignal}
          />
        ))}
      </div>

      {/* View all link */}
      <button
        onClick={() => navigate('/momentum')}
        className="flex items-center gap-1.5 mt-4 text-xs text-gray-400 hover:text-blue-400 transition-colors mx-auto"
      >
        View all opportunities <ArrowRight size={14} />
      </button>

      {/* Signal Log Modal — reused from Momentum */}
      <SignalLogModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        opportunities={opportunities}
        selectedOpportunityId={selectedOppId}
        onSubmit={handleSubmitSignal}
      />

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-2">
          <Flame size={16} className="text-orange-400" />
          <span className="text-sm text-white font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default HomeOpportunityCards;
