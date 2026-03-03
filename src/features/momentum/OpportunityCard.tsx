/**
 * OpportunityCard — Opportunity with warmth badge, evidence, and actions
 *
 * Shows: WarmthBadge, account name, contact, evidence summary, delta.
 * Expandable: full drivers, penalties, event timeline, takeover status.
 * Actions: View Deal Room, Log Signal.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Briefcase, Plus, Clock, TrendingUp } from 'lucide-react';
import WarmthBadge from './WarmthBadge';

interface EventItem {
  id: string;
  event_type: string;
  payload?: any;
  created_at: string;
}

interface Explanation {
  summary: string;
  drivers: Array<{ event: string; points: string; description: string; when: string }>;
  penalties: Array<{ type: string; points: string; description: string }>;
  nextAction: string;
}

interface OpportunityData {
  id: string;
  account_name: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  warmth_score: number;
  stage: string;
  deal_hypothesis?: string;
  promoted_to_home: boolean;
  promotion_reason?: string;
  recent_events: EventItem[];
  explanation: Explanation;
  last_delta: number;
}

interface OpportunityCardProps {
  opportunity: OpportunityData;
  onLogSignal: (opportunityId: string) => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    prospecting: 'Prospecting',
    warming: 'Warming',
    engaged: 'Engaged',
    takeover_ready: 'Takeover Ready',
    active_deal: 'Active Deal',
    parked: 'Parked',
    ejected: 'Ejected',
  };
  return labels[stage] || stage;
}

function stageBadgeColor(stage: string): string {
  const colors: Record<string, string> = {
    prospecting: 'bg-gray-600/30 text-gray-300',
    warming: 'bg-blue-600/30 text-blue-300',
    engaged: 'bg-amber-600/30 text-amber-300',
    takeover_ready: 'bg-red-600/30 text-red-300',
    active_deal: 'bg-green-600/30 text-green-300',
    parked: 'bg-gray-600/30 text-gray-400',
    ejected: 'bg-red-900/30 text-red-400',
  };
  return colors[stage] || 'bg-gray-600/30 text-gray-300';
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, onLogSignal }) => {
  const [expanded, setExpanded] = useState(false);
  const opp = opportunity;

  return (
    <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 hover:border-gray-600/50 transition-colors">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <WarmthBadge score={opp.warmth_score} size="md" showDelta delta={opp.last_delta} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-white font-semibold text-sm truncate">{opp.account_name}</h3>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${stageBadgeColor(opp.stage)}`}>
              {stageLabel(opp.stage)}
            </span>
            {opp.promoted_to_home && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Promoted
              </span>
            )}
          </div>

          {opp.contact_name && (
            <p className="text-gray-400 text-xs">
              {opp.contact_name}
              {opp.contact_title ? ` — ${opp.contact_title}` : ''}
            </p>
          )}

          {/* Evidence summary */}
          <p className="text-gray-300 text-xs mt-1.5">{opp.explanation?.summary}</p>

          {/* Recent events inline */}
          {opp.recent_events?.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {opp.recent_events.map((evt) => (
                <span
                  key={evt.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-gray-700/50 text-gray-400 rounded"
                >
                  <Clock size={10} />
                  {evt.event_type.replace(/_/g, ' ').toLowerCase()} — {formatTimeAgo(evt.created_at)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onLogSignal(opp.id)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors"
          >
            <Plus size={12} /> Signal
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700/40 space-y-3">
          {/* Drivers */}
          {opp.explanation?.drivers?.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <TrendingUp size={12} /> Top Drivers
              </h4>
              <div className="space-y-1">
                {opp.explanation.drivers.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{d.description}</span>
                    <span className="text-green-400 font-medium">{d.points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Penalties */}
          {opp.explanation?.penalties?.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Penalties</h4>
              {opp.explanation.penalties.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{p.description}</span>
                  <span className="text-red-400 font-medium">{p.points}</span>
                </div>
              ))}
            </div>
          )}

          {/* Next Action */}
          {opp.explanation?.nextAction && (
            <div className="bg-gray-700/30 rounded-lg p-2.5">
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Next Action</h4>
              <p className="text-xs text-gray-200">{opp.explanation.nextAction}</p>
            </div>
          )}

          {/* Promotion reason */}
          {opp.promotion_reason && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <h4 className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">Promotion Reason</h4>
              <p className="text-xs text-amber-200">{opp.promotion_reason}</p>
            </div>
          )}

          {/* Deal hypothesis */}
          {opp.deal_hypothesis && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Deal Hypothesis</h4>
              <p className="text-xs text-gray-300">{opp.deal_hypothesis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OpportunityCard;
