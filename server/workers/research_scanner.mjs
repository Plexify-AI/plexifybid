/**
 * Worker: research_scanner (Sprint E / E4)
 *
 * Cost cap = $15.00 per tenant per month, enforced in THREE places (L31):
 *   1. Pre-check in canRun() / runResearchScanner() — refuse new scans if cap reached.
 *   2. Per-scan budget = min(50 cents, remaining month budget) — passed to agent.
 *   3. In-flight: after every agent.tool_use event we recheck month-to-date
 *      and archive the session early if approaching cap.
 *
 * web_search graceful degradation: if the tool isn't configured or returns
 * "not available", worker writes a home_feed_cards system_notice and
 * returns { known: false, reason: '...' } instead of fabricating results.
 */

import { getSupabase } from '../lib/supabase.js';
import {
  runManagedAgent,
  createSession,
  sendUserMessage,
  streamEvents,
  archiveSession,
} from '../runtimes/managed_agents.mjs';
import { getAgentIdByKey } from '../agents/seed.mjs';
import { logUsage } from '../middleware/logUsage.mjs';

const MONTHLY_CAP_CENTS = 1500;           // $15.00
const PER_SCAN_CEILING_CENTS = 50;        // $0.50 / scan
const WARN_REMAINING_CENTS = 300;         // warn when <$3 left
const IN_FLIGHT_POLL_AFTER_TOOLS = 2;     // check cost after every N tool uses

// ---------------------------------------------------------------------------
// Month-to-date spend query
// ---------------------------------------------------------------------------

