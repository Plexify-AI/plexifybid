/**
 * PlexifySOLO — Server-side Supabase client + tenant middleware
 *
 * Uses the service role key for full database access.
 * The tenant middleware validates sandbox_token from the
 * X-Sandbox-Token header and attaches tenant to the request.
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS)
// ---------------------------------------------------------------------------

// Lazy init — env vars may not be available at import time in Vite dev
let _supabase = null;

export function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set these in .env.local.'
      );
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

// Backward compat — re-export as lazy getter
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop];
  },
});

// ---------------------------------------------------------------------------
// Query helpers — all scoped by tenant_id
// ---------------------------------------------------------------------------

export async function getProspects(tenantId, { limit = 50, orderBy = 'warmth_score', ascending = false } = {}) {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('tenant_id', tenantId)
    .order(orderBy, { ascending })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getProspectByRef(tenantId, refId) {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ref_id', refId)
    .single();
  if (error) throw error;
  return data;
}

export async function getContacts(tenantId) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return data;
}

export async function getContactByRef(tenantId, refId) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ref_id', refId)
    .single();
  if (error) throw error;
  return data;
}

export async function getConnections(tenantId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return data;
}

export async function getCaseStudies(tenantId) {
  const { data, error } = await supabase
    .from('case_studies')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return data;
}

export async function getCaseStudyByRef(tenantId, refId) {
  const { data, error } = await supabase
    .from('case_studies')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('ref_id', refId)
    .single();
  if (error) throw error;
  return data;
}

export async function getICPConfig(tenantId) {
  const { data, error } = await supabase
    .from('icp_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

export async function createConversation(tenantId, messages = [], context = {}) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ tenant_id: tenantId, messages, context })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConversation(id, messages, context) {
  const update = {};
  if (messages !== undefined) update.messages = messages;
  if (context !== undefined) update.context = context;
  const { data, error } = await supabase
    .from('conversations')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createOutreachDraft(tenantId, { prospectId, subject, body, tone }) {
  const { data, error } = await supabase
    .from('outreach_drafts')
    .insert({
      tenant_id: tenantId,
      prospect_id: prospectId || null,
      subject,
      body,
      tone: tone || 'professional',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function logUsageEvent(tenantId, eventType, eventData = {}) {
  const { error } = await supabase
    .from('usage_events')
    .insert({ tenant_id: tenantId, event_type: eventType, event_data: eventData });
  if (error) console.error('[usage_events] insert failed:', error.message);
}

export async function getUsageEvents(tenantId, { limit = 10 } = {}) {
  const { data, error } = await supabase
    .from('usage_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Supabase Storage — deal-room-files bucket
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'deal-room-files';

export async function uploadFile(storagePath, fileBuffer, contentType) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, { contentType, upsert: false });
  if (error) throw error;
  return data;
}

export async function deleteFile(storagePath) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Deal Room CRUD helpers
// ---------------------------------------------------------------------------

export async function createDealRoom(tenantId, { name, description, prospect_id, opportunity_id, room_type }) {
  const row = {
    tenant_id: tenantId,
    name,
    description: description || null,
    prospect_id: prospect_id || null,
  };
  if (opportunity_id) row.opportunity_id = opportunity_id;
  if (room_type) row.room_type = room_type;
  const { data, error } = await supabase
    .from('deal_rooms')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDealRooms(tenantId) {
  const { data, error } = await supabase
    .from('deal_rooms')
    .select('*, deal_room_sources(id), deal_room_messages(id)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  // Flatten counts
  return data.map((r) => ({
    ...r,
    source_count: r.deal_room_sources?.length || 0,
    message_count: r.deal_room_messages?.length || 0,
    deal_room_sources: undefined,
    deal_room_messages: undefined,
  }));
}

export async function getDealRoom(tenantId, dealRoomId) {
  const { data, error } = await supabase
    .from('deal_rooms')
    .select('*')
    .eq('id', dealRoomId)
    .eq('tenant_id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

export async function getDealRoomSources(tenantId, dealRoomId) {
  const { data, error } = await supabase
    .from('deal_room_sources')
    .select('id, deal_room_id, file_name, file_type, file_size, processing_status, summary, chunk_count, uploaded_at')
    .eq('deal_room_id', dealRoomId)
    .eq('tenant_id', tenantId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getDealRoomSourceFull(tenantId, sourceId) {
  const { data, error } = await supabase
    .from('deal_room_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('tenant_id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

export async function getAllSourceChunks(tenantId, dealRoomId) {
  const { data, error } = await supabase
    .from('deal_room_sources')
    .select('id, file_name, content_chunks')
    .eq('deal_room_id', dealRoomId)
    .eq('tenant_id', tenantId)
    .eq('processing_status', 'ready');
  if (error) throw error;
  return data;
}

export async function createDealRoomSource(tenantId, dealRoomId, sourceData) {
  const { data, error } = await supabase
    .from('deal_room_sources')
    .insert({ tenant_id: tenantId, deal_room_id: dealRoomId, ...sourceData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDealRoomSource(sourceId, updates) {
  const { data, error } = await supabase
    .from('deal_room_sources')
    .update(updates)
    .eq('id', sourceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDealRoomSource(tenantId, sourceId) {
  // Get storage path first
  const source = await getDealRoomSourceFull(tenantId, sourceId);
  if (source.storage_path) {
    await deleteFile(source.storage_path).catch((err) => {
      console.error('[deal-room] Failed to delete file from storage:', err.message);
    });
  }
  const { error } = await supabase
    .from('deal_room_sources')
    .delete()
    .eq('id', sourceId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

export async function getDealRoomMessages(tenantId, dealRoomId, { limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('deal_room_messages')
    .select('*')
    .eq('deal_room_id', dealRoomId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function createDealRoomMessage(tenantId, dealRoomId, messageData) {
  const { data, error } = await supabase
    .from('deal_room_messages')
    .insert({ tenant_id: tenantId, deal_room_id: dealRoomId, ...messageData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Deal Room Artifacts
// ---------------------------------------------------------------------------

export async function createDealRoomArtifact(tenantId, dealRoomId, data) {
  const { data: artifact, error } = await supabase
    .from('deal_room_artifacts')
    .insert({ tenant_id: tenantId, deal_room_id: dealRoomId, ...data })
    .select()
    .single();
  if (error) throw error;
  return artifact;
}

export async function updateDealRoomArtifact(artifactId, updates) {
  const { data, error } = await supabase
    .from('deal_room_artifacts')
    .update(updates)
    .eq('id', artifactId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDealRoomArtifacts(tenantId, dealRoomId) {
  const { data, error } = await supabase
    .from('deal_room_artifacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('deal_room_id', dealRoomId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Deal Room Audio
// ---------------------------------------------------------------------------

export async function createDealRoomAudio(tenantId, dealRoomId, data) {
  const { data: audio, error } = await supabase
    .from('deal_room_audio')
    .insert({ tenant_id: tenantId, deal_room_id: dealRoomId, ...data })
    .select()
    .single();
  if (error) throw error;
  return audio;
}

export async function updateDealRoomAudio(audioId, updates) {
  const { data, error } = await supabase
    .from('deal_room_audio')
    .update(updates)
    .eq('id', audioId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDealRoomAudios(tenantId, dealRoomId) {
  const { data, error } = await supabase
    .from('deal_room_audio')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('deal_room_id', dealRoomId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDealRoomAudio(tenantId, audioId) {
  const { data, error } = await supabase
    .from('deal_room_audio')
    .select('*')
    .eq('id', audioId)
    .eq('tenant_id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

export async function downloadFile(storagePath) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);
  if (error) throw error;
  return data; // Blob — use .arrayBuffer() to convert
}

// ---------------------------------------------------------------------------
// Powerflow State helpers
// ---------------------------------------------------------------------------

export async function getOrCreatePowerflowState(tenantId, localDate) {
  // Try to get existing state for today
  const { data: existing, error: fetchError } = await supabase
    .from('powerflow_state')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('local_date', localDate)
    .single();

  if (existing) return existing;

  // Create new state for today (new day = fresh pyramid)
  const { data: created, error: createError } = await supabase
    .from('powerflow_state')
    .insert({ tenant_id: tenantId, local_date: localDate })
    .select()
    .single();
  if (createError) throw createError;
  return created;
}

export async function updatePowerflowStage(tenantId, localDate, stageNumber) {
  const stageCol = `stage_${stageNumber}_completed`;
  const stageAtCol = `stage_${stageNumber}_completed_at`;

  // Only update if not already completed (idempotent)
  const state = await getOrCreatePowerflowState(tenantId, localDate);
  if (state[stageCol]) return state; // Already completed

  const { data, error } = await supabase
    .from('powerflow_state')
    .update({ [stageCol]: true, [stageAtCol]: new Date().toISOString() })
    .eq('id', state.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Opportunity query helpers (Sprint 0 — opportunities table)
// ---------------------------------------------------------------------------

export async function getOpportunities(tenantId, { limit = 200, orderBy = 'warmth_score', ascending = false } = {}) {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('stage', 'eq', 'ejected')
    .order(orderBy, { ascending })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getOpportunityById(tenantId, opportunityId) {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', opportunityId)
    .single();
  if (error) throw error;
  return data;
}

export async function getTenantById(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Audio Budget Tracking
// ---------------------------------------------------------------------------

/**
 * Check if the tenant has audio budget remaining for the current month.
 * Returns { allowed: boolean, remaining_cents, budget_cap_cents, total_cost_cents }.
 * ElevenLabs costs ~$0.30/1000 chars. Estimate ~$0.15 per briefing, ~$0.40 per podcast.
 */
