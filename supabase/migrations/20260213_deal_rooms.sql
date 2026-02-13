-- PlexifySOLO Deal Room Tables
-- Migration: 20260213_deal_rooms
-- Creates: deal_rooms, deal_room_sources, deal_room_messages
-- Supports document upload, RAG processing, and source-grounded AI chat.

-- ============================================================================
-- 1. DEAL_ROOMS — workspace per deal/pursuit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deal_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  prospect_id     UUID REFERENCES public.prospects(id),  -- optional link
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_rooms_tenant ON public.deal_rooms(tenant_id);
CREATE INDEX idx_deal_rooms_status ON public.deal_rooms(tenant_id, status);

-- ============================================================================
-- 2. DEAL_ROOM_SOURCES — uploaded documents with extracted text + chunks
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deal_room_sources (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id        UUID NOT NULL REFERENCES public.deal_rooms(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name           TEXT NOT NULL,
  file_type           TEXT NOT NULL,                     -- pdf, docx, txt, md, csv
  file_size           INTEGER,                           -- bytes
  storage_path        TEXT NOT NULL,                     -- path in Supabase Storage bucket
  processing_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending', 'processing', 'ready', 'error')),
  content_text        TEXT,                              -- extracted full text for RAG
  content_chunks      JSONB DEFAULT '[]'::jsonb,         -- chunked text with metadata
  chunk_count         INTEGER DEFAULT 0,
  summary             TEXT,                              -- AI-generated one-line summary
  error_message       TEXT,                              -- error details if processing failed
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_room_sources_room ON public.deal_room_sources(deal_room_id);
CREATE INDEX idx_deal_room_sources_tenant ON public.deal_room_sources(tenant_id);
CREATE INDEX idx_deal_room_sources_status ON public.deal_room_sources(processing_status);

-- ============================================================================
-- 3. DEAL_ROOM_MESSAGES — chat history with citations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deal_room_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id    UUID NOT NULL REFERENCES public.deal_rooms(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  citations       JSONB DEFAULT '[]'::jsonb,             -- [{source_id, source_name, chunk_index, text}]
  tool_results    JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_room_messages_room ON public.deal_room_messages(deal_room_id);
CREATE INDEX idx_deal_room_messages_tenant ON public.deal_room_messages(tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.deal_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_room_sources   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_room_messages  ENABLE ROW LEVEL SECURITY;

-- Service role (backend) can do everything
CREATE POLICY "Service role full access" ON public.deal_rooms
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.deal_room_sources
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.deal_room_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Anon read access (matches existing pattern)
CREATE POLICY "Anon read access" ON public.deal_rooms
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.deal_room_sources
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.deal_room_messages
  FOR SELECT USING (true);

-- ============================================================================
-- UPDATED_AT triggers
-- ============================================================================
-- set_updated_at() function already exists from 20260212 migration

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.deal_rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
