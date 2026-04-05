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
import { google } from 'googleapis';
import { encrypt } from '../services/email/encryption.mjs';
import { upsertEmailAccount, getConnectionStatus, disconnectAccount } from '../services/email/index.mjs';
import { logEmailAudit } from '../services/email/audit.mjs';
import { validateToken } from '../middleware/sandboxAuth.js';

// ---------------------------------------------------------------------------
// MSAL configuration — lazy init
// ---------------------------------------------------------------------------

const SCOPES = ['Mail.Read', 'Mail.ReadWrite', 'Mail.Send', 'User.Read', 'offline_access'];  // Mail.ReadWrite required for Save as Draft (POST /me/messages)

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

function getRedirectUri(provider = 'microsoft') {
  if (provider === 'gmail') {
    if (process.env.NODE_ENV !== 'production' && process.env.GOOGLE_REDIRECT_URI_DEV) {
      return process.env.GOOGLE_REDIRECT_URI_DEV;
    }
    const uri = process.env.GOOGLE_REDIRECT_URI;
    if (!uri) throw new Error('[email-auth] GOOGLE_REDIRECT_URI must be set');
    return uri;
  }

  // Microsoft (default)
  if (process.env.NODE_ENV !== 'production' && process.env.MICROSOFT_REDIRECT_URI_DEV) {
    return process.env.MICROSOFT_REDIRECT_URI_DEV;
  }
  const uri = process.env.MICROSOFT_REDIRECT_URI;
  if (!uri) throw new Error('[email-auth] MICROSOFT_REDIRECT_URI must be set');
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
    return redirectToSettings(res, 'error=invalid_sandbox_token', state.sandboxToken);
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

    return redirectToSettings(res, 'connected=true', state.sandboxToken);
  } catch (err) {
    console.error('[email-auth] OAuth callback failed:', err.message);
    return redirectToSettings(res, `error=${encodeURIComponent(err.message)}`, state.sandboxToken);
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

function redirectToSettings(res, queryString, sandboxToken) {
  if (sandboxToken) {
    // Re-establish sandbox auth via /sandbox, then redirect to settings
    const settingsPath = `/settings/email?${queryString}`;
    const url = `/sandbox?token=${encodeURIComponent(sandboxToken)}&redirect=${encodeURIComponent(settingsPath)}`;
    res.statusCode = 302;
    res.setHeader('Location', url);
    return res.end();
  }
  // Fallback (error cases where we may not have the token)
  res.statusCode = 302;
  res.setHeader('Location', `/settings/email?${queryString}`);
  return res.end();
}

// ===========================================================================
// GOOGLE OAUTH
// ===========================================================================

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',  // Required for drafts.create (Save as Draft)
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

let _googleOAuth2 = null;

function getGoogleOAuth2() {
  if (_googleOAuth2) return _googleOAuth2;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[email-auth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  _googleOAuth2 = new google.auth.OAuth2(clientId, clientSecret, getRedirectUri('gmail'));
  return _googleOAuth2;
}

/**
 * GET /api/auth/email/gmail/connect
 *
 * Generates Google OAuth URL and redirects user to Google consent screen.
 */
export async function handleGmailConnect(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    const sandboxToken = extractSandboxToken(req);
    if (!sandboxToken) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Could not determine sandbox token' }));
    }

    const stateId = createOAuthState(tenant.id, sandboxToken);
    const oauth2Client = getGoogleOAuth2();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state: stateId,
    });

    res.statusCode = 302;
    res.setHeader('Location', authUrl);
    return res.end();
  } catch (err) {
    console.error('[email-auth] Gmail connect failed:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: `Failed to initiate Gmail OAuth: ${err.message}` }));
  }
}

/**
 * GET /api/auth/email/gmail/callback
 *
 * Google redirects here after user consents.
 * No sandbox token — recover tenant from the state parameter.
 */
export async function handleGmailCallback(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code') || req.query?.code;
  const stateId = url.searchParams.get('state') || req.query?.state;
  const errorParam = url.searchParams.get('error') || req.query?.error;

  if (errorParam) {
    console.error(`[email-auth] Google OAuth error: ${errorParam}`);
    return redirectToSettings(res, `error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !stateId) {
    return redirectToSettings(res, 'error=missing_code_or_state');
  }

  const state = consumeOAuthState(stateId);
  if (!state) {
    return redirectToSettings(res, 'error=invalid_or_expired_state');
  }

  const { valid, tenant } = await validateToken(state.sandboxToken);
  if (!valid) {
    return redirectToSettings(res, 'error=invalid_sandbox_token', state.sandboxToken);
  }

  try {
    const oauth2Client = getGoogleOAuth2();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token in Google response');
    }

    // Get user profile
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const emailAddress = profile.email || '';
    const displayName = profile.name || '';

    if (!emailAddress) {
      throw new Error('Could not determine email address from Google profile');
    }

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokens.access_token);
    const refreshToken = tokens.refresh_token || '';
    if (!refreshToken) {
      console.warn('[email-auth] No refresh token from Google — token refresh will fail');
    }
    const refreshTokenEncrypted = encrypt(refreshToken || 'none');

    // Calculate expiry
    const tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Store in database
    const account = await upsertEmailAccount({
      tenantId: tenant.id,
      userId: tenant.id,
      provider: 'gmail',
      emailAddress,
      displayName,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      scopes: GOOGLE_SCOPES,
    });

    logEmailAudit({
      tenantId: tenant.id,
      userId: tenant.id,
      emailAccountId: account.id,
      actionType: 'connect',
      metadata: { provider: 'gmail', email: emailAddress },
    });

    console.log(`[email-auth] Connected Gmail account: ${emailAddress} for tenant ${tenant.slug}`);

    return redirectToSettings(res, 'connected=true&provider=gmail', state.sandboxToken);
  } catch (err) {
    console.error('[email-auth] Gmail callback failed:', err.message);
    return redirectToSettings(res, `error=${encodeURIComponent(err.message)}`, state.sandboxToken);
  }
}

// ---------------------------------------------------------------------------

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
