export interface SourceMaterial {
  id: string;
  label: string;
  type: 'log' | 'rfi' | 'photo' | 'schedule' | 'document';
  date?: string;
  count?: number;
  url?: string;
}

export interface AudioChapter {
  label: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  label: string;
  action: 'insert' | 'replace' | 'expand';
  content?: string;
}

export interface Project {
  id: string;
  name: string;
  phase: string;
  budget: number;
  timeline: string;
  responsible?: string;
}

export type TerminologySet = 'construction' | 'bid' | 'business';

export interface TerminologyConfig {
  reportTitle: string;
  regenerateButton: string;
  aiAssistantName: string;
  sourceMaterialsLabel: string;
}

export const terminologyConfigs: Record<TerminologySet, TerminologyConfig> = {
  construction: {
    reportTitle: 'Proposal Document',
    regenerateButton: 'Regenerate Proposal',
    aiAssistantName: 'Plexify AI - BD Assistant',
    sourceMaterialsLabel: 'Opportunity Sources',
  },
  bid: {
    reportTitle: 'Board Report',
    regenerateButton: 'Regenerate Report',
    aiAssistantName: 'Plexify AI - BID Assistant',
    sourceMaterialsLabel: 'Source Materials',
  },
  business: {
    reportTitle: 'Compliance Report',
    regenerateButton: 'Regenerate Report',
    aiAssistantName: 'Plexify AI - Business Assistant',
    sourceMaterialsLabel: 'Documents',
  },
};

export interface EditorBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'list' | 'image' | 'chart' | 'table';
  content: string;
  level?: number;
  items?: string[];
  src?: string;
  alt?: string;
  data?: unknown;
}

export interface WorkspaceConfig {
  showAudioBriefing?: boolean;
  showVideoSummary?: boolean;
  showSourceMaterials?: boolean;
  showAIAssistant?: boolean;
  allowExport?: boolean;
  exportFormats?: ('pdf' | 'pptx')[];
}
