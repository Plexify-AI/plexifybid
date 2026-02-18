/**
 * DealSummaryRenderer — Renders a DealSummary artifact as a polished card layout.
 *
 * Sections: Executive Summary, Key Metrics (2-col grid), Key Players,
 * Timeline, Risks (with severity badges), Next Steps.
 */

import React from 'react';
import {
  TrendingUp, Users, Clock, AlertTriangle,
  ArrowRight, BarChart3, CheckCircle2
} from 'lucide-react';
import type { DealSummaryOutput } from '../../types/artifacts';

interface Props {
  output: DealSummaryOutput;
}

function severityColor(severity: string) {
  switch (severity) {
    case 'high': return 'bg-red-500/15 text-red-400 border-red-500/25';
    case 'medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
    case 'low': return 'bg-green-500/15 text-green-400 border-green-500/25';
    default: return 'bg-gray-500/15 text-gray-400 border-gray-500/25';
  }
}

const DealSummaryRenderer: React.FC<Props> = ({ output }) => {
  return (
    <div className="space-y-5">
      {/* Executive Summary */}
      <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Executive Summary</h3>
        </div>
        <ul className="space-y-2">
          {output.executive_summary.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-blue-400 mt-1 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Key Metrics */}
      {output.key_metrics && output.key_metrics.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Key Metrics</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {output.key_metrics.map((metric, i) => (
              <div key={i} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">{metric.label}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{metric.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key Players */}
      {output.key_players && output.key_players.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Key Players</h3>
          </div>
          <div className="space-y-2">
            {output.key_players.map((player, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-purple-400">{player.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{player.name}</p>
                  <p className="text-[11px] text-gray-500">
                    {player.role}{player.organization ? ` — ${player.organization}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      {output.timeline && output.timeline.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Timeline</h3>
          </div>
          <div className="space-y-2">
            {output.timeline.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-cyan-400">{i + 1}</span>
                </div>
                <p className="text-sm text-gray-300">{item}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Risks */}
      {output.risks && output.risks.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Risks</h3>
          </div>
          <div className="space-y-2">
            {output.risks.map((risk, i) => (
              <div key={i} className="bg-gray-900/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${severityColor(risk.severity)}`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{risk.description}</p>
                {risk.mitigation && (
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-gray-400">Mitigation:</span> {risk.mitigation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Next Steps */}
      {output.next_steps && output.next_steps.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Next Steps</h3>
          </div>
          <div className="space-y-2">
            {output.next_steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <CheckCircle2 size={14} className="text-blue-400/60 shrink-0 mt-0.5" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DealSummaryRenderer;
