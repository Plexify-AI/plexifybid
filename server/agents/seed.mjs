/**
 * PlexifySOLO — Agent seeder (Sprint E / E4)
 *
 * On server startup, sync each file-defined agent to Anthropic Managed Agents
 * (create or version-bump) and cache the returned agent_id in the local
 * `agents` table keyed on agent_key. Workers look up agent_id via agent_key.
 *
 * Fire-and-forget: seed failures log but never block startup.
 */

import { getSupabase } from '../lib/supabase.js';
import { upsertAgent, ensureEnvironment } from '../runtimes/managed_agents.mjs';
import { definition as pipelineAnalyst } from './definitions/pipeline_analyst.mjs';
import { definition as researchScanner } from './definitions/research_scanner.mjs';
import { definition as warRoomPrep } from './definitions/war_room_prep.mjs';

const DEFINITIONS = [pipelineAnalyst, researchScanner, warRoomPrep];

export async function seedAgents() {
  // Env fast-path — skip seeding entirely if no Anthropic key. Matches the
  // LLM Gateway's fallback pattern (VITE_-prefixed alt) since Vite's loadEnv
  // doesn't always reliably populate non-prefixed vars cross-platform.
  const rawKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '';
  const key = rawKey.replace(/[\r\n]+$/, '').trim();
  if (!key) {
    console.warn('[agent-seed] ANTHROPIC_API_KEY not set; skipping Managed Agents sync.');
    return;
  }
  // Re-export cleanly so managed_agents.mjs downstream sees the normalized key.
  process.env.ANTHROPIC_API_KEY = key;

  let envId;
  try {
    envId = await ensureEnvironment();
  } catch (err) {
    console.error('[agent-seed] ensureEnvironment failed:', err.message);
    return;
  }

  const supabase = getSupabase();
  let ok = 0;
  let failed = 0;

  for (const def of DEFINITIONS) {
    try {
      const { agentId, version } = await upsertAgent({
        name: def.name,
        model: def.model,
        system: def.system,
        tools: def.tools,
        mcp_servers: def.mcp_servers,
        skills: def.skills,
        description: def.description,
      });

      const { error } = await supabase
        .from('agents')
        .upsert(
          {
            agent_key: def.agent_key,
            agent_id: agentId,
            version,
            model: def.model,
            synced_at: new Date().toISOString(),
            metadata: { environment_id: envId, revenue_loop_stage: def.revenue_loop_stage },
          },
          { onConflict: 'agent_key' }
        );
      if (error) throw error;
      ok++;
    } catch (err) {
      failed++;
      console.error(`[agent-seed] ${def.agent_key} failed:`, err.message);
    }
  }

  console.log(`[agent-seed] synced ${ok}/${DEFINITIONS.length} agents${failed ? ` (${failed} failed)` : ''}`);
}

// Helper: look up cached agent_id by key.
export async function getAgentIdByKey(agentKey) {
  const { data, error } = await getSupabase()
    .from('agents')
    .select('agent_id, version, metadata')
    .eq('agent_key', agentKey)
    .maybeSingle();
  if (error) throw error;
  return data; // { agent_id, version, metadata } or null
}
