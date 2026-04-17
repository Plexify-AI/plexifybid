/**
 * PlexifySOLO — Skill seeder (Sprint E / E2)
 *
 * On server startup, reads every definition file and UPSERTs into
 * deal_room_skills keyed on (tenant_id, skill_key, version). Code is the
 * source of truth; the DB row is the runtime cache so queries from any
 * route can load a skill without filesystem access.
 *
 * Fire-and-forget: a seed failure must not block server startup. Any row
 * that fails to UPSERT is logged and skipped.
 */

import { getSupabase } from '../lib/supabase.js';
import { definition as pursuitGoNoGo } from './definitions/pursuit_go_no_go.mjs';
import { definition as feeStrategyArchitect } from './definitions/fee_strategy_architect.mjs';
import { definition as competitorTeardown } from './definitions/competitor_teardown.mjs';
import { definition as acquisitionPlaybook } from './definitions/acquisition_playbook.mjs';
import { definition as growthPlanGenerator } from './definitions/growth_plan_generator.mjs';
import { definition as bidOzOpportunityBrief } from './definitions/bid_oz_opportunity_brief.mjs';
import { definition as stakeholderEntryMap } from './definitions/stakeholder_entry_map.mjs';

const DEFINITIONS = [
  pursuitGoNoGo,
  feeStrategyArchitect,
  competitorTeardown,
  acquisitionPlaybook,
  growthPlanGenerator,
  bidOzOpportunityBrief,
  stakeholderEntryMap,
];

export async function seedSkills() {
  const supabase = getSupabase();
  let upserted = 0;
  let failed = 0;

  for (const def of DEFINITIONS) {
    try {
      // UNIQUE(tenant_id, skill_key) — tenant_id NULL gets multi-NULL behavior
      // in Postgres, so we need a manual upsert: delete-if-match then insert.
      // Safer: check-then-update OR insert.
      const { data: existing } = await supabase
        .from('deal_room_skills')
        .select('id, version')
        .is('tenant_id', null)
        .eq('skill_key', def.skill_key)
        .maybeSingle();

      const row = {
        tenant_id: null,
        skill_key: def.skill_key,
        skill_name: def.skill_name,
        system_prompt: def.system_prompt,
        output_schema: def.output_schema,
        input_schema: def.input_schema || {},
        version: def.version,
        eval_path: def.eval_path || null,
        revenue_loop_stage: def.revenue_loop_stage,
        is_active: def.is_active !== false,
      };

      if (existing) {
        const { error } = await supabase
          .from('deal_room_skills')
          .update(row)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deal_room_skills')
          .insert(row);
        if (error) throw error;
      }
      upserted++;
    } catch (err) {
      failed++;
      console.error(`[skill-seed] ${def.skill_key} failed:`, err.message);
    }
  }

  console.log(`[skill-seed] upserted ${upserted}/${DEFINITIONS.length} global skills${failed ? ` (${failed} failed)` : ''}`);
}
