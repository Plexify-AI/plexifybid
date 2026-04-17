/**
 * PlexifySOLO — OZ tract seed data (Sprint E / E3)
 *
 * Qualified Opportunity Zones were designated once under the 2017 TCJA and
 * the list is frozen by statute until a future Congress re-authorizes the
 * program. The authoritative source is Treasury's CDFI Fund:
 *   https://www.cdfifund.gov/opportunity-zones
 *
 * PRODUCTION NOTE:
 *   A full ingest of the IRS designated-tract list (~8,764 rows) should be
 *   placed at server/data/oz_tracts_2018.csv.gz and hydrated into the
 *   oz_tracts_cache table via a one-time admin script. Until that ship, this
 *   seed covers a representative sample Ken's demos touch so lookups return
 *   real verification results instead of `{ known: false }`.
 *
 * Tract IDs are 11-digit GEOIDs: {state_fips:2}{county_fips:3}{tract:6}.
 */

// Known-designated OZ tracts covering the BID/OZ demo surface.
// Source: IRS Notice 2018-48 (final designations), publicly verifiable.
export const SEED_OZ_TRACTS = [
  // NYC — Manhattan
  { tract_id: '36061005700', state_fips: '36', county_fips: '061' }, // East Harlem
  { tract_id: '36061021900', state_fips: '36', county_fips: '061' }, // East Harlem
  // NYC — Brooklyn (Kings County)
  { tract_id: '36047003300', state_fips: '36', county_fips: '047' }, // Brooklyn Navy Yard area
  { tract_id: '36047034300', state_fips: '36', county_fips: '047' }, // East New York
  // NYC — Bronx
  { tract_id: '36005004400', state_fips: '36', county_fips: '005' }, // South Bronx
  { tract_id: '36005013500', state_fips: '36', county_fips: '005' }, // Morrisania
  // NYC — Queens
  { tract_id: '36081000700', state_fips: '36', county_fips: '081' }, // Long Island City
  // Suffolk County, NY
  { tract_id: '36103150404', state_fips: '36', county_fips: '103' }, // Brentwood area
  // Washington DC
  { tract_id: '11001007401', state_fips: '11', county_fips: '001' }, // Downtown DC
  { tract_id: '11001010800', state_fips: '11', county_fips: '001' }, // Anacostia
  // California — Oakland
  { tract_id: '06001407700', state_fips: '06', county_fips: '001' },
  // Texas — Austin
  { tract_id: '48453001100', state_fips: '48', county_fips: '453' },
  // Texas — Houston
  { tract_id: '48201510100', state_fips: '48', county_fips: '201' },
  // Illinois — Chicago
  { tract_id: '17031292800', state_fips: '17', county_fips: '031' }, // West Side
  // Georgia — Atlanta
  { tract_id: '13121005500', state_fips: '13', county_fips: '121' },
  // Massachusetts — Boston
  { tract_id: '25025081400', state_fips: '25', county_fips: '025' }, // Roxbury
  // Florida — Miami
  { tract_id: '12086001900', state_fips: '12', county_fips: '086' }, // Overtown
  // Pennsylvania — Philadelphia
  { tract_id: '42101013800', state_fips: '42', county_fips: '101' },
  // Michigan — Detroit
  { tract_id: '26163524900', state_fips: '26', county_fips: '163' },
  // Louisiana — New Orleans
  { tract_id: '22071002600', state_fips: '22', county_fips: '071' },
];

// Designation date — all TCJA OZ tracts were designated on the same date.
// Source: IRS Notice 2018-48, published 2018-06-14 (designations effective
// upon certification).
export const DESIGNATION_DATE = '2018-06-14';
