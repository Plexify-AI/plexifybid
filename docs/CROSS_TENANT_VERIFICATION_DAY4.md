# Cross-Tenant Verification Matrix — Day 4 Sprint
Date: 2026-04-06

## API-Level Checks (Automated via curl)

| Endpoint | Ken's SOLO | Mel's Hexagon |
|----------|-----------|---------------|
| Auth validate | PASS (200, "Ken D'Amato") | PASS (200, "Mel Wallace") |
| GET /api/opportunities | PASS (200) | PASS (200) |
| GET /api/deal-rooms | PASS (200) | PASS (200) |
| POST /api/ask-plexi/chat | PASS (200) | PASS (200) |
| GET /api/deal-rooms/:id/artifacts | PASS (200) | N/A |
| POST /api/batch-email/generate (empty) | PASS (400 — correct validation) | N/A |
| POST /api/export/docx | PASS (200) | N/A |
| POST /api/export/pptx | PASS (200) | N/A |
| GET /api/powerflow/today | N/A | PASS (200) |
| GET /api/pipeline-summary | N/A | PASS (200) |

## Browser-Level Checks

| Feature | Ken's SOLO | Mel's Hexagon |
|---------|-----------|---------------|
| Home loads, prospects visible | PASS | NEEDS TEST |
| Opportunity cards ranked by warmth | PASS | NEEDS TEST |
| Ask Plexi — question answering | PASS | NEEDS TEST |
| Ask Plexi — email generation | PASS (batch) | NEEDS TEST |
| Ask Plexi — persona (speaks as user) | PASS (prior sprint) | NEEDS TEST |
| Ask Plexi — chat persistence after nav | PASS (prior sprint) | NEEDS TEST |
| Deal Room — sources show Ready badges | PASS (WSP) | NEEDS TEST |
| Deal Room — Board Brief generates | PASS (WSP) | NEEDS TEST |
| Deal Room — Competitive Analysis | PASS (WSP) | NEEDS TEST |
| Deal Room — Meeting Prep generates | PASS (WSP) | NEEDS TEST |
| Deal Room — Deal Summary generates | PASS (WSP) | NEEDS TEST |
| Deal Room — OZRF Section generates | PASS (WSP) | NEEDS TEST |
| Deal Room — Infographic generates | PASS (WSP) | NEEDS TEST |
| Deal Room — Board Deck (PPTX) generates | PASS (downloaded, opened in PPT) | NEEDS TEST |
| Deal Room — Copy to Editor works | PASS | NEEDS TEST |
| Deal Room — TipTap toolbar visible | PASS | NEEDS TEST |
| Deal Room — Export DOCX downloads | PASS | NEEDS TEST |
| Deal Room — Export PPTX downloads | PASS | NEEDS TEST |
| Agent chips visible (sticky) | PASS (both rooms) | NEEDS TEST |
| Batch email — select/draft/review flow | PASS (3 emails generated) | NEEDS TEST |
| Save email as draft to Gmail | NOT TESTED (no emails in Ken tenant) | NEEDS TEST |
| Voice DNA reflected in content | PASS (WSP deck + batch emails) | NEEDS TEST |
| No "Chat" tab in editor panel | PASS | NEEDS TEST |
| No banned words in generated content | PASS (WSP deck verified) | NEEDS TEST |
| Text fully readable (no fading) | PASS | NEEDS TEST |

## Summary
- Ken's SOLO: All tested features PASS. 0 failures detected.
- Mel's Hexagon: API endpoints PASS. Browser features pending manual verification.

## Mel's Sandbox URL
```
http://localhost:3000/sandbox?token=pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084
```
