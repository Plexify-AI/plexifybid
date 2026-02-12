/**
 * PlexifySOLO — Auth routes
 *
 * POST /api/auth/validate
 * Accepts: { token: string }
 * Returns: { valid: true, tenant: { name, company, slug } } or { valid: false, error }
 *
 * This route is PUBLIC (no auth middleware) — it IS the auth check.
 */

import { validateToken } from '../middleware/sandboxAuth.js';

export async function handleValidate(req, res, body) {
  const { token } = body || {};

  if (!token || typeof token !== 'string') {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      valid: false,
      error: 'Missing token in request body',
    }));
  }

  try {
    const { valid, tenant, error } = await validateToken(token);

    if (!valid) {
      res.statusCode = 200; // 200 with valid:false (not a server error)
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        valid: false,
        error: error || 'Invalid or expired sandbox access',
        contact: 'ken@plexifyai.com',
      }));
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      valid: true,
      tenant: {
        name: tenant.name,
        company: tenant.company,
        slug: tenant.slug,
        features: tenant.features,
      },
    }));
  } catch (err) {
    console.error('[auth/validate] Error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      valid: false,
      error: 'Validation failed. Please try again.',
    }));
  }
}
