-- Email Integration — Phase 1
-- Tables: email_accounts (encrypted OAuth tokens), email_audit_log (action tracking)
-- Run manually in Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- email_accounts: stores encrypted OAuth tokens per tenant per provider
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL,
  provider                 TEXT NOT NULL CHECK (provider IN ('microsoft', 'gmail')),
  email_address            TEXT NOT NULL,
  display_name             TEXT,
  access_token_encrypted   BYTEA NOT NULL,
  refresh_token_encrypted  BYTEA NOT NULL,
  token_expires_at         TIMESTAMPTZ NOT NULL,
  scopes                   TEXT[] NOT NULL DEFAULT '{}',
  connection_status        TEXT NOT NULL DEFAULT 'active'
    CHECK (connection_status IN ('active', 'needs_reauth', 'disconnected', 'error')),
  last_used_at             TIMESTAMPTZ,
  last_error               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider, email_address)
);

-- RLS: service-role full access (matches existing pattern)
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_accounts"
  ON email_accounts FOR ALL
  USING (true) WITH CHECK (true);

-- Index for quick lookup during tool execution
CREATE INDEX idx_email_accounts_tenant_provider
  ON email_accounts(tenant_id, provider, connection_status);

-- ---------------------------------------------------------------------------
-- email_audit_log: every email action recorded
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  user_id           UUID NOT NULL,
  email_account_id  UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  action_type       TEXT NOT NULL CHECK (action_type IN (
    'send', 'reply', 'forward', 'list', 'search', 'get',
    'connect', 'disconnect', 'refresh_token', 'reauth'
  )),
  recipients_count  INTEGER DEFAULT 0,
  subject_hash      TEXT,       -- SHA-256 hash, not plaintext
  message_id        TEXT,       -- Graph/Gmail message ID for correlation
  success           BOOLEAN NOT NULL DEFAULT true,
  error_message     TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service-role full access
ALTER TABLE email_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_audit_log"
  ON email_audit_log FOR ALL
  USING (true) WITH CHECK (true);

-- Index for audit queries
CREATE INDEX idx_email_audit_log_tenant_date
  ON email_audit_log(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- email_send_drafts: server-side draft storage for two-step send approval
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_send_drafts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  tool_name     TEXT NOT NULL CHECK (tool_name IN ('send_email', 'reply_to_email')),
  draft_payload JSONB NOT NULL,    -- full tool input (to, subject, body, etc.)
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'sent', 'cancelled', 'expired')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes')
);

ALTER TABLE email_send_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_send_drafts"
  ON email_send_drafts FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX idx_email_send_drafts_tenant_status
  ON email_send_drafts(tenant_id, status);

-- ---------------------------------------------------------------------------
-- Auto-update updated_at on email_accounts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW EXECUTE FUNCTION update_email_accounts_updated_at();
