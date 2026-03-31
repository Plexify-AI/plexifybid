/**
 * Email OAuth Routes
 *
 * Handles Microsoft OAuth connect/callback/disconnect/status.
 * OAuth callback goes BEFORE sandboxAuth (Microsoft redirect has no Bearer token).
 * Connect/disconnect/status go AFTER sandboxAuth (need tenant context).
 *
 * OAuth state parameter carries tenant_id + sandbox_token for callback validation.
 */

import { ConfidentialClientApplication } from '@azure/msal-node';
import { encrypt } from '../services/email/encryption.mjs';
import { upsertEmailAccount, getConnectionStatus, disconnectAccount } from '../services/email/index.mjs';
import { logEmailAudit } from '../services/email/audit.mjs';
import { validateToken } from '../middleware/sandboxAuth.js';

// ---------------------------------------------------------------------------
// MSAL configuration — lazy init
// ---------------------------------------------------------------------------

const SCOPES = ['Mail.Read', 'Mail.Send', 'User.Read', 'offline_access'];

let _msalApp = null;

function getMsalApp() {
  if (_msalApp) return _msalApp;

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      '[email-auth] MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set'
    );
  }

  _msalApp = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      // /common supports both personal (MSA) and work/school (M365) accounts
      authority: 'https://login.microsoftonline.com/common',
    },
  });

  return _msalApp;
}

function getRedirectUri() {
  const uri = process.env.MICROSOFT_REDIRECT_URI;
  if (!uri) {
    throw new Error('[email-auth] MICROSOFT_REDIRECT_URI must be set');
  }
  return uri;
}

// ---------------------------------------------------------------------------
// OAuth state management — in-memory with expiry
// ---------------------------------------------------------------------------

const pendingOAuthStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function createOAuthState(tenantId, sandboxToken) {
  const stateId = crypto.randomUUID();
  pendingOAuthStates.set(stateId, {
    tenantId,
    sandboxToken,
    createdAt: Date.now(),
  });

  // Cleanup expired states
  for (const [key, val] of pendingOAuthStates) {
    if (Date.now() - val.createdAt > STATE_TTL_MS) {
      pendingOAuthStates.delete(key);
    }
  }

  return stateId;
}

function consumeOAuthState(stateId) {
  const state = pendingOAuthStates.get(stateId);
  if (!state) return null;

  pendingOAuthStates.delete(stateId);

  if (Date.now() - state.createdAt > STATE_TTL_MS) {
    return null; // Expired
  }

  return state;
}

// ---------------------------------------------------------------------------
// Route handlers — PUBLIC (before sandboxAuth)
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/email/microsoft/callback
 *
 * Microsoft redirects here after user consents.
 * No sandbox token available — we recover tenant from the state parameter.
 */
