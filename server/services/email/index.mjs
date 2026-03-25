/**
 * Email Service Orchestrator
 *
 * Central entry point for email operations.
 * Resolves the correct provider adapter, manages account lookups,
 * and checks connection status.
 */

import { getSupabase } from '../../lib/supabase.js';
import { decrypt } from './encryption.mjs';
import { createMicrosoftProvider } from './providers/microsoft.mjs';
import { createGmailProvider } from './providers/gmail.mjs';
import { EMAIL_PROVIDERS, CONNECTION_STATUS } from './types.mjs';

// ---------------------------------------------------------------------------
// Account queries
// ---------------------------------------------------------------------------

/**
 * Get the first active email account for a tenant.
 * Phase 1: single-account per tenant.
 *
 * @param {string} tenantId
 * @returns {Promise<Object|null>} email_accounts row or null
 */
export async function getActiveAccount(tenantId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('connection_status', CONNECTION_STATUS.ACTIVE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[email] Failed to get active account:', error.message);
    return null;
  }

  return data;
}

/**
 * Get an email account by ID.
 *
 * @param {string} accountId
 * @returns {Promise<Object|null>}
 */
export async function getAccountById(accountId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) {
    console.error('[email] Failed to get account by id:', error.message);
    return null;
  }

  return data;
}

/**
 * Check if a tenant has an active email connection.
 * Lightweight check — no token decryption.
 *
 * @param {string} tenantId
 * @returns {Promise<boolean>}
 */
export async function hasActiveEmailConnection(tenantId) {
  const account = await getActiveAccount(tenantId);
  return account !== null;
}

/**
 * Get connection status for a tenant (for the settings UI).
 *
 * @param {string} tenantId
 * @returns {Promise<Object>} { connected, provider, email, status, lastError }
 */
export async function getConnectionStatus(tenantId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('email_accounts')
    .select('id, provider, email_address, display_name, connection_status, last_error, last_used_at')
    .eq('tenant_id', tenantId)
    .neq('connection_status', CONNECTION_STATUS.DISCONNECTED)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { connected: false, provider: null, email: null, status: 'disconnected', lastError: null };
  }

  return {
    connected: data.connection_status === CONNECTION_STATUS.ACTIVE,
    provider: data.provider,
    email: data.email_address,
    displayName: data.display_name,
    status: data.connection_status,
    lastError: data.last_error,
    lastUsedAt: data.last_used_at,
    accountId: data.id,
  };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Create a provider adapter for a given access token and provider type.
 *
 * @param {string} provider - 'microsoft' or 'gmail'
 * @param {string} accessToken - Decrypted access token
 * @returns {import('./types.mjs').EmailProvider}
 */
export function createProvider(provider, accessToken) {
  switch (provider) {
    case EMAIL_PROVIDERS.MICROSOFT:
      return createMicrosoftProvider(accessToken);
    case EMAIL_PROVIDERS.GMAIL:
      return createGmailProvider(accessToken);
    default:
      throw new Error(`[email] Unknown provider: ${provider}`);
  }
}

/**
 * Get a ready-to-use provider for an email account.
 * Decrypts the access token and returns the provider adapter.
 * Does NOT handle token refresh — call ensureFreshToken() first.
 *
 * @param {Object} account - email_accounts row (must have access_token_encrypted, provider)
 * @returns {import('./types.mjs').EmailProvider}
 */
export function getProviderFromAccount(account) {
  if (!account) {
    throw new Error('[email] No email account provided');
  }

  if (account.connection_status === CONNECTION_STATUS.DISCONNECTED) {
    throw new Error('[email] Email account is disconnected. Please reconnect from Settings.');
  }

  if (account.connection_status === CONNECTION_STATUS.NEEDS_REAUTH) {
    throw new Error('[email] Email account needs re-authentication. Please reconnect from Settings.');
  }

  // Decrypt access token
  const accessToken = decrypt(account.access_token_encrypted);
  return createProvider(account.provider, accessToken);
}

// ---------------------------------------------------------------------------
// Account management
// ---------------------------------------------------------------------------

/**
 * Store or update an email account after OAuth.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.provider
 * @param {string} params.emailAddress
 * @param {string} params.displayName
 * @param {Buffer} params.accessTokenEncrypted
 * @param {Buffer} params.refreshTokenEncrypted
 * @param {Date} params.tokenExpiresAt
 * @param {string[]} params.scopes
 * @returns {Promise<Object>} Upserted email_accounts row
 */
export async function upsertEmailAccount({
  tenantId,
  userId,
  provider,
  emailAddress,
  displayName,
  accessTokenEncrypted,
  refreshTokenEncrypted,
  tokenExpiresAt,
  scopes,
}) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('email_accounts')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        provider,
        email_address: emailAddress,
        display_name: displayName,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt.toISOString(),
        scopes,
        connection_status: CONNECTION_STATUS.ACTIVE,
        last_error: null,
      },
      { onConflict: 'tenant_id,provider,email_address' }
    )
    .select()
    .single();

  if (error) throw new Error(`[email] Failed to upsert email account: ${error.message}`);
  return data;
}

/**
 * Update tokens after a refresh.
 *
 * @param {string} accountId
 * @param {Buffer} accessTokenEncrypted
 * @param {Buffer} refreshTokenEncrypted
 * @param {Date} tokenExpiresAt
 */
export async function updateTokens(accountId, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('email_accounts')
    .update({
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_expires_at: tokenExpiresAt.toISOString(),
      connection_status: CONNECTION_STATUS.ACTIVE,
      last_error: null,
    })
    .eq('id', accountId);

  if (error) throw new Error(`[email] Failed to update tokens: ${error.message}`);
}

/**
 * Mark an account as needing re-authentication.
 *
 * @param {string} accountId
 * @param {string} errorMessage
 */
export async function markNeedsReauth(accountId, errorMessage) {
  const supabase = getSupabase();
  await supabase
    .from('email_accounts')
    .update({
      connection_status: CONNECTION_STATUS.NEEDS_REAUTH,
      last_error: errorMessage,
    })
    .eq('id', accountId);
}

/**
 * Disconnect an email account (clear tokens, set disconnected).
 *
 * @param {string} tenantId
 * @param {string} [accountId] - If not provided, disconnects all for tenant
 */
export async function disconnectAccount(tenantId, accountId = null) {
  const supabase = getSupabase();
  let query = supabase
    .from('email_accounts')
    .update({
      connection_status: CONNECTION_STATUS.DISCONNECTED,
      last_error: null,
    })
    .eq('tenant_id', tenantId);

  if (accountId) {
    query = query.eq('id', accountId);
  }

  const { error } = await query;
  if (error) throw new Error(`[email] Failed to disconnect: ${error.message}`);
}

/**
 * Update last_used_at timestamp (fire-and-forget).
 *
 * @param {string} accountId
 */
export function touchLastUsed(accountId) {
  const supabase = getSupabase();
  supabase
    .from('email_accounts')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', accountId)
    .then(({ error }) => {
      if (error) console.error('[email] Failed to update last_used_at:', error.message);
    });
}
