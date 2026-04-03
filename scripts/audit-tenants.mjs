/**
 * Cross-Tenant Functionality Audit
 * Reads .env.local and queries Supabase for parity matrix data.
 * Usage: node scripts/audit-tenants.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && !line.startsWith('#')) {
    env[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('\n========================================');
  console.log('  CROSS-TENANT FUNCTIONALITY AUDIT');
  console.log('  ' + new Date().toISOString());
  console.log('========================================\n');

  // 1. All tenants
  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, name, company, sandbox_token, persona_code, timezone, vocab_skin, system_prompt_override, powerflow_quick_start, storefront_enabled, dev_mode')
    .order('name');
  if (tErr) { console.error('tenants error:', tErr); return; }

  // 2. Tab config per tenant
  const { data: tabConfig } = await supabase
    .from('tenant_tab_config')
    .select('tenant_id, skill_key, tab_label, sort_order, is_visible')
    .order('sort_order');

  // 3. Skills
  const { data: skills } = await supabase
    .from('deal_room_skills')
    .select('id, tenant_id, skill_key, skill_name, is_active');

  // 4. Deal rooms
  const { data: dealRooms } = await supabase
    .from('deal_rooms')
    .select('id, tenant_id, name, status, created_at');

  // 5. Deal room sources
  const { data: sources } = await supabase
    .from('deal_room_sources')
    .select('id, deal_room_id, file_name, chunks');

  // 6. Deal room artifacts
  const { data: artifacts } = await supabase
    .from('deal_room_artifacts')
    .select('id, deal_room_id, artifact_type, status, created_at');

  // 7. Opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('id, tenant_id, account_name, stage');

  // 8. Old connections table
  const { data: connections, error: connErr } = await supabase
    .from('connections')
    .select('id, tenant_id');

  // 9. LinkedIn import jobs
  const { data: linkedinJobs } = await supabase
    .from('linkedin_import_jobs')
    .select('id, tenant_id, status, contact_count');

  // 10. Voice DNA profiles
  const { data: voiceProfiles } = await supabase
    .from('voice_dna_profiles')
    .select('id, tenant_id, profile_name, status, confidence_score');

  // 11. Old prospects table (from Session 2)
  const { data: oldProspects, error: pErr } = await supabase
    .from('prospects')
    .select('id, tenant_id');

  // Build lookup maps
  const tabsByTenant = {};
  (tabConfig || []).forEach(t => {
    if (!tabsByTenant[t.tenant_id]) tabsByTenant[t.tenant_id] = [];
    tabsByTenant[t.tenant_id].push(t);
  });

  const globalSkills = (skills || []).filter(s => !s.tenant_id);
  const tenantSkills = {};
  (skills || []).filter(s => s.tenant_id).forEach(s => {
    if (!tenantSkills[s.tenant_id]) tenantSkills[s.tenant_id] = [];
    tenantSkills[s.tenant_id].push(s);
  });

  const roomsByTenant = {};
  (dealRooms || []).forEach(r => {
    if (!roomsByTenant[r.tenant_id]) roomsByTenant[r.tenant_id] = [];
    roomsByTenant[r.tenant_id].push(r);
  });

  const sourcesByRoom = {};
  (sources || []).forEach(s => {
    if (!sourcesByRoom[s.deal_room_id]) sourcesByRoom[s.deal_room_id] = [];
    sourcesByRoom[s.deal_room_id].push(s);
  });

  const artifactsByRoom = {};
  (artifacts || []).forEach(a => {
    if (!artifactsByRoom[a.deal_room_id]) artifactsByRoom[a.deal_room_id] = [];
    artifactsByRoom[a.deal_room_id].push(a);
  });

  const oppsByTenant = {};
  (opportunities || []).forEach(o => {
    if (!oppsByTenant[o.tenant_id]) oppsByTenant[o.tenant_id] = [];
    oppsByTenant[o.tenant_id].push(o);
  });

  const connsByTenant = {};
  (connections || []).forEach(c => {
    if (!connsByTenant[c.tenant_id]) connsByTenant[c.tenant_id] = [];
    connsByTenant[c.tenant_id].push(c);
  });

  const linkedinByTenant = {};
  (linkedinJobs || []).forEach(j => {
    if (!linkedinByTenant[j.tenant_id]) linkedinByTenant[j.tenant_id] = [];
    linkedinByTenant[j.tenant_id].push(j);
  });

  const voiceByTenant = {};
  (voiceProfiles || []).forEach(v => {
    if (!voiceByTenant[v.tenant_id]) voiceByTenant[v.tenant_id] = [];
    voiceByTenant[v.tenant_id].push(v);
  });

  const oldProspectsByTenant = {};
  (oldProspects || []).forEach(p => {
    if (!oldProspectsByTenant[p.tenant_id]) oldProspectsByTenant[p.tenant_id] = [];
    oldProspectsByTenant[p.tenant_id].push(p);
  });

  // ─── TABLE 1: Tenant Parity Matrix ───
  console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                        TABLE 1: TENANT PARITY MATRIX                                                                  │');
  console.log('├────────────────────────┬──────────┬──────────┬───────────┬─────────┬───────────┬───────────┬──────────┬───────────┬──────────┬──────────┤');
  console.log('│ Tenant                 │ Tabs Cfg │ Skills   │ Deal Rooms│ Sources │ Artifacts │ Opps(new) │ Prosp(v1)│ LinkedIn  │ VoiceDNA │ VocabSkin│');
  console.log('├────────────────────────┼──────────┼──────────┼───────────┼─────────┼───────────┼───────────┼──────────┼───────────┼──────────┼──────────┤');

  for (const t of tenants) {
    const tabs = tabsByTenant[t.id] || [];
    const tSkills = tenantSkills[t.id] || [];
    const rooms = roomsByTenant[t.id] || [];
    const totalSources = rooms.reduce((sum, r) => sum + (sourcesByRoom[r.id] || []).length, 0);
    const totalArtifacts = rooms.reduce((sum, r) => sum + (artifactsByRoom[r.id] || []).length, 0);
    const opps = oppsByTenant[t.id] || [];
    const oldP = oldProspectsByTenant[t.id] || [];
    const lnJobs = linkedinByTenant[t.id] || [];
    const voice = voiceByTenant[t.id] || [];
    const hasVocab = t.vocab_skin ? 'Yes' : 'No';

    const label = `${(t.name || '').substring(0, 14)} / ${(t.company || '').substring(0, 7)}`.substring(0, 22).padEnd(22);
    console.log(
      `│ ${label} │ ${String(tabs.length).padStart(5).padEnd(8)} │ ${String(globalSkills.length + tSkills.length).padStart(4).padEnd(8)} │ ${String(rooms.length).padStart(5).padEnd(9)} │ ${String(totalSources).padStart(4).padEnd(7)} │ ${String(totalArtifacts).padStart(5).padEnd(9)} │ ${String(opps.length).padStart(5).padEnd(9)} │ ${String(oldP.length).padStart(5).padEnd(8)} │ ${String(lnJobs.length).padStart(5).padEnd(9)} │ ${String(voice.length).padStart(5).padEnd(8)} │ ${hasVocab.padEnd(8)} │`
    );
  }
  console.log('└────────────────────────┴──────────┴──────────┴───────────┴─────────┴───────────┴───────────┴──────────┴───────────┴──────────┴──────────┘');

  console.log(`\nGlobal skills (tenant_id=NULL): ${globalSkills.length}`);
  globalSkills.forEach(s => console.log(`  - ${s.skill_key}: ${s.skill_name} (active: ${s.is_active})`));

  // Tenant-specific skills detail
  console.log('\nTenant-specific skills:');
  for (const t of tenants) {
    const tSkills = tenantSkills[t.id] || [];
    if (tSkills.length > 0) {
      console.log(`  ${t.name} / ${t.company}:`);
      tSkills.forEach(s => console.log(`    - ${s.skill_key}: ${s.skill_name} (active: ${s.is_active})`));
    }
  }

  // Tab config detail
  console.log('\nTab config per tenant:');
  for (const t of tenants) {
    const tabs = tabsByTenant[t.id] || [];
    if (tabs.length > 0) {
      console.log(`  ${t.name} / ${t.company}: ${tabs.map(tb => `${tb.tab_label}(${tb.skill_key})`).join(', ')}`);
    } else {
      console.log(`  ${t.name} / ${t.company}: NO TABS CONFIGURED`);
    }
  }

  // Voice DNA detail
  console.log('\nVoice DNA profiles:');
  for (const t of tenants) {
    const vps = voiceByTenant[t.id] || [];
    if (vps.length > 0) {
      vps.forEach(v => console.log(`  ${t.name}: "${v.profile_name}" status=${v.status} confidence=${v.confidence_score}`));
    }
  }

  // ─── TABLE 2: Per-Deal-Room Detail ───
  console.log('\n┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                    TABLE 2: PER-DEAL-ROOM DETAIL                                                     │');
  console.log('├────────────────────────────────┬────────────────────────┬─────────┬────────┬────────────────────────────────────────────┤');
  console.log('│ Deal Room Name                 │ Tenant                 │ Sources │ Chunks │ Artifacts Generated                        │');
  console.log('├────────────────────────────────┼────────────────────────┼─────────┼────────┼────────────────────────────────────────────┤');

  for (const t of tenants) {
    const rooms = roomsByTenant[t.id] || [];
    for (const room of rooms) {
      const roomSources = sourcesByRoom[room.id] || [];
      const roomArtifacts = artifactsByRoom[room.id] || [];
      const totalChunks = roomSources.reduce((sum, s) => {
        if (Array.isArray(s.chunks)) return sum + s.chunks.length;
        if (s.chunks && typeof s.chunks === 'object') return sum + Object.keys(s.chunks).length;
        return sum;
      }, 0);
      const artifactTypes = roomArtifacts.map(a => `${a.artifact_type}(${a.status})`).join(', ') || 'None';

      const roomName = (room.name || '').substring(0, 30).padEnd(30);
      const tenantLabel = `${(t.name || '').substring(0, 12)} / ${(t.company || '').substring(0, 8)}`.substring(0, 22).padEnd(22);

      console.log(
        `│ ${roomName} │ ${tenantLabel} │ ${String(roomSources.length).padStart(5).padEnd(7)} │ ${String(totalChunks).padStart(4).padEnd(6)} │ ${artifactTypes.substring(0, 42).padEnd(42)} │`
      );
    }
  }
  console.log('└────────────────────────────────┴────────────────────────┴─────────┴────────┴────────────────────────────────────────────┘');

  // ─── Opportunities detail ───
  console.log('\nOpportunities by tenant and stage:');
  for (const t of tenants) {
    const opps = oppsByTenant[t.id] || [];
    if (opps.length > 0) {
      const stages = {};
      opps.forEach(o => { stages[o.stage] = (stages[o.stage] || 0) + 1; });
      console.log(`  ${t.name} / ${t.company}: ${opps.length} total — ${Object.entries(stages).map(([k,v]) => `${k}:${v}`).join(', ')}`);
    }
  }

  // ─── LinkedIn import jobs detail ───
  console.log('\nLinkedIn import jobs:');
  let hasAnyLinkedin = false;
  for (const t of tenants) {
    const jobs = linkedinByTenant[t.id] || [];
    if (jobs.length > 0) {
      hasAnyLinkedin = true;
      jobs.forEach(j => console.log(`  ${t.name}: status=${j.status} contacts=${j.contact_count}`));
    }
  }
  if (!hasAnyLinkedin) console.log('  (No import jobs found for any tenant)');

  console.log('\n========================================');
  console.log('  AUDIT COMPLETE');
  console.log('========================================\n');
}

main().catch(console.error);
