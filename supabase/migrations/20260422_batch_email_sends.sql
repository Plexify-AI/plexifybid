-- Sprint BATCH-50 Task 4 — batch_email_sends audit table.
--
-- One row per (batch_id, opportunity_id) send attempt. Captures success and
-- failure outcomes for both visibility and idempotency:
--
--   - On retry, the server checks for an existing row with the same
--     (batch_id, opportunity_id, status='sent') within the last hour and
--     short-circuits the send to prevent duplicate emails to the same
--     recipient if Ben's browser crashes or network drops mid-loop.
--
--   - Failed rows surface in the UI's "Retry failed?" affordance.

CREATE TABLE IF NOT EXISTS batch_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NULL,
  batch_id UUID NOT NULL,
  opportunity_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_duplicate')),
  error_message TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS batch_email_sends_tenant_batch_idx
  ON batch_email_sends (tenant_id, batch_id);

CREATE INDEX IF NOT EXISTS batch_email_sends_idempotency_idx
  ON batch_email_sends (tenant_id, batch_id, opportunity_id, status);

ALTER TABLE batch_email_sends ENABLE ROW LEVEL SECURITY;

-- Service role full access (Express server uses service role).
DROP POLICY IF EXISTS batch_email_sends_service_all ON batch_email_sends;
CREATE POLICY batch_email_sends_service_all ON batch_email_sends
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
