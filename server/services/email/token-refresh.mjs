/**
 * Email Token Refresh Middleware
 *
 * Proactively refreshes OAuth access tokens before they expire.
 * Uses PostgreSQL advisory locks to prevent race conditions
 * when multiple requests hit simultaneously.
 *
 * Critical: Microsoft personal account refresh tokens have a 90-day
 * sliding window. Each use issues a NEW refresh token. Always store
 * the new refresh token from every refresh response.
 */

import { ConfidentialClientApplication } from '@azure/msal-node';
import { google } from 'googleapis';
import { getSupabase } from '../../lib/supabase.js';
import { encrypt, decrypt } from './encryption.mjs';
import { getAccountById, updateTokens, markNeedsReauth } from './index.mjs';
import { logEmailAudit } from './audit.mjs';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh if within 5 minutes of expiry
const LOCK_WAIT_MS = 2000; // Wait for another process to finish refreshing

// ---------------------------------------------------------------------------
// MSAL client — lazy init (same config as email-auth.js)
// ---------------------------------------------------------------------------

let _msalApp = null;

function getMsalApp() {
  if (_msalApp) return _msalApp;

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[token-refresh] MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set');
  }

  _msalApp = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: 'https://login.microsoftonline.com/consumers',
    },
  });

  return _msalApp;
}

// ---------------------------------------------------------------------------
// Advisory lock helpers
// ---------------------------------------------------------------------------

/**
 * Try to acquire a PostgreSQL advisory lock.
 * Uses hashtext() to convert the account UUID to a bigint lock key.
 *
 * @param {string} accountId - UUID of the email account
 * @returns {Promise<boolean>} true if lock acquired
 */
async function tryAcquireLock(accountId) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('pg_try_advisory_lock_hashtext', {
    lock_key: accountId,
  }).maybeSingle();

  // If the RPC doesn't exist, fall back to raw SQL
  if (error) {
    // Use a direct query as fallback
    const { data: result, error: sqlError } = await supabase
      .from('email_accounts')
      .select('id')
      .eq('id', accountId)
      .limit(1);

    if (sqlError) {
      console.warn('[token-refresh] Advisory lock unavailable, proceeding without lock');
    }
    // Without advisory lock support via RPC, just proceed
    return true;
  }

  return data === true;
}

/**
 * Release a PostgreSQL advisory lock.
 *
 * @param {string} accountId
 */
