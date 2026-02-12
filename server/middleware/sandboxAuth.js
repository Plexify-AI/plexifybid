/**
 * PlexifySOLO — Sandbox authentication middleware
 *
 * Resolves sandbox token from (in priority order):
 *   1. Authorization: Bearer <token>
 *   2. ?token= query parameter
 *   3. X-Sandbox-Token header
 *
 * Validates against Supabase tenants table, checks expiry,
 * attaches full tenant object to req.tenant.
 * Logs all auth attempts (success + failure) to usage_events.
 */

import { getSupabase, logUsageEvent } from '../lib/supabase.js';

// Routes that skip auth entirely
const PUBLIC_PATHS = ['/api/health', '/api/auth/validate'];

/**
 * Extract token from request using priority order
 */
function extractToken(req) {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. ?token= query parameter
  // In Vite dev middleware, req.url contains the full path + query
  // In Express, req.query is parsed automatically
  if (req.query?.token) {
    return req.query.token;
  }
  // Fallback: parse from URL manually (for Vite dev middleware)
  const url = req.url || '';
  const match = url.match(/[?&]token=([^&]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  // 3. X-Sandbox-Token header
  const sandboxHeader = req.headers?.['x-sandbox-token'];
  if (sandboxHeader) {
    return sandboxHeader;
  }

  return null;
}

/**
 * Look up tenant by sandbox_token, validate active + not expired
 */
async function validateToken(token) {
  const supabase = getSupabase();

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('sandbox_token', token)
    .eq('is_active', true)
    .single();

  if (error || !tenant) {
    return { valid: false, error: 'Invalid sandbox token' };
  }

  if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
    return { valid: false, error: 'Sandbox access has expired' };
  }

  return { valid: true, tenant };
}

/**
 * Express/Vite middleware for sandbox auth
 */
export function sandboxAuth() {
  return async (req, res, next) => {
    const path = req.path || req.url?.split('?')[0] || '';

    // Skip non-API routes and public paths
    if (!path.startsWith('/api/') || PUBLIC_PATHS.includes(path)) {
      return next();
    }

    const token = extractToken(req);

    if (!token) {
      // Log failed attempt
      logUsageEvent(null, 'auth_failed', {
        reason: 'missing_token',
        path,
        ip: req.ip || req.socket?.remoteAddress,
      }).catch(() => {});

      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'Invalid or expired sandbox access',
        contact: 'ken@plexifyai.com',
      }));
    }

    const { valid, tenant, error } = await validateToken(token);

    if (!valid) {
      // Log failed attempt
      logUsageEvent(null, 'auth_failed', {
        reason: error,
        path,
        token_prefix: token.substring(0, 8) + '...',
      }).catch(() => {});

      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        error: 'Invalid or expired sandbox access',
        contact: 'ken@plexifyai.com',
      }));
    }

    // Log successful auth
    logUsageEvent(tenant.id, 'auth_success', {
      path,
      tenant_slug: tenant.slug,
    }).catch(() => {});

    // Attach tenant to request
    req.tenant = tenant;
    next();
  };
}

// Export validateToken for the /api/auth/validate route
export { validateToken, extractToken };
