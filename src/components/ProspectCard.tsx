/**
 * ProspectCard — Rich card for a single prospect from search_prospects tool
 *
 * Displays warmth score, project details, contact info, case study,
 * and a "Draft Outreach" action button.
 */

import React from 'react';
import {
  MapPin, Building2, Thermometer, User, Briefcase,
  Award, ArrowRight, Flame, Snowflake, TrendingUp
} from 'lucide-react';

export interface ProspectContact {
  name: string;
  title: string;
  company: string;
  decision_maker?: boolean;
  budget_authority?: boolean;
  linkedin_connected?: boolean;
  linkedin_degree?: number | string;
  linkedin_mutual_name?: string;
}

export interface ProspectCaseStudy {
  client_name: string;
  project_name: string;
  service: string;
  roi_display: string;
  roi_type: string;
}

export interface Prospect {
  ref_id: string;
  project_name: string;
  address?: string;
  borough?: string;
  neighborhood?: string;
  gc_name?: string;
  owner?: string;
  sector?: string;
  phase?: string;
  stage?: string;
  estimated_value?: number;
  warmth_score?: number;
  warmth_factors?: string[];
  pain_points?: string[];
  primary_contact?: ProspectContact | null;
  relevant_case_study?: ProspectCaseStudy | null;
}

interface ProspectCardProps {
  prospect: Prospect;
  onDraftOutreach?: (prospectName: string, refId: string) => void;
  compact?: boolean;
}

const ProspectCard: React.FC<ProspectCardProps> = ({ prospect, onDraftOutreach, compact = false }) => {
  const warmth = prospect.warmth_score ?? 0;

  // Warmth tier
  const getWarmthTier = (score: number) => {
    if (score >= 80) return { label: 'Hot', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', icon: Flame };
    if (score >= 60) return { label: 'Warm', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30', icon: TrendingUp };
    if (score >= 40) return { label: 'Cool', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30', icon: Thermometer };
    return { label: 'Cold', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30', icon: Snowflake };
  };

  const tier = getWarmthTier(warmth);
  const TierIcon = tier.icon;

  const formatValue = (val?: number) => {
    if (!val) return null;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  if (compact) {
    return (
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-white truncate">{prospect.project_name}</h4>
            <p className="text-xs text-gray-400 truncate">
              {prospect.gc_name}{prospect.borough ? ` · ${prospect.borough}` : ''}
            </p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${tier.bg} ${tier.color}`}>
            <TierIcon size={10} />
            {warmth}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden hover:border-gray-600 transition-all">
      {/* Header: warmth bar */}
      <div className="relative h-1.5 bg-gray-700/50">
        <div
          className={`absolute inset-y-0 left-0 rounded-r-full ${
            warmth >= 80 ? 'bg-red-500' : warmth >= 60 ? 'bg-orange-500' : warmth >= 40 ? 'bg-blue-500' : 'bg-cyan-500'
          }`}
          style={{ width: `${Math.min(warmth, 100)}%` }}
        />
      </div>

      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white leading-tight">{prospect.project_name}</h3>
            {prospect.address && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{prospect.address}</span>
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-bold shrink-0 ${tier.bg} ${tier.color}`}>
            <TierIcon size={14} />
            {warmth}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
          {prospect.gc_name && (
            <div className="flex items-center gap-1.5 text-xs">
              <Building2 size={11} className="text-gray-500 shrink-0" />
              <span className="text-gray-300 truncate">{prospect.gc_name}</span>
            </div>
          )}
          {prospect.sector && (
            <div className="flex items-center gap-1.5 text-xs">
              <Briefcase size={11} className="text-gray-500 shrink-0" />
              <span className="text-gray-300 truncate">{prospect.sector}</span>
            </div>
          )}
          {prospect.phase && (
            <div className="text-xs">
              <span className="text-gray-500">Phase:</span>{' '}
              <span className="text-gray-300">{prospect.phase}</span>
            </div>
          )}
          {formatValue(prospect.estimated_value) && (
            <div className="text-xs">
              <span className="text-gray-500">Value:</span>{' '}
              <span className="text-green-400 font-medium">{formatValue(prospect.estimated_value)}</span>
            </div>
          )}
        </div>

        {/* Pain points */}
        {prospect.pain_points && prospect.pain_points.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {prospect.pain_points.slice(0, 3).map((pp, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-full">
                  {pp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        {prospect.primary_contact && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-700/30 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <User size={13} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {prospect.primary_contact.name}
                {prospect.primary_contact.decision_maker && (
                  <span className="ml-1 text-[9px] text-green-400 font-normal">DM</span>
                )}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{prospect.primary_contact.title} at {prospect.primary_contact.company}</p>
            </div>
            {prospect.primary_contact.linkedin_mutual_name && (
              <span className="text-[9px] text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                Mutual: {prospect.primary_contact.linkedin_mutual_name}
              </span>
            )}
          </div>
        )}

        {/* Case study */}
        {prospect.relevant_case_study && (
          <div className="flex items-start gap-2 mb-3 p-2 bg-green-500/5 border border-green-500/15 rounded-lg">
            <Award size={13} className="text-green-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-green-300 font-medium">Relevant Case Study</p>
              <p className="text-xs text-gray-300 truncate">{prospect.relevant_case_study.project_name}</p>
              <p className="text-[10px] text-green-400 font-medium">{prospect.relevant_case_study.roi_display}</p>
            </div>
          </div>
        )}

        {/* Action button */}
        {onDraftOutreach && (
          <button
            onClick={() => onDraftOutreach(prospect.project_name, prospect.ref_id)}
            className="w-full flex items-center justify-center gap-2 mt-1 px-3 py-2 text-xs font-medium text-blue-300 bg-blue-500/10 border border-blue-500/25 rounded-lg hover:bg-blue-500/20 hover:border-blue-500/40 transition-all"
          >
            Draft Outreach <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ProspectCard;
