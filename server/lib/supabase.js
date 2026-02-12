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