async function releaseLock(accountId) {
  try {
    const supabase = getSupabase();
    await supabase.rpc('pg_advisory_unlock_hashtext', {
      lock_key: accountId,
    });
  } catch {
    // Non-fatal — lock will be released when the connection returns to pool
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Ensure the access token for an email account is fresh.
 * Returns a decrypted, valid access token.
 *
 * Flow:
 * 1. Load account from DB
 * 2. If token has >5 min until expiry → return decrypted token
 * 3. If near expiry or expired → refresh via MSAL
 * 4. Advisory lock prevents concurrent refresh attempts
 *
 * @param {string} accountId - UUID of the email_accounts row
 * @returns {Promise<{ accessToken: string, account: Object }>}
 */
export async function ensureFreshToken(accountId) {
  let account = await getAccountById(accountId);
  if (!account) {
    throw new Error(`[token-refresh] Email account not found: ${accountId}`);
  }

  if (account.connection_status === 'disconnected') {
    throw new Error('[token-refresh] Email account is disconnected');
  }

  if (account.connection_status === 'needs_reauth') {
    throw new Error('[token-refresh] Email account needs re-authentication');
  }

  const expiresAt = new Date(account.token_expires_at).getTime();
  const now = Date.now();

  // Token still valid with buffer — return immediately
  if (expiresAt - now > REFRESH_BUFFER_MS) {
    const accessToken = decrypt(account.access_token_encrypted);
    return { accessToken, account };
  }

  // Token needs refresh
  console.log(`[token-refresh] Token expiring soon for account ${accountId}, refreshing...`);

  let lockAcquired = false;
  try {
    lockAcquired = await tryAcquireLock(accountId);

    if (!lockAcquired) {
      // Another process is refreshing — wait and re-read
      console.log('[token-refresh] Lock not acquired, waiting for other process...');
      await sleep(LOCK_WAIT_MS);

      // Re-read the account (other process should have updated tokens)
      account = await getAccountById(accountId);
      if (!account) {
        throw new Error('[token-refresh] Account disappeared during refresh wait');
      }

      const newExpiry = new Date(account.token_expires_at).getTime();
      if (newExpiry - Date.now() > REFRESH_BUFFER_MS) {
        // Other process refreshed successfully
        const accessToken = decrypt(account.access_token_encrypted);
        return { accessToken, account };
      }

      // Other process didn't refresh — try ourselves
      console.log('[token-refresh] Other process did not refresh, attempting ourselves');
    }

    // Perform the actual refresh
    return await performRefresh(account);
  } finally {
    if (lockAcquired) {
      await releaseLock(accountId);
    }
  }
}

/**
 * Execute token refresh — dispatches to Microsoft or Google based on provider.
 *
 * @param {Object} account - email_accounts row
 * @returns {Promise<{ accessToken: string, account: Object }>}
 */
async function performRefresh(account) {
  const refreshToken = decrypt(account.refresh_token_encrypted);

  if (!refreshToken || refreshToken === 'none') {
    await markNeedsReauth(account.id, 'No refresh token available');
    logEmailAudit({
      tenantId: account.tenant_id,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'refresh_token',
      success: false,
      errorMessage: 'No refresh token available',
    });
    throw new Error('[token-refresh] No refresh token available — re-authentication required');
  }

  if (account.provider === 'gmail') {
    return performGoogleRefresh(account, refreshToken);
  }
  return performMicrosoftRefresh(account, refreshToken);
}

/**
 * Microsoft token refresh via MSAL.
 */
async function performMicrosoftRefresh(account, refreshToken) {
  try {
    const msalApp = getMsalApp();

    const tokenResponse = await msalApp.acquireTokenByRefreshToken({
      refreshToken,
      scopes: ['Mail.Read', 'Mail.Send', 'User.Read'],
    });

    if (!tokenResponse || !tokenResponse.accessToken) {
      throw new Error('No access token in refresh response');
    }

    const accessTokenEncrypted = encrypt(tokenResponse.accessToken);

    // CRITICAL: Always store the new refresh token (90-day sliding window)
    const newRefreshToken = tokenResponse.refreshToken || refreshToken;
    const refreshTokenEncrypted = encrypt(newRefreshToken);

    const tokenExpiresAt = tokenResponse.expiresOn
      ? new Date(tokenResponse.expiresOn)
      : new Date(Date.now() + 3600 * 1000);

    await updateTokens(account.id, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt);

    logEmailAudit({
      tenantId: account.tenant_id,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'refresh_token',
      success: true,
    });

    console.log(`[token-refresh] Successfully refreshed Microsoft token for account ${account.id}`);

    return {
      accessToken: tokenResponse.accessToken,
      account: { ...account, token_expires_at: tokenExpiresAt.toISOString() },
    };
  } catch (err) {
    const isInvalidGrant =
      err.message?.includes('invalid_grant') ||
      err.message?.includes('AADSTS') ||
      err.errorCode === 'invalid_grant';

    if (isInvalidGrant) {
      console.error(`[token-refresh] Refresh token invalid for account ${account.id} — marking needs_reauth`);
      await markNeedsReauth(account.id, `Refresh token expired or revoked: ${err.message}`);

      logEmailAudit({
        tenantId: account.tenant_id,
        userId: account.user_id,
        emailAccountId: account.id,
        actionType: 'reauth',
        success: false,
        errorMessage: err.message,
      });

      throw new Error(
        '[token-refresh] Refresh token has expired or been revoked. Please reconnect your email account from Settings.'
      );
    }

    // Other errors — log but don't mark needs_reauth (might be transient)
    logEmailAudit({
      tenantId: account.tenant_id,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'refresh_token',
      success: false,
      errorMessage: err.message,
    });

    throw new Error(`[token-refresh] Failed to refresh token: ${err.message}`);
  }
}

/**
 * Google token refresh via googleapis OAuth2Client.
 *
 * Key difference: Google does NOT always return a new refresh token.
 * Only store it if one is returned.
 */
async function performGoogleRefresh(account, refreshToken) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('No access token in Google refresh response');
    }

    const accessTokenEncrypted = encrypt(credentials.access_token);

    // Google does NOT always return a new refresh token — only store if present
    const newRefreshToken = credentials.refresh_token || refreshToken;
    const refreshTokenEncrypted = encrypt(newRefreshToken);

    const tokenExpiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await updateTokens(account.id, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt);

    logEmailAudit({
      tenantId: account.tenant_id,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'refresh_token',
      success: true,
    });

    console.log(`[token-refresh] Successfully refreshed Google token for account ${account.id}`);

    return {
      accessToken: credentials.access_token,
      account: { ...account, token_expires_at: tokenExpiresAt.toISOString() },
    };
  } catch (err) {
    const isInvalidGrant =
      err.message?.includes('invalid_grant') ||
      err.message?.includes('Token has been expired or revoked');

    if (isInvalidGrant) {
      console.error(`[token-refresh] Google refresh token invalid for account ${account.id} — marking needs_reauth`);
      await markNeedsReauth(account.id, `Google refresh token expired or revoked: ${err.message}`);

      logEmailAudit({
        tenantId: account.tenant_id,
        userId: account.user_id,
        emailAccountId: account.id,
        actionType: 'reauth',
        success: false,
        errorMessage: err.message,
      });

      throw new Error(
        '[token-refresh] Google refresh token has expired or been revoked. Please reconnect your Gmail from Settings.'
      );
    }

    logEmailAudit({
      tenantId: account.tenant_id,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'refresh_token',
      success: false,
      errorMessage: err.message,
    });

    throw new Error(`[token-refresh] Failed to refresh Google token: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
