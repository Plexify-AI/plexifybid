/**
 * Patch existing opportunities with warmth_dimensions from warmth signals.
 *
 * The import script skips already-imported records on resume, so the original
 * 222 opportunities created before composite warmth scoring don't have
 * warmth_dimensions in their enrichment_data. This script backfills them.
 *
 * Usage:
 *   node scripts/linkedingraph/patch-warmth-existing.mjs --dry-run
 *   node scripts/linkedingraph/patch-warmth-existing.mjs
 *
 * Requires .env.local with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLEXIFY_SANDBOX_TOKEN
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');

dotenv.config({ path: join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SANDBOX_TOKEN = process.env.PLEXIFY_SANDBOX_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local');
  process.exit(1);
}
if (!SANDBOX_TOKEN) {
  console.error('ERROR: PLEXIFY_SANDBOX_TOKEN required in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Load warmth signals ──
const WARMTH_FILE = join(DATA_DIR, 'linkedingraph_warmth_signals.json');
if (!existsSync(WARMTH_FILE)) {
  console.error('ERROR: Warmth signals file not found. Run extract-warmth-signals.mjs first.');
  process.exit(1);
}
const warmthSignals = JSON.parse(readFileSync(WARMTH_FILE, 'utf-8'));
console.log(`Warmth signals loaded: ${Object.keys(warmthSignals.contacts).length} contacts\n`);

// ── Build lookup by name (lowercase "first last" → warmth data) ──
// The warmth signals are keyed by LinkedIn URL, but existing opportunities
// may not have the URL stored. We build a name-based index as fallback.
const warmthByUrl = warmthSignals.contacts; // url → { warmth_composite, dimensions, ... }
const warmthByName = {};
for (const [url, data] of Object.entries(warmthByUrl)) {
  const name = data.name;
  if (name) {
    const key = name.toLowerCase().trim();
    // If multiple URLs map to same name, keep highest score
    if (!warmthByName[key] || data.warmth_composite > warmthByName[key].warmth_composite) {
      warmthByName[key] = data;
    }
  }
}
console.log(`Name-based index: ${Object.keys(warmthByName).length} unique names\n`);

// ── Resolve tenant ID ──
const { data: tenant, error: tenantErr } = await supabase
  .from('tenants')
  .select('id')
  .eq('sandbox_token', SANDBOX_TOKEN)
  .single();

if (tenantErr || !tenant) {
  console.error('ERROR: Could not resolve tenant from token:', tenantErr?.message);
  process.exit(1);
}
const tenantId = tenant.id;
console.log(`Tenant ID: ${tenantId}\n`);

// ── Fetch opportunities missing warmth_dimensions ──
const { data: opportunities, error: fetchErr } = await supabase
  .from('opportunities')
  .select('id, account_name, contact_name, warmth_score, enrichment_data')
  .eq('tenant_id', tenantId);

if (fetchErr) {
  console.error('ERROR: Could not fetch opportunities:', fetchErr.message);
  process.exit(1);
}

console.log(`Total opportunities for tenant: ${opportunities.length}`);

// Filter to those needing warmth patch
const needsPatch = opportunities.filter((opp) => {
  const ed = opp.enrichment_data;
  if (!ed) return true; // No enrichment data at all
  if (!ed.warmth_dimensions) return true; // Has enrichment but no warmth dimensions
  return false;
});

console.log(`Opportunities needing warmth patch: ${needsPatch.length}\n`);

if (needsPatch.length === 0) {
  console.log('All opportunities already have warmth_dimensions. Nothing to do.');
  process.exit(0);
}

// ── Match and patch ──
let matched = 0;
let updated = 0;
let noMatch = 0;
const noMatchList = [];

for (const opp of needsPatch) {
  // Try URL match first (from enrichment_data.linkedin_url)
  let warmth = null;
  const linkedinUrl = opp.enrichment_data?.linkedin_url;
  if (linkedinUrl && warmthByUrl[linkedinUrl]) {
    warmth = warmthByUrl[linkedinUrl];
  }

  // Fallback: name match
  if (!warmth && opp.contact_name) {
    const nameKey = opp.contact_name.toLowerCase().trim();
    if (warmthByName[nameKey]) {
      warmth = warmthByName[nameKey];
    }
  }

  if (!warmth) {
    noMatch++;
    noMatchList.push(`${opp.contact_name || '(no name)'} @ ${opp.account_name}`);
    continue;
  }

  matched++;

  const newEnrichment = {
    ...(opp.enrichment_data || {}),
    source_version: '1.0.0',
    warmth_composite: warmth.warmth_composite,
    warmth_label: warmth.warmth_label,
    warmth_dimensions: warmth.dimensions,
    warmth_patched_at: new Date().toISOString(),
  };

  const newWarmthScore = warmth.warmth_composite;

  // Build updated deal_hypothesis with warmth context
  const dims = warmth.dimensions;
  const topSignals = [];
  if (dims.message_count?.raw > 0) topSignals.push(`${dims.message_count.raw} msgs`);
  if (dims.endorsements?.raw?.given > 0 || dims.endorsements?.raw?.received > 0) {
    topSignals.push(dims.endorsements.raw.given > 0 && dims.endorsements.raw.received > 0 ? 'mutual endorsements' : 'endorsements');
  }
  if (dims.recommendations?.raw?.given || dims.recommendations?.raw?.received) {
    topSignals.push('recommendation');
  }
  if (dims.company_follow?.raw) topSignals.push('company followed');

  if (dryRun) {
    console.log(`  [MATCH] ${opp.contact_name} @ ${opp.account_name}`);
    console.log(`          warmth: ${opp.warmth_score || 0} → ${newWarmthScore} (${warmth.warmth_label})`);
    console.log(`          signals: ${topSignals.join(', ') || 'connection only'}`);
    continue;
  }

  // Live update
  const { error: updateErr } = await supabase
    .from('opportunities')
    .update({
      enrichment_data: newEnrichment,
      warmth_score: newWarmthScore,
    })
    .eq('id', opp.id);

  if (updateErr) {
    console.error(`  [ERROR] ${opp.contact_name}: ${updateErr.message}`);
  } else {
    updated++;
  }
}

// ── Summary ──
console.log(`\n=== Patch Summary ${dryRun ? '(DRY RUN)' : ''} ===`);
console.log(`Total needing patch: ${needsPatch.length}`);
console.log(`Matched: ${matched}`);
console.log(`Updated: ${dryRun ? '0 (dry run)' : updated}`);
console.log(`No match: ${noMatch}`);

if (noMatchList.length > 0 && noMatchList.length <= 20) {
  console.log('\nUnmatched opportunities:');
  for (const name of noMatchList) {
    console.log(`  - ${name}`);
  }
} else if (noMatchList.length > 20) {
  console.log(`\nFirst 20 unmatched opportunities:`);
  for (const name of noMatchList.slice(0, 20)) {
    console.log(`  - ${name}`);
  }
  console.log(`  ... and ${noMatchList.length - 20} more`);
}
