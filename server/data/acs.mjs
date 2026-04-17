/**
 * PlexifySOLO — U.S. Census ACS 5-year demographics lookup (Sprint E / E3)
 *
 * Source: Census Bureau ACS 5-Year Estimates API
 *   https://api.census.gov/data/{year}/acs/acs5
 *
 * RATE LIMIT:
 *   The Census API allows ~500 anonymous calls/day/IP. Steady-state traffic
 *   in Plexify is low (one call per unique tract, cached permanently in
 *   acs_data_cache), but heavy demo days or a sudden batch workload could
 *   exceed the limit.
 *
 * TO ADD A KEY LATER (lifts the limit to 50,000/day):
 *   1. Request a free key at https://api.census.gov/data/key_signup.html
 *   2. Add CENSUS_API_KEY=... to .env.local
 *   3. No code change needed — this module reads process.env.CENSUS_API_KEY
 *      and appends &key= to the request when present.
 *
 * LOOKUP ORDER:
 *   1. acs_data_cache (authoritative, permanent)
 *   2. Census ACS API (anonymous or keyed) → write cache on success
 *   3. Fallback: { known: false, reason } — never fabricate demographics.
 */

import { getSupabase } from '../lib/supabase.js';

// ACS 5-year variables we surface. Labels are what Census calls them; we
// translate to human-readable keys in the response.
const ACS_VARS = {
  medianHouseholdIncome: 'B19013_001E',
  totalPopulation: 'B01003_001E',
  totalHousingUnits: 'B25001_001E',
  povertyCount: 'B17001_002E',
  povertyUniverse: 'B17001_001E',
  medianHomeValue: 'B25077_001E',
  medianGrossRent: 'B25064_001E',
};

const DEFAULT_YEAR = 2023;

/**
 * Get demographics for a single tract GEOID. Returns a normalized object on
 * hit, or { known: false, reason } on miss/upstream failure.
 *
 * tractId: 11-digit GEOID (state(2) + county(3) + tract(6))
 * year:    ACS 5-year end year, default 2023
 */
export async function getTractDemographics(tractId, year = DEFAULT_YEAR) {
  if (!tractId || typeof tractId !== 'string') {
    return { known: false, reason: 'invalid-tract-id' };
  }
  const clean = tractId.trim();
  if (clean.length !== 11) {
    return { known: false, reason: 'tract-id-must-be-11-digit-geoid' };
  }

  const supabase = getSupabase();

  // 1. Cache
  try {
    const { data } = await supabase
      .from('acs_data_cache')
      .select('tract_id, year, data, fetched_at')
      .eq('tract_id', clean)
      .eq('year', year)
      .maybeSingle();
    if (data) {
      return { known: true, source: 'acs_data_cache', year, ...data.data };
    }
  } catch (err) {
    console.error('[acs] cache read failed:', err.message);
  }

  // 2. Upstream fetch
  const state = clean.slice(0, 2);
  const county = clean.slice(2, 5);
  const tract = clean.slice(5);

  const varList = Object.values(ACS_VARS).join(',');
  const qs = [
    `get=${varList}`,
    `for=tract:${tract}`,
    `in=state:${state}+county:${county}`,
  ];
  const key = process.env.CENSUS_API_KEY;
  if (key) qs.push(`key=${encodeURIComponent(key)}`);

  const url = `https://api.census.gov/data/${year}/acs/acs5?${qs.join('&')}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return {
        known: false,
        reason: `census-api-http-${resp.status}`,
        url_hint: url.replace(/key=[^&]+/, 'key=...'),
      };
    }
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length < 2) {
      return { known: false, reason: 'census-api-empty' };
    }

    // Row 0 is headers, row 1 is the single tract.
    const header = rows[0];
    const row = rows[1];
    const byVar = {};
    for (let i = 0; i < header.length; i++) byVar[header[i]] = row[i];

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const povU = num(byVar[ACS_VARS.povertyUniverse]);
    const povC = num(byVar[ACS_VARS.povertyCount]);
    const povertyRate = povU && povU > 0 ? +(povC / povU).toFixed(4) : null;

    const normalized = {
      median_household_income: num(byVar[ACS_VARS.medianHouseholdIncome]),
      total_population: num(byVar[ACS_VARS.totalPopulation]),
      total_housing_units: num(byVar[ACS_VARS.totalHousingUnits]),
      poverty_rate: povertyRate,
      median_home_value: num(byVar[ACS_VARS.medianHomeValue]),
      median_gross_rent: num(byVar[ACS_VARS.medianGrossRent]),
    };

    // Cache write — fire-and-forget
    supabase
      .from('acs_data_cache')
      .upsert({ tract_id: clean, year, data: normalized }, { onConflict: 'tract_id,year' })
      .then(({ error }) => {
        if (error) console.error('[acs] cache write failed:', error.message);
      });

    return { known: true, source: 'census_acs5', year, ...normalized };
  } catch (err) {
    console.error('[acs] upstream fetch failed:', err.message);
    return { known: false, reason: `census-api-error: ${err.message}` };
  }
}
