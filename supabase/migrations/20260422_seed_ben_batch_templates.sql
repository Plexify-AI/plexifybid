-- Sprint BATCH-50 Task 2 — seed batch email templates for Ben (SunnAx).
--
-- Keyed to slug = 'ben-damprisi-sunnax' so it is durable across env UUID
-- variation. Only affects Ben's tenant; idempotent (sets the canonical
-- email_templates array on every run; safe to re-apply).
--
-- Convention:
--   {{first_name}}, {{company}}, {{campaign_name}} substitute instantly
--     from the opportunity record at preview time.
--   {{personalized_opener}} resolves per-recipient via Anthropic Messages
--     API call in Ben's voice (see Task 3 — opener generation).
--
-- Body styling: HTML signature block (preferences.email_signature) is
-- appended automatically at send time. Templates carry the textual sign-off
-- ("Cheers, ben~ PROUD XENCELABS PARTNER") because that is part of Ben's
-- voice, not the corporate signature block.

UPDATE tenants
SET preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object(
  'email_templates', jsonb_build_array(
    -- ---------------------------------------------------------------------
    -- Template 1 — Animation Y'all TN 2026 — Post-Show Follow-up
    -- ---------------------------------------------------------------------
    jsonb_build_object(
      'id', '9b10001a-0000-4000-8000-000000000001',
      'name', 'Animation Y''all TN 2026 — Post-Show Follow-up',
      'subject', 'Great meeting at Animation Y''all, {{first_name}}',
      'body_markdown',
        E'Hi {{first_name}},\n\n' ||
        E'{{personalized_opener}}\n\n' ||
        E'Ben from SunnAx here. Thanks for stopping by the Xencelabs booth at Animation Y''all at Lipscomb.\n\n' ||
        E'I wrote a little blog post on my website summarizing the great event:\n\n' ||
        E'Animation Y''all 2026 — Nashville, We''ll Be Back! | SunnAx Blog\n\n' ||
        E'The show specials are good until April 30th. That will be the best pricing of the year!\n\n' ||
        E'Let''s talk about how we can get you creating with a beautiful draw-on-the-screen Pen Display.\n\n' ||
        E'Cheers,\n' ||
        E'ben~\n' ||
        E'PROUD XENCELABS PARTNER',
      'body_html',
        '<p>Hi {{first_name}},</p>' ||
        '<p>{{personalized_opener}}</p>' ||
        '<p>Ben from SunnAx here. Thanks for stopping by the Xencelabs booth at Animation Y''all at Lipscomb.</p>' ||
        '<p>I wrote a little blog post on my website summarizing the great event:</p>' ||
        '<p>Animation Y''all 2026 — Nashville, We''ll Be Back! | SunnAx Blog</p>' ||
        '<p>The show specials are good until April 30th. That will be the best pricing of the year!</p>' ||
        '<p>Let''s talk about how we can get you creating with a beautiful draw-on-the-screen Pen Display.</p>' ||
        '<p>Cheers,<br/>ben~<br/>PROUD XENCELABS PARTNER</p>',
      'merge_fields', jsonb_build_array('first_name'),
      'generated_fields', jsonb_build_array('personalized_opener'),
      'created_at', '2026-04-22T00:00:00Z'
    ),

    -- ---------------------------------------------------------------------
    -- Template 2 — Trade Show Generic Follow-up
    -- ---------------------------------------------------------------------
    jsonb_build_object(
      'id', '9b10001a-0000-4000-8000-000000000002',
      'name', 'Trade Show Generic Follow-up',
      'subject', 'Following up from {{campaign_name}}, {{first_name}}',
      'body_markdown',
        E'Hi {{first_name}},\n\n' ||
        E'{{personalized_opener}}\n\n' ||
        E'Ben from SunnAx here. Thanks for stopping by the Xencelabs booth at {{campaign_name}}.\n\n' ||
        E'The show specials are good until April 30th. That will be the best pricing of the year!\n\n' ||
        E'Let''s talk about how we can get you creating with a beautiful draw-on-the-screen Pen Display.\n\n' ||
        E'Cheers,\n' ||
        E'ben~\n' ||
        E'PROUD XENCELABS PARTNER',
      'body_html',
        '<p>Hi {{first_name}},</p>' ||
        '<p>{{personalized_opener}}</p>' ||
        '<p>Ben from SunnAx here. Thanks for stopping by the Xencelabs booth at {{campaign_name}}.</p>' ||
        '<p>The show specials are good until April 30th. That will be the best pricing of the year!</p>' ||
        '<p>Let''s talk about how we can get you creating with a beautiful draw-on-the-screen Pen Display.</p>' ||
        '<p>Cheers,<br/>ben~<br/>PROUD XENCELABS PARTNER</p>',
      'merge_fields', jsonb_build_array('first_name', 'campaign_name'),
      'generated_fields', jsonb_build_array('personalized_opener'),
      'created_at', '2026-04-22T00:00:00Z'
    ),

    -- ---------------------------------------------------------------------
    -- Template 3 — Cold Outreach / No Prior Meeting
    -- ---------------------------------------------------------------------
    jsonb_build_object(
      'id', '9b10001a-0000-4000-8000-000000000003',
      'name', 'Cold Outreach — No Prior Meeting',
      'subject', 'Quick intro from SunnAx, {{first_name}}',
      'body_markdown',
        E'Hi {{first_name}},\n\n' ||
        E'{{personalized_opener}}\n\n' ||
        E'Ben from SunnAx here. We''re the Xencelabs partner helping creative teams move off Wacom to a beautiful draw-on-the-screen Pen Display — same pen feel, sharper screen, better price.\n\n' ||
        E'Worth a 15-minute look? Happy to send over a demo unit or get on a quick call to walk through the lineup.\n\n' ||
        E'Cheers,\n' ||
        E'ben~\n' ||
        E'PROUD XENCELABS PARTNER',
      'body_html',
        '<p>Hi {{first_name}},</p>' ||
        '<p>{{personalized_opener}}</p>' ||
        '<p>Ben from SunnAx here. We''re the Xencelabs partner helping creative teams move off Wacom to a beautiful draw-on-the-screen Pen Display — same pen feel, sharper screen, better price.</p>' ||
        '<p>Worth a 15-minute look? Happy to send over a demo unit or get on a quick call to walk through the lineup.</p>' ||
        '<p>Cheers,<br/>ben~<br/>PROUD XENCELABS PARTNER</p>',
      'merge_fields', jsonb_build_array('first_name'),
      'generated_fields', jsonb_build_array('personalized_opener'),
      'created_at', '2026-04-22T00:00:00Z'
    )
  )
)
WHERE slug = 'ben-damprisi-sunnax';

-- Verification query (run manually after migration):
--   SELECT slug, jsonb_array_length(preferences->'email_templates') AS template_count
--   FROM tenants WHERE slug = 'ben-damprisi-sunnax';
-- Expected: template_count = 3
