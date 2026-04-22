-- Sprint BATCH-50 follow-up — restructure Animation Y'all post-show template.
--
-- Two changes to template id 9b10001a-0000-4000-8000-000000000001 only:
--
-- 1. Move {{personalized_opener}} to AFTER the show-specials line, paired
--    with the static "Let's talk..." sentence so they read as one paragraph
--    that flows from the recipient-specific hook into the universal CTA.
--
-- 2. Wire the blog title as a real <a href> in body_html so Outlook renders
--    it as a clickable hyperlink. Body_markdown gets standard markdown
--    link syntax. body_html is what gets sent (preserved through TipTap
--    edit + wrapEmailHtml).
--
-- Templates id ...0002 (Trade Show Generic) and id ...0003 (Cold Outreach)
-- are not modified.
--
-- Idempotent: repeated runs replace the same template id with the same
-- canonical content; safe to re-apply.

UPDATE tenants
SET preferences = jsonb_set(
  preferences,
  '{email_templates}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN tpl->>'id' = '9b10001a-0000-4000-8000-000000000001' THEN
          jsonb_build_object(
            'id', '9b10001a-0000-4000-8000-000000000001',
            'name', 'Animation Y''all TN 2026 — Post-Show Follow-up',
            'subject', 'Great meeting at Animation Y''all, {{first_name}}',
            'body_markdown',
              E'Hi {{first_name}},\n\n' ||
              E'Ben from SunnAx here.\n\n' ||
              E'Thanks for stopping by the Xencelabs booth at Animation Y''all at Lipscomb. I wrote a little blog post on my website summarizing the great event:\n' ||
              E'[Animation Y''all 2026 — Nashville, We''ll Be Back! | SunnAx Blog](https://sunnax.net/blog/animation-yall-2026)\n' ||
              E'The show specials are good until April 30th. That will be the best pricing of the year!\n\n' ||
              E'{{personalized_opener}} Let''s talk about how we can get you creating with a beautiful draw-on-the-screen Pen Display.\n\n' ||
              E'Cheers,\n' ||
              E'ben~\n' ||
              E'PROUD XENCELABS PARTNER',
            'body_html',
              '<p>Hi {{first_name}},</p>' ||
              '<p>Ben from SunnAx here.</p>' ||
              '<p>Thanks for stopping by the Xencelabs booth at Animation Y''all at Lipscomb. I wrote a little blog post on my website summarizing the great event:</p>' ||
              '<p><a href="https://sunnax.net/blog/animation-yall-2026" rel="noopener noreferrer">Animation Y''all 2026 — Nashville, We''ll Be Back! | SunnAx Blog</a></p>' ||
              '<p>The show specials are good until April 30th. That will be the best pricing of the year!</p>' ||
              '<p>{{personalized_opener}} Let''s talk about how we can get you creating with a beautiful draw-on-the-screen Pen Display.</p>' ||
              '<p>Cheers,<br/>ben~<br/>PROUD XENCELABS PARTNER</p>',
            'merge_fields', jsonb_build_array('first_name'),
            'generated_fields', jsonb_build_array('personalized_opener'),
            'created_at', '2026-04-22T00:00:00Z'
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
--   SELECT jsonb_array_length(preferences->'email_templates') AS count,
--          (preferences->'email_templates'->0->'body_html') ILIKE '%sunnax.net/blog/animation-yall-2026%' AS has_link
--   FROM tenants WHERE slug = 'ben-damprisi-sunnax';
-- Expected: count=3, has_link=true
