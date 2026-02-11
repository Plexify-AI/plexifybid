import { Brain, Search, BarChart3 } from 'lucide-react';
import type { DemoAgent } from '../MelDemo.types';

const AGENT_CONFIG: Record<DemoAgent, { label: string; icon: typeof Brain }> = {
  'place-graph': { label: 'Place Graph Analyst', icon: Search },
  'ask-plexi': { label: 'Ask Plexi', icon: Brain },
  'notebook-bd': { label: 'NotebookBD RAG', icon: BarChart3 },
};

interface AgentIndicatorProps {
  agent: DemoAgent;
}

export function AgentIndicator({ agent }: AgentIndicatorProps) {
  const config = AGENT_CONFIG[agent];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-primary-50 border-l-3 border-primary-500 rounded-r-lg text-sm font-medium text-primary-700 animate-fadeIn">
      <Icon size={14} className="animate-pulse" />
      <span>[{config.label} activates]</span>
    </div>
  );
}
