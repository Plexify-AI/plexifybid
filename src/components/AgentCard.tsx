/**
 * AgentCard — Reusable card for the PlexiCoS agent registry
 *
 * Displays agent name, role, status badge, description, capability pills,
 * model info, and action button. ACTIVE vs COMING SOON styling.
 */

import React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: LucideIcon;
  status: 'active' | 'coming_soon';
  capabilities: string[];
  model: string;
  actionLabel: string;
  actionQuery?: string; // pre-loaded query for Ask Plexi nav
  actionPath?: string;  // direct path navigation (e.g., /ask-plexi)
}

interface AgentCardProps {
  agent: AgentDef;
  onAction: (agent: AgentDef) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onAction }) => {
  const isActive = agent.status === 'active';
  const Icon = agent.icon;

  return (
    <div
      className={`relative bg-gray-800/60 border rounded-xl overflow-hidden transition-all duration-200 flex flex-col ${
        isActive
          ? 'border-gray-700/50 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5'
          : 'border-gray-700/30 opacity-70'
      }`}
    >
      <div className="p-5 flex-1 flex flex-col">
        {/* Header: icon + name + status */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isActive ? 'bg-blue-500/15 text-blue-400' : 'bg-gray-700/40 text-gray-500'
            }`}
          >
            <Icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {agent.name}
              </h3>
              <span
                className={`shrink-0 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded-full ${
                  isActive
                    ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                }`}
              >
                {isActive ? 'Active' : 'Coming Soon'}
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isActive ? 'text-blue-300/80' : 'text-gray-500'}`}>
              {agent.role}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className={`text-xs leading-relaxed mb-3 flex-1 ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
          {agent.description}
        </p>

        {/* Capability pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className={`px-2 py-0.5 text-[10px] rounded-full ${
                isActive
                  ? 'bg-gray-700/50 text-gray-300 border border-gray-600/40'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-700/30'
              }`}
            >
              {cap}
            </span>
          ))}
        </div>

        {/* Model info */}
        <p className={`text-[10px] mb-3 ${isActive ? 'text-gray-500' : 'text-gray-600'}`}>
          Model: {agent.model}
        </p>

        {/* Action button */}
        <button
          onClick={() => onAction(agent)}
          disabled={!isActive}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg transition-all ${
            isActive
              ? 'text-blue-300 bg-blue-500/10 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-500/40'
              : 'text-gray-500 bg-gray-700/20 border border-gray-700/30 cursor-not-allowed'
          }`}
        >
          {agent.actionLabel}
          {isActive && <ArrowRight size={12} />}
        </button>
      </div>
    </div>
  );
};

export default AgentCard;
