# PlexifyAI — Lessons Learned

Append-only log. New lessons land at the bottom with the next L-number.

## Sprint E — Lessons L30–L36

### L30 — Hybrid Runtime Rule

If a human is waiting → inline Messages API. If nobody is waiting → Managed Agent session. `buildUserContext()` stays in Express always.

The Sprint E architecture wedge is exactly this split. Synchronous user turns (Ask Plexi, Strategy skills, Factual Auditor pre-export) call the Messages API directly so latency is bounded. Long-horizon work (Pipeline Analyst rescore, Research Scanner web crawl, War Room Prep doc discovery) runs as Managed Agents sessions so the user can close the tab and the session keeps going. The shared spine is `buildUserContext()` in `server/lib/user-context.js` — every code path that talks to Claude prepends it. Never move the context builder into the agent runtime; that breaks the swap-ready vendor hedge and makes context updates require an agent re-deploy.

### L31 — Managed Agents Cost Caps Enforced In-Worker

Config-level caps insufficient. Must check usage after every tool call and self-terminate.

Research Scanner's $15/tenant/month is enforced in three places:
1. `assertWithinCap(tenantId)` runs in `startJob`'s preflight — refuses to even queue if month-to-date >= $15
2. Per-scan ceiling = `min($0.50, remainingMonthBudget)` passed into the agent prompt as `budget_cents`
3. In-flight: every Nth `agent.tool_use` event, the worker re-queries `tenant_usage` and archives the session early if approaching the cap

The first two are necessary but not sufficient. Without (3), a runaway agent can exhaust the per-month budget in a single session because the cost only materializes at session-end usage rollup. (3) catches the runaway by interrupting before the next expensive tool call. Same pattern applies to any future cost-capped worker.

### L32 — Factual Auditor Without Domain Rules Is Theater

Generic past-project matching is necessary but insufficient. BID/OZ fact types (tract verification, deadline drift, boundaries, capital plan refs) are what makes the gate credible.

Horizontal AI vendors ship "we check facts" as a single feature. Vertical AI vendors ship a domain-specific rule pack:
- `OZ_TRACT_VERIFY` — pre-resolves the tract via `isOzDesignated()` so the model can't fabricate IRS designation
- `OZ_DEADLINE_DRIFT` — flags `§1400Z-2(a)(1)(A)` 180-day language without an anchor date
- `BID_BOUNDARY` — requires verified address evidence for "in the X BID" claims
- `CAPITAL_PLAN_REF` — must match an uploaded source excerpt; otherwise block

That's the moat. A buyer asking "but how do I know it won't fabricate a past project reference in my SOQ?" gets a concrete answer: `PAST_PROJECT_VERIFY` runs every export, hits `past_performance` (their data), and blocks with cited evidence. Compliance Guard's jurisdictional rule pack (FAR, MWBE, QBS) is the same pattern stratified by procurement context.

### L33 — Gate Overrides Must Be Auditable

Gates that can't be bypassed get disabled under pressure. But every override writes `user_id`, `artifact_id`, `gate_kind`, `original_findings`, `reason`, and `created_at` to `gate_overrides`.

Two values from the audit log:
1. **Compliance trail.** When a SOQ gets challenged 18 months later, the override row tells the story: "Principal X overrode the Factual Auditor on 2026-04-18 with reason 'past project verified manually with client; reference letter attached.' Audit ID: ..." — defensible.
2. **Eval signal.** A high override rate on a specific rule means the rule is too strict. Auto-flag rules with override_rate > 30% per quarter for prompt revision. Auditor improves over time without manual eval reading.

UX rule: never let an override be silent. The reason field is required (≥10 chars enforced server-side), the audit row is immutable, and the export goes through with a `gate_overrides` audit trail attached.

### L34 — All PowerShell Scripts from Claude Chat to Ken Must Be Pure ASCII

PS 5.1 reads `.ps1` as Windows-1252 absent UTF-8 BOM. Em-dashes break parsing. ASCII-only is the reliable contract across Claude Chat → Claude Desktop → PowerShell.

Bit me three times in Sprint E doc-handoffs. Defensive rule: when emitting PowerShell snippets in chat, use only ASCII characters. Replace em-dashes with ` -- `, smart quotes with straight quotes, ellipsis with `...`. Saves a "why doesn't this run" round-trip every time.

### L35 — One Automation Per Pilot in First 30 Days

"Sell outcomes, not tools" is the right strategy, but compounding comes AFTER measurable ROI on a single automation, not alongside a second one.

No pilot gets more than one PlexiCoS automation in the first 30 days. Shipping two parallel automations before one proves ROI optimizes for flash over outcomes and makes pilot attribution impossible. Rule applies to Ben (SunnAx), Mel (Hexagon/Multivista), Republic Events, and every future pilot. Pick the one automation that maps tightest to their stated revenue goal — Pipeline Analyst for Mel, Research Scanner for Ben, War Room Prep for Republic Events — and ship only that for the first 30 days. The other two automations are visible (Strategy skills surface in their Deal Rooms) but not pushed as their primary success metric.

Compounding is earned, not default.

### L36 — Vite loadEnv Inconsistency Across Platforms

Vite's `loadEnv` populates `VITE_`-prefixed vars reliably; non-prefixed vars are inconsistent across platforms. Always read both forms with `VITE_` fallback and trim trailing `\r` from CRLF-encoded `.env` values.

Cost real time twice in Sprint E. The LLM Gateway already handled this for `ANTHROPIC_API_KEY` (`process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY`); E4's agent-seed and Managed Agents runtime both initially read the bare form only and silently failed with "key not set" despite the env file containing it. Fix pattern, now in three places:

```js
const key = (process.env.FOO || process.env.VITE_FOO || '').replace(/[\r\n]+$/, '').trim();
```

Sprint F should consolidate to a single `server/lib/env.mjs` `getEnv(name)` helper so this rule is enforced by structure, not by every reader remembering it.
