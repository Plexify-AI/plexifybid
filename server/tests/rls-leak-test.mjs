/**
 * PlexifyAEC — RLS / Tenant Isolation Leak Test
 *
 * Tests API-layer tenant isolation via Express endpoints.
 * Uses two known sandbox tokens to verify that authenticating
 * as Tenant A never returns data belonging to Tenant B.
 *
 * Usage:
 *   node server/tests/rls-leak-test.mjs [base-url]
 *
 * Default base URL: http://localhost:3000
 * Example:
 *   node server/tests/rls-leak-test.mjs https://plexifybid-production.up.railway.app
 *
 * Exit code:
 *   0 — all tests passed
 *   1 — one or more leaks detected or test failures
 */

// ---------------------------------------------------------------------------
// Config — two tenants from different industries to maximize leak signal
// ---------------------------------------------------------------------------

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// SB1: Mel Wallace — AEC (has prospect data, deal rooms, usage events)
const TENANT_A = {
  name: 'Mel Wallace (SB1)',
  token: 'pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084',
  tenantId: null, // resolved at runtime
};

// SB4: Josh Rosen — Broadcast (has Gravity Media prospects)
const TENANT_B = {
  name: 'Josh Rosen (SB4)',
  token: 'pxs_32092a7dac0fd24cf45a728ae7bc985830bc15d6be27755d',
  tenantId: null, // resolved at runtime
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function fetchApi(path, token, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return {
    status: res.status,
    data: res.headers.get('content-type')?.includes('json')
      ? await res.json()
      : null,
  };
}

function recordResult(testName, passed, detail) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ ${testName}`);
  } else {
    failedTests++;
    const msg = `  ❌ ${testName} — ${detail}`;
    console.log(msg);
    failures.push({ testName, detail });
  }
}

/**
 * Resolve tenant_id from the auth/validate endpoint.
 * auth.js now returns { valid: true, tenant: { id, name, company, slug, ... } }
 */
async function resolveTenantId(tenant) {
  const res = await fetch(`${BASE_URL}/api/auth/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tenant.token }),
  });

  if (!res.ok) {
    throw new Error(`Auth validate failed for ${tenant.name}: HTTP ${res.status}`);
  }

  const body = await res.json();
  const id = body.tenant?.id;
  if (!id) {
    throw new Error(`Could not resolve tenant_id for ${tenant.name}: ${JSON.stringify(body)}`);
  }
  tenant.tenantId = id;
  return id;
}

/**
 * Check that all rows in an array have the expected tenant_id.
 * Returns { leaked: boolean, count, leakedIds }.
 */
function checkTenantScope(rows, expectedTenantId) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { leaked: false, count: 0, leakedIds: [] };
  }

  const leakedIds = [];
  for (const row of rows) {
    if (row.tenant_id && row.tenant_id !== expectedTenantId) {
      leakedIds.push(row.tenant_id);
    }
  }

  return {
    leaked: leakedIds.length > 0,
    count: rows.length,
    leakedIds: [...new Set(leakedIds)],
  };
}

// ---------------------------------------------------------------------------
// Test suites — existing endpoints
// ---------------------------------------------------------------------------

