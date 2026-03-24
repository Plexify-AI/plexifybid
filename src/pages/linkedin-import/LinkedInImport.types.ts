/**
 * LinkedIn Import — TypeScript interfaces
 */

export interface ColumnMapping {
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  position?: string;
  connected_on?: string;
  url?: string;
}

export interface UploadManifest {
  jobId: string;
  files_found: string[];
  files_missing: string[];
  contact_count: number;
  columns_detected: Record<string, string[]>;
  column_mapping: ColumnMapping;
  auto_mapped: boolean;
  scoring_dimensions_available: number;
  scoring_dimensions_max: number;
}

export interface ImportStep {
  name: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

export interface WarmthDistribution {
  strong: number;
  warm: number;
  cold: number;
  no_signal: number;
}

export interface TopContact {
  name: string;
  company: string;
  warmth_composite: number;
  warmth_label: string;
  priority: string;
}

export interface ImportResults {
  total_processed: number;
  total_imported: number;
  total_skipped: number;
  warmth_distribution: WarmthDistribution;
  top_contacts: TopContact[];
  priority_breakdown: Record<string, number>;
}

export interface ImportJob {
  id: string;
  tenant_id: string;
  status: string;
  current_step: number;
  total_steps: number;
  current_batch: number;
  total_batches: number;
  step_name: string | null;
  contact_count: number | null;
  files_found: string[] | null;
  files_missing: string[] | null;
  column_mapping: ColumnMapping | null;
  thresholds: { p0: number; p1: number; p2: number };
  results: ImportResults | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportState = 'idle' | 'uploading' | 'validating' | 'mapping' | 'processing' | 'complete' | 'error';

export interface ImportContext {
  state: ImportState;
  jobId: string | null;
  uploadProgress: number;
  manifest: UploadManifest | null;
  error: string | null;
}
