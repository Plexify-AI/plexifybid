/**
 * PipelineAnalysis — Visual dashboard for analyze_pipeline tool results
 *
 * Shows KPI cards, warmth distribution chart (recharts), group breakdown,
 * top opportunities, and stalled prospects.
 */

import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import {
  TrendingUp, DollarSign, Thermometer, Users, AlertTriangle,
  ChevronDown, ChevronUp, Flame
} from 'lucide-react';

interface PipelineGroup {
  count: number;
  total_value: number;
  avg_warmth: number;
  prospects: string[];
}

interface TopOpportunity {
  ref_id: string;
  project_name: string;
  gc_name?: string;
  warmth_score?: number;
  estimated_value?: number;
  phase?: string;
  stage?: string;
  contact_name?: string;
  has_decision_maker?: boolean;
}

interface StalledProspect {
  ref_id: string;
  project_name: string;
  warmth_score?: number;
  stage?: string;
}

interface PipelineData {
  total_prospects: number;
  total_pipeline_value: number;
  avg_warmth_score: number;
  warmth_distribution: {
    hot: number;
    warm: number;
    cool: number;
    cold: number;
  };
  grouped_by: string;
  groups: Record<string, PipelineGroup>;
  top_opportunities: TopOpportunity[];
  stalled_prospects: StalledProspect[];
  analysis_note?: string;
}

interface PipelineAnalysisProps {
  data: PipelineData;
  onDraftOutreach?: (prospectName: string, refId: string) => void;
}

const formatValue = (val: number): string => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
};

const WARMTH_COLORS: Record<string, string> = {
  hot: '#ef4444',
  warm: '#f97316',
  cool: '#3b82f6',
  cold: '#06b6d4',
};

const PipelineAnalysis: React.FC<PipelineAnalysisProps> = ({ data, onDraftOutreach }) => {
  const [showStalled, setShowStalled] = useState(false);

  const warmthData = Object.entries(data.warmth_distribution).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
    color: WARMTH_COLORS[key],
  }));

  const groupData = Object.entries(data.groups)
    .map(([key, group]) => ({
      name: key.length > 14 ? key.substring(0, 12) + '...' : key,
      fullName: key,
      count: group.count,
      value: group.total_value,
      warmth: group.avg_warmth,
    }))
    .sort((a, b) => b.value - a.value);

  // Custom tooltip for bar chart
  const GroupTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-white">{d.fullName}</p>
        <p className="text-gray-400">{d.count} prospects</p>
        <p className="text-green-400">{formatValue(d.value)}</p>
        <p className="text-orange-400">Avg warmth: {d.warmth}</p>
      </div>
    );
  };

  return (
    <div className="mt-3 mb-1 space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Prospects</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.total_prospects}</p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-green-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Pipeline Value</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatValue(data.total_pipeline_value)}</p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer size={14} className="text-orange-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Avg Warmth</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{data.avg_warmth_score}</p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={14} className="text-red-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Hot Leads</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{data.warmth_distribution.hot}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Warmth Distribution — Pie */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Warmth Distribution</h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={warmthData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  stroke="none"
                >
                  {warmthData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#d1d5db' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-1">
            {warmthData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-400">{entry.name}</span>
                <span className="text-gray-500">({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Group Breakdown — Bar */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            By {data.grouped_by.charAt(0).toUpperCase() + data.grouped_by.slice(1)}
          </h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatValue(v)}
                />
                <Tooltip content={<GroupTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {groupData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.warmth >= 70 ? '#f97316' : entry.warmth >= 50 ? '#3b82f6' : '#6b7280'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Opportunities */}
      {data.top_opportunities.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-green-400" />
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top Opportunities</h4>
          </div>
          <div className="space-y-2">
            {data.top_opportunities.map((opp, i) => (
              <div
                key={opp.ref_id}
                className="flex items-center gap-3 p-2.5 bg-gray-700/25 rounded-lg hover:bg-gray-700/40 transition-colors"
              >
                <span className="text-xs font-bold text-gray-500 w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{opp.project_name}</p>
                  <p className="text-[10px] text-gray-400">
                    {opp.gc_name}{opp.phase ? ` · ${opp.phase}` : ''}{opp.contact_name ? ` · ${opp.contact_name}` : ''}
                    {opp.has_decision_maker && <span className="text-green-400 ml-1">DM</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {opp.estimated_value && (
                    <span className="text-xs font-medium text-green-400">{formatValue(opp.estimated_value)}</span>
                  )}
                  <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    (opp.warmth_score ?? 0) >= 80 ? 'bg-red-500/15 text-red-400' :
                    (opp.warmth_score ?? 0) >= 60 ? 'bg-orange-500/15 text-orange-400' :
                    'bg-blue-500/15 text-blue-400'
                  }`}>
                    {opp.warmth_score}
                  </div>
                </div>
                {onDraftOutreach && (
                  <button
                    onClick={() => onDraftOutreach(opp.project_name, opp.ref_id)}
                    className="text-[10px] text-blue-300 hover:text-blue-200 bg-blue-500/10 border border-blue-500/25 px-2 py-1 rounded-md hover:bg-blue-500/20 transition-all shrink-0"
                  >
                    Draft
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stalled Prospects */}
      {data.stalled_prospects.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <button
            onClick={() => setShowStalled(!showStalled)}
            className="flex items-center gap-2 w-full text-left"
          >
            <AlertTriangle size={14} className="text-amber-400" />
            <h4 className="text-xs font-medium text-amber-300 uppercase tracking-wide flex-1">
              {data.stalled_prospects.length} Stalled High-Warmth Prospects
            </h4>
            {showStalled ? (
              <ChevronUp size={14} className="text-amber-400" />
            ) : (
              <ChevronDown size={14} className="text-amber-400" />
            )}
          </button>
          {showStalled && (
            <div className="mt-3 space-y-2">
              {data.stalled_prospects.map((p) => (
                <div key={p.ref_id} className="flex items-center gap-3 p-2 bg-gray-800/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.project_name}</p>
                    <p className="text-[10px] text-gray-400">Stage: {p.stage}</p>
                  </div>
                  <div className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-400">
                    {p.warmth_score}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PipelineAnalysis;
