export interface DealRoom {
  id: string;
  tenant_id: string;
  opportunity_id: string | null;
  project_id: string | null;
  prospect_id: string | null;
  name: string;
  description: string | null;
  room_type: 'aec' | 'bid' | 'general';
  status: 'active' | 'archived' | 'draft';
  warmth_score: number;
  source_count: number;
  message_count: number;
  word_count: number;
  active_tab: DealRoomTab;
  tab_content: Record<DealRoomTab, string>;
  created_at: string;
  updated_at: string;
}

export type DealRoomTab =
  | 'deal_summary'
  | 'competitive_analysis'
  | 'meeting_prep'
  | 'board_brief'
  | 'ozrf_section';

export const DEAL_ROOM_TAB_LABELS: Record<DealRoomTab, string> = {
  deal_summary: 'Deal Summary',
  competitive_analysis: 'Competitive Analysis',
  meeting_prep: 'Meeting Prep',
  board_brief: 'Board Brief',
  ozrf_section: 'OZRF Section',
};

export const DEAL_ROOM_TAB_ICONS: Record<DealRoomTab, string> = {
  deal_summary: '\u{1F4CB}',
  competitive_analysis: '\u{1F4CA}',
  meeting_prep: '\u{1F91D}',
  board_brief: '\u{1F4C4}',
  ozrf_section: '\u{1F3DB}',
};

export const DEAL_ROOM_TABS: DealRoomTab[] = [
  'deal_summary',
  'competitive_analysis',
  'meeting_prep',
  'board_brief',
  'ozrf_section',
];

export const EMPTY_TAB_CONTENT: Record<DealRoomTab, string> = {
  deal_summary: '',
  competitive_analysis: '',
  meeting_prep: '',
  board_brief: '',
  ozrf_section: '',
};

export interface DealRoomSource {
  id: string;
  deal_room_id: string;
  tenant_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_size_bytes?: number | null;
  storage_path: string | null;
  processing_status: 'pending' | 'processing' | 'ready' | 'error';
  summary: string | null;
  chunk_count: number;
  sort_order: number;
  is_selected: boolean;
  uploaded_at: string;
  created_at?: string;
}

export interface DealRoomArtifact {
  id: string;
  deal_room_id: string;
  tenant_id: string;
  artifact_type: string;
  title: string;
  subtitle: string | null;
  content: Record<string, unknown> | null;
  thumbnail_url: string | null;
  status: 'generating' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface DealRoomMessage {
  id: string;
  deal_room_id: string;
  tenant_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface Citation {
  source_id: string;
  chunk_index: number;
  text: string;
  source_name?: string;
}

// Golden Triangle BID demo room ID (fixed for reproducible demo URLs)
export const GOLDEN_TRIANGLE_ROOM_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