export async function handleMicrosoftCallback(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code') || req.query?.code;
  const stateId = url.searchParams.get('state') || req.query?.state;
  const errorParam = url.searchParams.get('error') || req.query?.error;
  const errorDesc = url.searchParams.get('error_description') || req.query?.error_description;

  // Microsoft returned an error
  if (errorParam) {
    console.error(`[email-auth] Microsoft OAuth error: ${errorParam} — ${errorDesc}`);

    // M365 Business accounts may require IT admin to grant consent
    if (errorParam === 'admin_consent_required' || errorParam === 'consent_required') {
      const clientId = process.env.MICROSOFT_CLIENT_ID || '';
      // Recover tenant from state so we can pass sandbox token back
      const state = stateId ? consumeOAuthState(stateId) : null;
      const adminConsentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent(getRedirectUri())}`;
      const qs = `error=admin_consent_required&admin_consent_url=${encodeURIComponent(adminConsentUrl)}${state ? `&token=${encodeURIComponent(state.sandboxToken)}` : ''}`;
      return redirectToSettings(res, qs);
    }

    return redirectToSettings(res, `error=${encodeURIComponent(errorDesc || errorParam)}`);
  }

  if (!code || !stateId) {
    return redirectToSettings(res, 'error=missing_code_or_state');
  }

  // Recover tenant from state
  const state = consumeOAuthState(stateId);
  if (!state) {
    return redirectToSettings(res, 'error=invalid_or_expired_state');
  }

  // Validate the sandbox token is still valid
  const { valid, tenant } = await validateToken(state.sandboxToken);
  if (!valid) {
    return redirectToSettings(res, 'error=invalid_sandbox_token');
  }

  try {
    const msalApp = getMsalApp();

    // Exchange authorization code for tokens
    const tokenResponse = await msalApp.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
    });

    if (!tokenResponse || !tokenResponse.accessToken) {
      throw new Error('No access token in MSAL response');
    }

    // Get user profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
    });

    if (!profileRes.ok) {
      throw new Error(`Failed to get user profile: HTTP ${profileRes.status}`);
    }

    const profile = await profileRes.json();
    const emailAddress = profile.mail || profile.userPrincipalName || '';
    const displayName = profile.displayName || '';

    if (!emailAddress) {
      throw new Error('Could not determine email address from Microsoft profile');
    }

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokenResponse.accessToken);

    // MSAL may not always return a refresh token on first auth
    // For personal accounts with offline_access, it should
    const refreshToken = tokenResponse.refreshToken || tokenResponse.idToken || '';
    if (!refreshToken) {
      console.warn('[email-auth] No refresh token received — token refresh will fail');
    }
    const refreshTokenEncrypted = encrypt(refreshToken || 'none');

    // Calculate expiry
    const tokenExpiresAt = tokenResponse.expiresOn
      ? new Date(tokenResponse.expiresOn)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Store in database (upsert handles reconnect cleanly)
    const account = await upsertEmailAccount({
      tenantId: tenant.id,
      userId: tenant.id, // Phase 1: tenant = user
      provider: 'microsoft',
      emailAddress,
      displayName,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      scopes: SCOPES,
    });

    // Determine account type from token claims
    // tid 9188040d-... = Microsoft personal account (MSA); anything else = M365 work/school
    const tid = tokenResponse.idTokenClaims?.tid || '';
    const accountType = tid === '9188040d-6c67-4c5b-b112-36a304b66dad' ? 'personal' : 'work_school';

    // Audit log
    logEmailAudit({
      tenantId: tenant.id,
      userId: tenant.id,
      emailAccountId: account.id,
      actionType: 'connect',
      metadata: { provider: 'microsoft', email: emailAddress, account_type: accountType },
    });

    console.log(`[email-auth] Connected Microsoft account: ${emailAddress} for tenant ${tenant.slug}`);

    return redirectToSettings(res, `connected=true&token=${encodeURIComponent(state.sandboxToken)}`);
  } catch (err) {
    console.error('[email-auth] OAuth callback failed:', err.message);
    return redirectToSettings(res, `error=${encodeURIComponent(err.message)}`);
  }
}

// ---------------------------------------------------------------------------
// Route handlers — PROTECTED (after sandboxAuth, req.tenant available)
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/email/microsoft/connect
 *
 * Generates MSAL authorization URL and redirects user to Microsoft login.
 */
export async function handleMicrosoftConnect(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    // Extract the sandbox token from the request for state recovery
    const sandboxToken = extractSandboxToken(req);
    if (!sandboxToken) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Could not determine sandbox token' }));
    }

    const stateId = createOAuthState(tenant.id, sandboxToken);
    const msalApp = getMsalApp();

    const authUrl = await msalApp.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
      state: stateId,
      prompt: 'select_account',
    });

    // Redirect user to Microsoft login
    res.statusCode = 302;
    res.setHeader('Location', authUrl);
    return res.end();
  } catch (err) {
    console.error('[email-auth] Connect failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `Failed to initiate OAuth: ${err.message}` }));
  }
}

/**
 * POST /api/auth/email/disconnect
 */
export async function handleEmailDisconnect(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    await disconnectAccount(tenant.id);

    logEmailAudit({
      tenantId: tenant.id,
      userId: tenant.id,
      actionType: 'disconnect',
      metadata: { provider: 'microsoft' },
    });

    console.log(`[email-auth] Disconnected email for tenant ${tenant.slug}`);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('[email-auth] Disconnect failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * GET /api/auth/email/status
 */
export async function handleEmailStatus(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const status = await getConnectionStatus(tenant.id);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(status));
  } catch (err) {
    console.error('[email-auth] Status check failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function redirectToSettings(res, queryString) {
  res.statusCode = 302;
  res.setHeader('Location', `/settings/email?${queryString}`);
  return res.end();
}

function extractSandboxToken(req) {
  // From Authorization header
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // From query parameter
  if (req.query?.token) return req.query.token;
  const url = req.url || '';
  const match = url.match(/[?&]token=([^&]+)/);
  if (match) return decodeURIComponent(match[1]);

  // From custom header
  return req.headers?.['x-sandbox-token'] || null;
}