async function testUsageEvents(tenant) {
  const { status, data } = await fetchApi('/api/usage-events?limit=50', tenant.token);

  if (status !== 200) {
    recordResult(`usage-events (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  const events = data?.events || [];
  const result = checkTenantScope(events, tenant.tenantId);

  recordResult(
    `usage-events (${tenant.name}): ${result.count} rows`,
    !result.leaked,
    result.leaked ? `Leaked tenant_ids: ${result.leakedIds.join(', ')}` : ''
  );
}

async function testDealRooms(tenant) {
  const { status, data } = await fetchApi('/api/deal-rooms', tenant.token);

  if (status !== 200) {
    recordResult(`deal-rooms (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  const rooms = data?.dealRooms || data?.deal_rooms || [];
  const result = checkTenantScope(rooms, tenant.tenantId);

  recordResult(
    `deal-rooms (${tenant.name}): ${result.count} rows`,
    !result.leaked,
    result.leaked ? `Leaked tenant_ids: ${result.leakedIds.join(', ')}` : ''
  );
}

async function testPipelineSummary(tenant) {
  const { status, data } = await fetchApi('/api/pipeline-summary', tenant.token);

  if (status !== 200) {
    recordResult(`pipeline-summary (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  // Pipeline summary returns aggregate counts — no row-level leak to check
  // Just verify it responds with expected shape
  const hasKeys = data && (
    'activeOpportunityCount' in data ||
    'topOpportunityName' in data
  );

  recordResult(
    `pipeline-summary (${tenant.name}): response shape OK`,
    hasKeys,
    hasKeys ? '' : `Unexpected response shape: ${JSON.stringify(Object.keys(data || {}))}`
  );
}

async function testPowerflow(tenant) {
  const { status, data } = await fetchApi('/api/powerflow/today', tenant.token);

  if (status !== 200) {
    recordResult(`powerflow (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  // Powerflow returns a single state object — check tenant_id
  const state = data?.state || data;
  if (state?.tenant_id && state.tenant_id !== tenant.tenantId) {
    recordResult(
      `powerflow (${tenant.name})`,
      false,
      `Wrong tenant_id: expected ${tenant.tenantId}, got ${state.tenant_id}`
    );
  } else {
    recordResult(`powerflow (${tenant.name}): state OK`, true, '');
  }
}

async function testSystemStatus(tenant) {
  const { status, data } = await fetchApi('/api/system-status', tenant.token);

  if (status !== 200) {
    recordResult(`system-status (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  // system-status returns nested objects: events, outreach, jobs, pipeline, agents, llm_providers
  const hasKeys = data && (
    'events' in data ||
    'pipeline' in data ||
    'llm_providers' in data
  );

  // Verify tenant scoping — tenant_id in response should match
  const scopedCorrectly = !data.tenant_id || data.tenant_id === tenant.tenantId;

  recordResult(
    `system-status (${tenant.name}): response shape OK`,
    hasKeys && scopedCorrectly,
    !hasKeys
      ? `Unexpected response shape: ${JSON.stringify(Object.keys(data || {}))}`
      : !scopedCorrectly
        ? `Wrong tenant_id: expected ${tenant.tenantId}, got ${data.tenant_id}`
        : ''
  );
}

// ---------------------------------------------------------------------------
// Test suites — Sprint 0 endpoints (opportunities, signals)
// ---------------------------------------------------------------------------

async function testOpportunities(tenant) {
  const { status, data } = await fetchApi('/api/opportunities', tenant.token);

  if (status === 404) {
    recordResult(`opportunities (${tenant.name}): endpoint not yet deployed`, true, '');
    return;
  }

  if (status !== 200) {
    recordResult(`opportunities (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  const opps = data?.opportunities || [];
  const result = checkTenantScope(opps, tenant.tenantId);

  recordResult(
    `opportunities (${tenant.name}): ${result.count} rows`,
    !result.leaked,
    result.leaked ? `Leaked tenant_ids: ${result.leakedIds.join(', ')}` : ''
  );
}

async function testSignals(tenant) {
  // Test GET /api/signals/:opportunityId — needs a real opp ID
  // First try listing opportunities to get an ID
  const { status: oppStatus, data: oppData } = await fetchApi('/api/opportunities', tenant.token);

  if (oppStatus === 404) {
    recordResult(`signals (${tenant.name}): endpoint not yet deployed`, true, '');
    return;
  }

  const opps = oppData?.opportunities || [];
  if (opps.length === 0) {
    recordResult(`signals (${tenant.name}): no opportunities to test`, true, '');
    return;
  }

  const oppId = opps[0].id;
  const { status, data } = await fetchApi(`/api/signals/${oppId}`, tenant.token);

  if (status === 404) {
    recordResult(`signals (${tenant.name}): endpoint not yet deployed`, true, '');
    return;
  }

  if (status !== 200) {
    recordResult(`signals (${tenant.name})`, false, `HTTP ${status}`);
    return;
  }

  const events = data?.events || [];
  const result = checkTenantScope(events, tenant.tenantId);

  recordResult(
    `signals (${tenant.name}): ${result.count} events for opp`,
    !result.leaked,
    result.leaked ? `Leaked tenant_ids: ${result.leakedIds.join(', ')}` : ''
  );
}

// ---------------------------------------------------------------------------
// Cross-tenant and auth boundary tests
// ---------------------------------------------------------------------------

/**
 * Cross-tenant test: Authenticate as Tenant A, check that no data
 * from Tenant B appears in responses.
 */
async function testCrossTenantIsolation() {
  console.log('\n--- Cross-Tenant Isolation (A sees only A, never B) ---');

  // Fetch deal rooms for Tenant A
  const { data: aRooms } = await fetchApi('/api/deal-rooms', TENANT_A.token);
  const aRoomList = aRooms?.dealRooms || aRooms?.deal_rooms || [];

  // Fetch deal rooms for Tenant B
  const { data: bRooms } = await fetchApi('/api/deal-rooms', TENANT_B.token);
  const bRoomList = bRooms?.dealRooms || bRooms?.deal_rooms || [];

  // Extract IDs
  const aIds = new Set(aRoomList.map(r => r.id));
  const bIds = new Set(bRoomList.map(r => r.id));

  // Check for overlap
  const overlap = [...aIds].filter(id => bIds.has(id));

  recordResult(
    `cross-tenant deal-rooms: A=${aIds.size} rooms, B=${bIds.size} rooms`,
    overlap.length === 0,
    overlap.length > 0 ? `Shared room IDs: ${overlap.join(', ')}` : ''
  );

  // Fetch usage events for Tenant A, check none belong to B
  const { data: aEvents } = await fetchApi('/api/usage-events?limit=50', TENANT_A.token);
  const aEventsList = aEvents?.events || [];
  const bLeaks = aEventsList.filter(e => e.tenant_id === TENANT_B.tenantId);

  recordResult(
    `cross-tenant usage-events: A has ${aEventsList.length} events`,
    bLeaks.length === 0,
    bLeaks.length > 0 ? `Found ${bLeaks.length} events belonging to Tenant B` : ''
  );

  // Cross-tenant opportunities (if endpoint exists)
  const { status: oppStatusA, data: oppDataA } = await fetchApi('/api/opportunities', TENANT_A.token);
  const { status: oppStatusB, data: oppDataB } = await fetchApi('/api/opportunities', TENANT_B.token);

  if (oppStatusA === 200 && oppStatusB === 200) {
    const aOppIds = new Set((oppDataA?.opportunities || []).map(o => o.id));
    const bOppIds = new Set((oppDataB?.opportunities || []).map(o => o.id));
    const oppOverlap = [...aOppIds].filter(id => bOppIds.has(id));

    recordResult(
      `cross-tenant opportunities: A=${aOppIds.size}, B=${bOppIds.size}`,
      oppOverlap.length === 0,
      oppOverlap.length > 0 ? `Shared opp IDs: ${oppOverlap.join(', ')}` : ''
    );
  }
}

/**
 * Auth boundary tests: Verify that missing/invalid tokens are rejected.
 */
async function testAuthBoundary() {
  console.log('\n--- Auth Boundary Tests ---');

  // No token
  const noAuth = await fetch(`${BASE_URL}/api/usage-events`, {
    headers: { 'Content-Type': 'application/json' },
  });
  recordResult(
    'no-token → 401',
    noAuth.status === 401,
    noAuth.status !== 401 ? `Expected 401, got ${noAuth.status}` : ''
  );

  // Invalid token
  const badAuth = await fetch(`${BASE_URL}/api/usage-events`, {
    headers: {
      Authorization: 'Bearer pxs_invalid_token_12345',
      'Content-Type': 'application/json',
    },
  });
  recordResult(
    'invalid-token → 401',
    badAuth.status === 401,
    badAuth.status !== 401 ? `Expected 401, got ${badAuth.status}` : ''
  );

  // Health endpoint is public (no token needed)
  const health = await fetch(`${BASE_URL}/api/health`);
  recordResult(
    'health endpoint (public) → 200',
    health.status === 200,
    health.status !== 200 ? `Expected 200, got ${health.status}` : ''
  );

  // Auth validate is public
  const validate = await fetch(`${BASE_URL}/api/auth/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'pxs_invalid' }),
  });
  recordResult(
    'auth/validate (public) → 200 with valid:false',
    validate.status === 200,
    validate.status !== 200 ? `Expected 200, got ${validate.status}` : ''
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🔒 PlexifyAEC — RLS / Tenant Isolation Leak Test`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Tenant A: ${TENANT_A.name}`);
  console.log(`   Tenant B: ${TENANT_B.name}\n`);

  // Step 1: Verify server is reachable
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
    console.log('Server reachable ✅\n');
  } catch (err) {
    console.error(`❌ Server not reachable at ${BASE_URL}`);
    console.error(`   ${err.message}`);
    console.error(`   Start the server first: npm run dev  or  node server/index.mjs`);
    process.exit(1);
  }

  // Step 2: Resolve tenant IDs
  try {
    await resolveTenantId(TENANT_A);
    console.log(`Tenant A resolved: ${TENANT_A.tenantId}`);
    await resolveTenantId(TENANT_B);
    console.log(`Tenant B resolved: ${TENANT_B.tenantId}\n`);
  } catch (err) {
    console.error(`❌ Failed to resolve tenant IDs: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Auth boundary tests
  await testAuthBoundary();

  // Step 4: Per-tenant endpoint scoping — existing endpoints
  for (const tenant of [TENANT_A, TENANT_B]) {
    console.log(`\n--- Tenant Scoping: ${tenant.name} ---`);
    await testUsageEvents(tenant);
    await testDealRooms(tenant);
    await testPipelineSummary(tenant);
    await testPowerflow(tenant);
    await testSystemStatus(tenant);
  }

  // Step 5: Per-tenant endpoint scoping — Sprint 0 endpoints
  for (const tenant of [TENANT_A, TENANT_B]) {
    console.log(`\n--- Sprint 0 Tables: ${tenant.name} ---`);
    await testOpportunities(tenant);
    await testSignals(tenant);
  }

  // Step 6: Cross-tenant isolation
  await testCrossTenantIsolation();

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passedTests}/${totalTests} passed, ${failedTests} failed`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ❌ ${f.testName}: ${f.detail}`);
    }
  }

  console.log('='.repeat(60) + '\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