export async function checkAudioBudget(tenantId, estimatedCostCents = 40) {
  const monthYear = new Date().toISOString().slice(0, 7); // e.g. '2026-04'

  // Upsert to ensure the row exists
  const { data, error } = await supabase
    .from('tenant_audio_usage')
    .upsert(
      { tenant_id: tenantId, month_year: monthYear },
      { onConflict: 'tenant_id,month_year', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    // If upsert fails, try a plain select
    const { data: existing } = await supabase
      .from('tenant_audio_usage')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month_year', monthYear)
      .single();

    if (existing) {
      const remaining = existing.budget_cap_cents - existing.total_cost_cents;
      return {
        allowed: remaining >= estimatedCostCents,
        remaining_cents: remaining,
        budget_cap_cents: existing.budget_cap_cents,
        total_cost_cents: existing.total_cost_cents,
        generation_count: existing.generation_count,
      };
    }

    // No row and upsert failed — allow by default (don't block on tracking failure)
    return { allowed: true, remaining_cents: 5000, budget_cap_cents: 5000, total_cost_cents: 0, generation_count: 0 };
  }

  const remaining = data.budget_cap_cents - data.total_cost_cents;
  return {
    allowed: remaining >= estimatedCostCents,
    remaining_cents: remaining,
    budget_cap_cents: data.budget_cap_cents,
    total_cost_cents: data.total_cost_cents,
    generation_count: data.generation_count,
  };
}

/**
 * Record audio generation cost after successful ElevenLabs call.
 */
export async function recordAudioCost(tenantId, costCents) {
  const monthYear = new Date().toISOString().slice(0, 7);

  const { error } = await supabase.rpc('increment_audio_usage', {
    p_tenant_id: tenantId,
    p_month_year: monthYear,
    p_cost_cents: costCents,
  });

  // If the RPC doesn't exist, fall back to a manual update
  if (error) {
    const { data: existing } = await supabase
      .from('tenant_audio_usage')
      .select('total_cost_cents, generation_count')
      .eq('tenant_id', tenantId)
      .eq('month_year', monthYear)
      .single();

    if (existing) {
      await supabase
        .from('tenant_audio_usage')
        .update({
          total_cost_cents: existing.total_cost_cents + costCents,
          generation_count: existing.generation_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('month_year', monthYear);
    }
  }
}

/**
 * Get tenant tab configuration. Returns sorted, visible tabs.
 * Falls back to null if no config exists (caller should use default BID tabs).
 */
export async function getTenantTabConfig(tenantId) {
  const { data, error } = await supabase
    .from('tenant_tab_config')
    .select('skill_key, tab_label, sort_order, is_visible')
    .eq('tenant_id', tenantId)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[supabase] getTenantTabConfig error:', error.message);
    return null;
  }
  return data && data.length > 0 ? data : null;
}

// ---------------------------------------------------------------------------
// Tenant middleware — validates X-Sandbox-Token header
// ---------------------------------------------------------------------------

export function tenantMiddleware() {
  return async (req, res, next) => {
    // Skip health checks and non-API routes
    if (!req.path?.startsWith('/api/') || req.path === '/api/health') {
      return next();
    }

    const token = req.headers['x-sandbox-token'];
    if (!token) {
      return res.status(401).json({ error: 'Missing X-Sandbox-Token header' });
    }

    try {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('sandbox_token', token)
        .eq('is_active', true)
        .single();

      if (error || !tenant) {
        return res.status(401).json({ error: 'Invalid or expired sandbox token' });
      }

      // Check expiry
      if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Sandbox token has expired' });
      }

      // Attach tenant to request
      req.tenant = tenant;
      next();
    } catch (err) {
      console.error('[tenantMiddleware] error:', err.message);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
}
