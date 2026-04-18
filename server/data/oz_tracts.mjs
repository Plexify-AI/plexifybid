/**
 * PlexifySOLO — IRS Opportunity Zone tract lookup (Sprint E / E3)
 *
 * Qualified Opportunity Zone designations under the 2017 TCJA are FROZEN BY
 * STATUTE. The IRS designated ~8,764 tracts in 2018 and the list does not
 * change until Congress re-authorizes the program. That means this cache is
 * essentially write-once: hydrate it once, read it forever.
 *
 * LOOKUP ORDER:
 *   1. oz_tracts_cache table (authoritative, writes persist)
 *   2. SEED_OZ_TRACTS (baked-in known-good sample for demo surface)
 *   3. Fallback: { known: false } — we never fabricate designation status.
 *
 * Production hydration: place the full IRS CSV at
 *   server/data/oz_tracts_2018.csv.gz
 * and call hydrateFromCsv() once via an admin script. That populates the
 * cache for every tract. Until then, lookups outside the seed return
 * { known: false } and consuming skills flag `verified: false` accordingly.
 *
 * BID address lookup is out of scope for E3 — lookupByAddress() is a stub
 * that returns `{ known: false, reason: 'address-lookup-not-implemented' }`.
 * Sprint F adds a real geocoder + tract resolver.
 */

import { getSupabase } from '../lib/supabase.js';
import { SEED_OZ_TRACTS, DESIGNATION_DATE } from './oz_tracts_seed.mjs';

// Seed index for O(1) lookups — built once on module load.
const SEED_INDEX = new Map();
for (const t of SEED_OZ_TRACTS) {
  SEED_INDEX.set(t.tract_id, t);
}

/**
 * Check whether a single tract GEOID is an IRS-designated OZ.
 * Returns { known: true, is_oz_designated, state_fips, county_fips,
 *          designation_date, source } on hit, or { known: false } on miss.
 */
export async function isOzDesignated(tractId) {
  if (!tractId || typeof tractId !== 'string') {
    return { known: false };
  }
  const clean = tractId.trim();

  // 1. Cache lookup
  try {
    const { data } = await getSupabase()
      .from('oz_tracts_cache')
      .select('tract_id, state_fips, county_fips, is_oz_designated, designation_date')
      .eq('tract_id', clean)
      .maybeSingle();
    if (data) {
      return {
        known: true,
        is_oz_designated: data.is_oz_designated,
        state_fips: data.state_fips,
        county_fips: data.county_fips,
        designation_date: data.designation_date,
        source: 'oz_tracts_cache',
      };
    }
  } catch (err) {
    console.error('[oz_tracts] cache read failed:', err.message);
  }

  // 2. Seed lookup — hydrate cache on hit so future calls short-circuit
  const seeded = SEED_INDEX.get(clean);
  if (seeded) {
    const row = {
      tract_id: seeded.tract_id,
      state_fips: seeded.state_fips,
      county_fips: seeded.county_fips,
      is_oz_designated: true,
      designation_date: DESIGNATION_DATE,
      raw: null,
    };
    // Fire-and-forget hydrate
    getSupabase().from('oz_tracts_cache').upsert(row).then(({ error }) => {
      if (error) console.error('[oz_tracts] seed hydrate failed:', error.message);
    });
    return {
      known: true,
      is_oz_designated: true,
      state_fips: seeded.state_fips,
      county_fips: seeded.county_fips,
      designation_date: DESIGNATION_DATE,
      source: 'seed',
    };
  }

  // 3. Unknown — honest fallback. Consumers mark verified=false.
  return { known: false };
}

/**
 * List all seeded OZ tracts in a state (FIPS 2-digit string).
 * Cache-backed state-level queries land in Sprint F when the full CSV is
 * hydrated; for now this pulls from the seed + cache.
 */
export async function listOzTractsInState(stateFips) {
  const out = [];
  try {
    const { data } = await getSupabase()
      .from('oz_tracts_cache')
      .select('tract_id, state_fips, county_fips')
      .eq('state_fips', stateFips)
      .eq('is_oz_designated', true);
    for (const d of data || []) out.push(d);
  } catch (err) {
    console.error('[oz_tracts] cache list failed:', err.message);
  }
  // Seed fallback — dedupe against anything the cache already returned
  const cached = new Set(out.map((r) => r.tract_id));
  for (const s of SEED_OZ_TRACTS) {
    if (s.state_fips === stateFips && !cached.has(s.tract_id)) {
      out.push(s);
    }
  }
  return out;
}

/**
 * BID address → tract resolver. Not implemented in E3; Sprint F adds a
 * real geocoder. Returns an honest placeholder so consuming skills don't
 * silently assume resolution.
 */
export async function lookupByAddress(address) {
  return { known: false, reason: 'address-lookup-not-implemented', address };
}