export async function getMonthlyScannerSpend(tenantId) {
  const start = monthStartIso();
  const { data, error } = await getSupabase()
    .from('tenant_usage')
    .select('cost_cents')
    .eq('tenant_id', tenantId)
    .eq('worker_kind', 'research_scanner')
    .gte('created_at', start);
  if (error) throw error;
  return (data || []).reduce((s, r) => s + (r.cost_cents || 0), 0);
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// ---------------------------------------------------------------------------
// CAP ENFORCEMENT #1 — pre-check called by startJob
// ---------------------------------------------------------------------------

export async function assertWithinCap(tenantId) {
  const spent = await getMonthlyScannerSpend(tenantId);
  if (spent >= MONTHLY_CAP_CENTS) {
    const err = new Error(`Research Scanner monthly cap reached ($${(MONTHLY_CAP_CENTS / 100).toFixed(2)}). Contact admin.`);
    err.status = 429;
    throw err;
  }
  return { spent, remaining: MONTHLY_CAP_CENTS - spent };
}

// ---------------------------------------------------------------------------
// Main worker
// ---------------------------------------------------------------------------

export async function runResearchScanner({ tenantId, userId, query, maxSearches = 5, context, dealRoomId = null }) {
  if (!query || typeof query !== 'string') throw new Error('runResearchScanner: query required');

  // Pre-check
  const { spent, remaining } = await assertWithinCap(tenantId);

  // CAP ENFORCEMENT #2 — per-scan ceiling
  const scanBudgetCents = Math.min(PER_SCAN_CEILING_CENTS, remaining);

  const agent = await getAgentIdByKey('research_scanner');
  if (!agent) throw new Error('research_scanner agent not synced yet');
  const envId = agent.metadata?.environment_id;
  if (!envId) throw new Error('research_scanner environment_id missing');

  const payload = {
    tenant_id: tenantId,
    query,
    context: context || null,
    max_searches: Math.min(maxSearches, 8),
    budget_cents: scanBudgetCents,
  };

  // Open stream before sending input — mirrors runManagedAgent but with
  // CAP ENFORCEMENT #3 in-flight tracking.
  const session = await createSession({ agentId: agent.agent_id, environmentId: envId });
  const supabase = getSupabase();

  const agentMessages = [];
  let toolUseCount = 0;
  let capHit = false;
  let webSearchUnavailable = false;

  const stream = await streamEvents(
    session.id,
    {
      onAgentMessage: (e) => agentMessages.push(e),
      onToolUse: async (e) => {
        toolUseCount++;
        // Detect "web_search unavailable" variants graciously.
        const asStr = JSON.stringify(e || {});
        if (/web_search.*(unavailable|not.*enabled|not.*allowed|forbidden)/i.test(asStr)) {
          webSearchUnavailable = true;
          try { await archiveSession(session.id); } catch {}
          return;
        }
        // Re-check usage after every N tool calls.
        if (toolUseCount % IN_FLIGHT_POLL_AFTER_TOOLS === 0) {
          const now = await getMonthlyScannerSpend(tenantId);
          if (now >= MONTHLY_CAP_CENTS - 25) {
            capHit = true;
            try { await archiveSession(session.id); } catch {}
          }
        }
      },
      onError: (err) => {
        if (/web_search/i.test(err?.message || '')) webSearchUnavailable = true;
      },
    },
    { timeoutMs: 8 * 60 * 1000 }
  );

  await sendUserMessage(session.id, JSON.stringify(payload));
  try { await stream.done; } catch (err) {
    if (/web_search/i.test(err?.message || '')) webSearchUnavailable = true;
  }

  // web_search unavailable — write system_notice, fail gracefully.
  if (webSearchUnavailable) {
    await supabase.from('home_feed_cards').insert({
      tenant_id: tenantId,
      user_id: userId,
      kind: 'system_notice',
      title: 'Research Scanner needs web_search tool access',
      body: 'The Research Scanner relies on Claude\'s built-in web_search tool. It appears to be unavailable on this account. Contact admin.',
    });
    return {
      sessionId: session.id,
      known: false,
      reason: 'web_search-unavailable',
    };
  }

  const memo = extractAgentJson(agentMessages);

  // Always write a research_notes row — scan results persist regardless of
  // origin (Home-initiated scans don't have a deal_room_id).
  const { data: noteRow } = await supabase
    .from('research_notes')
    .insert({
      tenant_id: tenantId,
      query,
      content: memo ? JSON.stringify(memo) : '',
      citations: memo?.findings || [],
      tokens_used: 0,
    })
    .select()
    .single();

  const costCents = estimateCostCents((await fetchSessionUsage(session.id)) || null);

  // When the scan was initiated from a Deal Room, also persist a scan_memo
  // artifact anchored to that room so it appears in the Generated Artifacts
  // panel alongside Deal Summary / Competitive Analysis / etc.
  let artifactId = null;
  if (dealRoomId && memo) {
    const title = memo?.summary
      ? `Market Scan — ${String(memo.summary).slice(0, 80)}`
      : `Market Scan — ${String(query).slice(0, 80)}`;
    const { data: artRow, error: artErr } = await supabase
      .from('deal_room_artifacts')
      .insert({
        tenant_id: tenantId,
        deal_room_id: dealRoomId,
        user_id: userId,
        artifact_type: 'scan_memo',
        title,
        status: 'ready',
        content: { query, ...memo },
        model_used: 'claude-sonnet-4-5',
        skill_version: '1',
        token_count_in: 0,
        token_count_out: 0,
        provenance_json: memo?.findings || [],
      })
      .select()
      .single();
    if (artErr) console.error('[research_scanner] artifact insert failed:', artErr.message);
    else artifactId = artRow?.id || null;
  }

  logUsage({
    tenantId,
    userId,
    kind: 'worker_run',
    workerKind: 'research_scanner',
    costCents,
  });

  return {
    sessionId: session.id,
    capHit,
    memo,
    costCents,
    artifactId,
    noteId: noteRow?.id || null,
    cap: { spent_before: spent, spent_now: spent + costCents, cap_cents: MONTHLY_CAP_CENTS },
  };
}

async function fetchSessionUsage(sessionId) {
  try {
    const { retrieveSession } = await import('../runtimes/managed_agents.mjs');
    const s = await retrieveSession(sessionId);
    return s?.usage || null;
  } catch {
    return null;
  }
}

function extractAgentJson(messages) {
  for (const m of messages || []) {
    for (const block of m.content || []) {
      if (block?.type !== 'text') continue;
      const text = String(block.text || '').trim();
      const s = text.indexOf('{');
      const e = text.lastIndexOf('}');
      if (s === -1 || e === -1 || e <= s) continue;
      try {
        return JSON.parse(text.slice(s, e + 1));
      } catch {}
    }
  }
  return null;
}

function estimateCostCents(usage) {
  if (!usage) return 0;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  // Web search is billed separately; rough overhead of 2c per run when used.
  return Math.round((inTok / 1_000_000) * 300 + (outTok / 1_000_000) * 1500);
}
