-- Sprint BATCH-50 follow-up — opener_context_hint per template.
--
-- Threads template-specific timing/context guidance into the {{personalized
-- _opener}} LLM call. The opener generation route reads this field from
-- the resolved template and appends it to the Anthropic system prompt so
-- the AI knows whether the event is past, future, or N/A — fixes the
-- "before the 2026 Animation Y'all event" generated artifact (event
-- happened April 11-12, 2026 and is over; current date 2026-04-22).
--
-- Templates touched:
--   id ...001 (Animation Y'all post-show) — gets event-specific hint
--   id ...002 (Trade Show Generic)        — gets generic post-show hint
--   id ...003 (Cold Outreach)             — unchanged (no event reference)

UPDATE tenants
SET preferences = jsonb_set(
  preferences,
  '{email_templates}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN tpl->>'id' = '9b10001a-0000-4000-8000-000000000001' THEN
          tpl || jsonb_build_object(
            'opener_context_hint',
              'POST-SHOW FOLLOW-UP. The Animation Y''all event at Lipscomb University ' ||
              'happened on April 11-12, 2026 and is OVER. Today is post-show. Write the ' ||
              'opener in past or present tense — never imply the event is upcoming. ' ||
              'FORBIDDEN phrasings: "before the event", "before Animation Y''all", ' ||
              '"ahead of the show", "looking forward to seeing you", "when you visit", ' ||
              '"at the upcoming". The recipient either attended the booth or did not — ' ||
              'either way, do not speculate about future attendance. Reference their ' ||
              'company, role, or industry context to justify the outreach instead.'
          )
        WHEN tpl->>'id' = '9b10001a-0000-4000-8000-000000000002' THEN
          tpl || jsonb_build_object(
            'opener_context_hint',
              'POST-SHOW FOLLOW-UP for the trade show named in {{campaign_name}}. ' ||
              'Treat the event as already concluded. Past or present tense only. ' ||
              'FORBIDDEN phrasings: "before the event", "ahead of the show", "looking ' ||
              'forward to seeing you", "when you visit", "at the upcoming". Reference ' ||
              'the recipient''s company or role context to justify the outreach.'
          )
        ELSE tpl
      END
    )
    FROM jsonb_array_elements(preferences->'email_templates') AS tpl
  )
)
WHERE slug = 'ben-damprisi-sunnax'
  AND preferences ? 'email_templates';

-- Verification:
--   SELECT t->>'name' AS template, t ? 'opener_context_hint' AS has_hint
--   FROM tenants, jsonb_array_elements(preferences->'email_templates') AS t
--   WHERE slug = 'ben-damprisi-sunnax';
-- Expected:
--   Animation Y'all TN 2026 — Post-Show Follow-up | true
--   Trade Show Generic Follow-up                  | true
--   Cold Outreach — No Prior Meeting              | false
