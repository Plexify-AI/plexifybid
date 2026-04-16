-- ============================================================================
-- Sprint B / Task B3 — AskPlexi Chat Library
-- Extend the existing public.conversations table (from 20260212) with
-- library affordances. No new table — reuses the existing persistence path.
--
-- New columns:
--   title        — auto-derived from first user message, user-editable (future)
--   pinned       — stick important conversations to the top of the list
--   user_id      — Phase 1: equals tenant_id. Schema-ready for auth.users.
--   ui_messages  — rich PlexiMessage[] for full-fidelity UI reload
--                  (tool results, prospect cards, email drafts, etc.)
--   is_archived  — soft-delete flag; list endpoint filters these out.
--
-- 2026-04-15
-- ============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title         TEXT,
  ADD COLUMN IF NOT EXISTS pinned        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_id       UUID,
  ADD COLUMN IF NOT EXISTS ui_messages   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_archived   BOOLEAN NOT NULL DEFAULT false;

-- Backfill user_id = tenant_id for existing rows (Phase 1: tenant = user)
UPDATE public.conversations
   SET user_id = tenant_id
 WHERE user_id IS NULL;

-- Library list index — pinned-first, newest-first, active only
CREATE INDEX IF NOT EXISTS idx_conversations_library
  ON public.conversations(tenant_id, user_id, pinned DESC, updated_at DESC)
  WHERE is_archived = false;

COMMENT ON COLUMN public.conversations.title        IS 'Auto-derived from the first user message on create. User-editable later.';
COMMENT ON COLUMN public.conversations.pinned       IS 'When true, conversation floats to the top of the library list.';
COMMENT ON COLUMN public.conversations.user_id      IS 'Phase 1: equals tenant_id. Schema-ready for auth.users integration.';
COMMENT ON COLUMN public.conversations.ui_messages  IS 'Rich PlexiMessage[] shape for full-fidelity UI reload. Separate from messages (which stores the {role,content} shape for Claude API continuation).';
COMMENT ON COLUMN public.conversations.is_archived  IS 'Soft-delete flag. List endpoint excludes archived.';
