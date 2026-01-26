export type DocumentType =
  | 'strategic'
  | 'operations'
  | 'demographics'
  | 'financial'
  | 'capital-project';

export type AgentId = 'board-brief' | 'assessment-trends' | 'ozrf-section';

export interface RealDocument {
  id: string;
  filename: string;
  displayName: string;
  type: DocumentType;
  agents: AgentId[];
  uploadedAt: string;
  fileSize?: number;
  pageCount?: number;
}

export interface RealDocsIndex {
  district: string;
  location: string;
  documents: RealDocument[];
}

export interface RealDocsState {
  index: RealDocsIndex | null;
  documentOrder: string[];
  selectedDocuments: string[];
  isLoading: boolean;
  error: string | null;
}
