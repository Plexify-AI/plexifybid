/**
 * Voice DNA Service — business logic for voice profiles.
 *
 * All queries use getSupabase() from server/lib/supabase.js
 * and filter by tenant_id for RLS compliance.
 */

import { getSupabase } from '../supabase.js';

// ---------------------------------------------------------------------------
// Profile CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new draft Voice DNA profile.
 * @param {string} tenantId
 * @param {{ profileName: string, ownerName: string }} opts
 * @returns {Promise<object>} The created profile row
 */
export async function createProfile(tenantId, { profileName, ownerName }) {
  const { data, error } = await getSupabase()
    .from('voice_dna_profiles')
    .insert({
      tenant_id: tenantId,
      profile_name: profileName,
      owner_name: ownerName,
      status: 'draft',
      version: 1,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create voice profile: ${error.message}`);
  return data;
}

/**
 * Get the active Voice DNA profile for a tenant (or null).
 * @param {string} tenantId
 * @returns {Promise<object|null>}
 */
export async function getActiveProfile(tenantId) {
  const { data, error } = await getSupabase()
    .from('voice_dna_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch active profile: ${error.message}`);
  return data;
}

/**
 * Get a Voice DNA profile by ID.
 * @param {string} tenantId
 * @param {string} profileId
 * @returns {Promise<object>}
 */
export async function getProfileById(tenantId, profileId) {
  const { data, error } = await getSupabase()
    .from('voice_dna_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw new Error(`Profile not found: ${error.message}`);
  return data;
}

/**
 * Update profile_data JSON and set status.
 * @param {string} tenantId
 * @param {string} profileId
 * @param {object} profileData - The full Voice DNA JSON
 * @param {string} [status='pending_approval']
 * @param {number} [confidenceScore]
 * @returns {Promise<object>}
 */
export async function updateProfileData(tenantId, profileId, profileData, status = 'pending_approval', confidenceScore = null) {
  const updates = {
    profile_data: profileData,
    status,
  };
  if (confidenceScore !== null) {
    updates.confidence_score = confidenceScore;
  }

  const { data, error } = await getSupabase()
    .from('voice_dna_profiles')
    .update(updates)
    .eq('id', profileId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile data: ${error.message}`);
  return data;
}

/**
 * Approve a profile — archive any existing active profile, then set this one active.
 * @param {string} tenantId
 * @param {string} profileId
 * @returns {Promise<object>}
 */
export async function approveProfile(tenantId, profileId) {
  const sb = getSupabase();

  // Archive any currently active profile for this tenant
  await sb
    .from('voice_dna_profiles')
    .update({ status: 'archived' })
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  // Activate the target profile
  const { data, error } = await sb
    .from('voice_dna_profiles')
    .update({ status: 'active' })
    .eq('id', profileId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw new Error(`Failed to approve profile: ${error.message}`);
  return data;
}

/**
 * Update individual dimension overrides on an active profile.
 * Merges provided dimensions into the existing profile_data.voiceDimensions.
 * @param {string} tenantId
 * @param {string} profileId
 * @param {object} dimensionOverrides - e.g. { formality: { score: 8, notes: "..." } }
 * @returns {Promise<object>}
 */
export async function updateDimensions(tenantId, profileId, dimensionOverrides) {
  const profile = await getProfileById(tenantId, profileId);
  if (!profile.profile_data) {
    throw new Error('Profile has no profile_data — run analysis first');
  }

  const updated = {
    ...profile.profile_data,
    voiceDimensions: {
      ...profile.profile_data.voiceDimensions,
      ...dimensionOverrides,
    },
  };

  // Bump version
  const { data, error } = await getSupabase()
    .from('voice_dna_profiles')
    .update({
      profile_data: updated,
      version: (profile.version || 1) + 1,
    })
    .eq('id', profileId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update dimensions: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

/**
 * Bulk insert writing samples for a profile.
 * @param {string} tenantId
 * @param {string} profileId
 * @param {Array<{ sourceType: string, contentType: string, text: string, weight?: number }>} samples
 * @returns {Promise<Array>}
 */
export async function saveSamples(tenantId, profileId, samples) {
  const rows = samples.map(s => ({
    profile_id: profileId,
    tenant_id: tenantId,
    source_type: s.sourceType,
    content_type: s.contentType,
    text: s.text,
    word_count: s.text.split(/\s+/).filter(w => w.length > 0).length,
    weight: s.weight ?? 1.0,
  }));

  const { data, error } = await getSupabase()
    .from('voice_dna_samples')
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to save samples: ${error.message}`);
  return data;
}

/**
 * Get all samples for a profile.
 * @param {string} tenantId
 * @param {string} profileId
 * @returns {Promise<Array>}
 */
export async function getSamples(tenantId, profileId) {
  const { data, error } = await getSupabase()
    .from('voice_dna_samples')
    .select('*')
    .eq('profile_id', profileId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch samples: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Log a metric event for a profile.
 * @param {string} tenantId
 * @param {string} profileId
 * @param {string} metricType
 * @param {object} metricData
 * @returns {Promise<object>}
 */
export async function logMetric(tenantId, profileId, metricType, metricData) {
  const { data, error } = await getSupabase()
    .from('voice_dna_metrics')
    .insert({
      profile_id: profileId,
      tenant_id: tenantId,
      metric_type: metricType,
      metric_data: metricData,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log metric: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Tenant resolution from sandbox token (for CLI scripts)
// ---------------------------------------------------------------------------

/**
 * Resolve a sandbox token to a tenant record.
 * Used by CLI scripts that read PLEXIFY_SANDBOX_TOKEN from .env.local.
 * @param {string} token
 * @returns {Promise<object>} tenant row
 */
export async function resolveTenantFromToken(token) {
  const { data, error } = await getSupabase()
    .from('tenants')
    .select('*')
    .eq('sandbox_token', token)
    .single();

  if (error) throw new Error(`Invalid sandbox token: ${error.message}`);
  return data;
}
