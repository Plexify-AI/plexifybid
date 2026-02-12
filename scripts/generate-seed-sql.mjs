/**
 * Generate seed.sql from the Mel demo JSON data files.
 * Run: node scripts/generate-seed-sql.mjs > supabase/seed.sql
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', 'src', 'features', 'mel-demo', 'data');

function load(file) {
  return JSON.parse(readFileSync(resolve(dataDir, file), 'utf-8'));
}

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  // Escape single quotes for SQL
  return `'${String(val).replace(/'/g, "''")}'`;
}

function jsonb(val) {
  if (val === null || val === undefined) return "'{}'::jsonb";
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
}

import { randomBytes } from 'crypto';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SANDBOX_TOKEN = `pxs_${randomBytes(24).toString('hex')}`;

const projects = load('projects.json');
const contacts = load('contacts.json');
const connections = load('connections.json');
const caseStudies = load('case-studies.json');
const icpConfig = load('icp-config.json');

const lines = [];
lines.push('-- PlexifySOLO Seed Data');
lines.push('-- Generated from src/features/mel-demo/data/ JSON files');
lines.push(`-- Tenant: Mel Wallace (Hexagon / Multivista)`);
lines.push('-- Run: npx supabase db reset  (applies migrations + seed)');
lines.push('');

// ── Tenant ────────────────────────────────────────────────────────────────────
lines.push('-- ============================================================================');
lines.push('-- TENANT');
lines.push('-- ============================================================================');
lines.push(`INSERT INTO public.tenants (id, slug, name, company, role, sandbox_token, features, expires_at) VALUES`);
lines.push(`  ('${TENANT_ID}', 'mel-wallace-hexagon', 'Mel Wallace', 'Hexagon / Multivista', 'Director of Sales', '${SANDBOX_TOKEN}', '["search_prospects","draft_outreach","analyze_pipeline"]'::jsonb, NOW() + INTERVAL '30 days');`);
lines.push('');

// ── Case Studies ──────────────────────────────────────────────────────────────
lines.push('-- ============================================================================');
lines.push('-- CASE STUDIES (10)');
lines.push('-- ============================================================================');
lines.push(`INSERT INTO public.case_studies (tenant_id, ref_id, client_name, project_name, gc, service, roi_amount, roi_display, roi_type, roi_explanation, relevant_tags) VALUES`);
caseStudies.forEach((cs, i) => {
  const comma = i < caseStudies.length - 1 ? ',' : ';';
  lines.push(`  ('${TENANT_ID}', ${esc(cs.id)}, ${esc(cs.clientName)}, ${esc(cs.projectName)}, ${esc(cs.gc)}, ${esc(cs.service)}, ${cs.roiAmount}, ${esc(cs.roiDisplay)}, ${esc(cs.roiType)}, ${esc(cs.roiExplanation)}, ${jsonb(cs.relevantTags)})${comma}`);
});
lines.push('');

// ── Contacts ──────────────────────────────────────────────────────────────────
lines.push('-- ============================================================================');
lines.push('-- CONTACTS (47)');
lines.push('-- ============================================================================');
lines.push(`INSERT INTO public.contacts (tenant_id, ref_id, name, title, company, email, phone, linkedin_connected, linkedin_degree, linkedin_mutual_name, linkedin_mutual_company, decision_maker, budget_authority, engagements) VALUES`);
contacts.forEach((c, i) => {
  const comma = i < contacts.length - 1 ? ',' : ';';
  lines.push(`  ('${TENANT_ID}', ${esc(c.id)}, ${esc(c.name)}, ${esc(c.title)}, ${esc(c.company)}, ${esc(c.email)}, ${esc(c.phone || null)}, ${esc(c.linkedInConnected)}, ${c.linkedInDegree || 'NULL'}, ${esc(c.linkedInMutualName || null)}, ${esc(c.linkedInMutualCompany || null)}, ${esc(c.decisionMaker)}, ${esc(c.budgetAuthority)}, ${jsonb(c.engagements)})${comma}`);
});
lines.push('');

// ── Connections ───────────────────────────────────────────────────────────────
lines.push('-- ============================================================================');
lines.push('-- CONNECTIONS (8)');
lines.push('-- ============================================================================');
lines.push(`INSERT INTO public.connections (tenant_id, ref_id, name, title, company, relationship_strength, deals_closed_via, close_rate_via, can_intro_to) VALUES`);
connections.forEach((cn, i) => {
  const comma = i < connections.length - 1 ? ',' : ';';
  lines.push(`  ('${TENANT_ID}', ${esc(cn.id)}, ${esc(cn.name)}, ${esc(cn.title)}, ${esc(cn.company)}, ${esc(cn.relationshipStrength)}, ${cn.dealsClosedVia}, ${cn.closeRateViaThisPerson}, ${jsonb(cn.canIntroTo)})${comma}`);
});
lines.push('');

// ── Prospects ─────────────────────────────────────────────────────────────────
lines.push('-- ============================================================================');
lines.push('-- PROSPECTS (47)');
lines.push('-- ============================================================================');
lines.push(`INSERT INTO public.prospects (tenant_id, ref_id, dodge_number, name, type, building_type_code, square_feet, square_feet_display, floors, value, value_display, stage, stage_detail, construction_start, estimated_completion, address, city, borough, neighborhood, state, zip, owner, gc, gc_slug, architect, pain_points, primary_pain_point, pain_point_detail, suggested_service, suggested_service_reason, relevant_case_study_ref, primary_contact_ref, warmth_score, warmth_factors) VALUES`);
projects.forEach((p, i) => {
  const comma = i < projects.length - 1 ? ',' : ';';
  const cStart = p.constructionStart ? `'${p.constructionStart}'` : 'NULL';
  const cEnd = p.estimatedCompletion ? `'${p.estimatedCompletion}'` : 'NULL';
  lines.push(`  ('${TENANT_ID}', ${esc(p.id)}, ${esc(p.dodgeNumber)}, ${esc(p.name)}, ${esc(p.type)}, ${esc(p.buildingTypeCode)}, ${p.squareFeet}, ${esc(p.squareFeetDisplay)}, ${p.floors}, ${p.value}, ${esc(p.valueDisplay)}, ${esc(p.stage)}, ${esc(p.stageDetail)}, ${cStart}, ${cEnd}, ${esc(p.address)}, ${esc(p.city)}, ${esc(p.borough)}, ${esc(p.neighborhood)}, ${esc(p.state)}, ${esc(p.zip)}, ${esc(p.owner)}, ${esc(p.gc)}, ${esc(p.gcSlug)}, ${esc(p.architect)}, ${jsonb(p.painPoints)}, ${esc(p.primaryPainPoint)}, ${esc(p.painPointDetail)}, ${esc(p.suggestedService)}, ${esc(p.suggestedServiceReason)}, ${esc(p.relevantCaseStudyId)}, ${esc(p.primaryContactId)}, ${p.warmthScore}, ${jsonb(p.warmthFactors)})${comma}`);
});
lines.push('');

// ── ICP Config ────────────────────────────────────────────────────────────────
lines.push('-- ============================================================================');
lines.push('-- ICP CONFIG');
lines.push('-- ============================================================================');
lines.push(`INSERT INTO public.icp_configs (tenant_id, name, filters, services, warmth_weights) VALUES`);
lines.push(`  ('${TENANT_ID}', ${esc(icpConfig.name)}, ${jsonb(icpConfig.filters)}, ${jsonb(icpConfig.services)}, ${jsonb(icpConfig.warmthWeights)});`);
lines.push('');

console.log(lines.join('\n'));
