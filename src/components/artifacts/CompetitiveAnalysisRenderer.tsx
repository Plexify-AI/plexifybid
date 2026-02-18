/**
 * CompetitiveAnalysisRenderer — Renders a CompetitiveAnalysis artifact.
 *
 * Competitor cards in a grid, each with strengths/weaknesses, differentiator,
 * and threat level badge. Market position summary + strategy recommendations.
 */

import React from 'react';
import {
  Shield, Target, Lightbulb, TrendingUp, TrendingDown
} from 'lucide-react';
import type { CompetitiveAnalysisOutput, CompetitorEntry } from '../../types/artifacts';

interface Props {
  output: CompetitiveAnalysisOutput;
}

function threatBadge(level: string) {
  switch (level) {
    case 'high': return { bg: 'bg-red-500/15 border-red-500/25', text: 'text-red-400' };
    case 'medium': return { bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' };
    case 'low': return { bg: 'bg-green-500/15 border-green-500/25', text: 'text-green-400' };
    default: return { bg: 'bg-gray-500/15 border-gray-500/25', text: 'text-gray-400' };
  }
}

const CompetitorCard: React.FC<{ competitor: CompetitorEntry }> = ({ competitor }) => {
  const badge = threatBadge(competitor.threat_level);

  return (
    <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">{competitor.name}</h4>
        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase border ${badge.bg} ${badge.text}`}>
          {competitor.threat_level} threat
        </span>
      </div>

      {/* Differentiator */}
      <div className="bg-blue-500/8 border border-blue-500/15 rounded-lg px-3 py-2 mb-3">
        <p className="text-[10px] text-blue-400/70 uppercase tracking-wide mb-0.5">Differentiator</p>
        <p className="text-xs text-blue-300">{competitor.differentiator}</p>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingUp size={12} className="text-green-400" />
            <span className="text-[10px] text-green-400/70 uppercase font-medium">Strengths</span>
          </div>
          <ul className="space-y-1">
            {competitor.strengths.map((s, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <span className="text-green-500/60 mt-0.5">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingDown size={12} className="text-red-400" />
            <span className="text-[10px] text-red-400/70 uppercase font-medium">Weaknesses</span>
          </div>
          <ul className="space-y-1">
            {competitor.weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                <span className="text-red-500/60 mt-0.5">−</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const CompetitiveAnalysisRenderer: React.FC<Props> = ({ output }) => {
  return (
    <div className="space-y-5">
      {/* Market Position */}
      <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Market Position</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">{output.market_position}</p>
      </section>

      {/* Competitor Cards */}
      <section>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Shield size={16} className="text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Competitors ({output.competitors.length})</h3>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {output.competitors.map((comp, i) => (
            <CompetitorCard key={i} competitor={comp} />
          ))}
        </div>
      </section>

      {/* Strategy Recommendations */}
      {output.strategy_recommendations && output.strategy_recommendations.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Strategy Recommendations</h3>
          </div>
          <div className="space-y-2">
            {output.strategy_recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-amber-400/60 font-semibold shrink-0">{i + 1}.</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default CompetitiveAnalysisRenderer;
