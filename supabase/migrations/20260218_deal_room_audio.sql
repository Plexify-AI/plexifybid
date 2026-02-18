-- Deal Room Audio table
-- Stores audio briefings (single voice) and two-voice podcasts
-- generated from artifacts via ElevenLabs TTS.

CREATE TABLE IF NOT EXISTS deal_room_audio (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deal_room_id      UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  artifact_id       UUID REFERENCES deal_room_artifacts(id) ON DELETE SET NULL,
  audio_type        TEXT NOT NULL CHECK (audio_type IN ('briefing', 'podcast')),
  title             TEXT NOT NULL DEFAULT '',
  script            TEXT,
  podcast_script    JSONB,
  storage_path      TEXT,
  duration_seconds  INTEGER,
  status            TEXT NOT NULL DEFAULT 'generating'
                      CHECK (status IN ('generating', 'ready', 'error')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_room_audio_tenant
  ON deal_room_audio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_room_audio_room
  ON deal_room_audio(tenant_id, deal_room_id);

-- RLS
ALTER TABLE deal_room_audio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on deal_room_audio"
  ON deal_room_audio FOR ALL
  USING (true)
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_updated_at_deal_room_audio
  BEFORE UPDATE ON deal_room_audio
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
