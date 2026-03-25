/**
 * Email Audit Logger
 *
 * Logs every email action to email_audit_log.
 * Fire-and-forget pattern (non-blocking, matches powerflow trigger pattern).
 * Hashes subjects with SHA-256 for correlation without storing plaintext PII.
 */

import { createHash } from 'crypto';
import { getSupabase } from '../../lib/supabase.js';

/**
 * Hash a subject line with SHA-256 for audit storage.
 * @param {string} subject
 * @returns {string} hex-encoded hash
 */
export function hashSubject(subject) {
  if (!subject) return null;
  return createHash('sha256').update(subject).digest('hex');
}

/**
 * Log an email action to the audit table.
 * Non-blocking — errors are logged but never thrown.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} [params.emailAccountId]
 * @param {string} params.actionType - 'send'|'reply'|'list'|'search'|'get'|'connect'|'disconnect'|'refresh_token'|'reauth'
 * @param {boolean} [params.success=true]
 * @param {string} [params.errorMessage]
 * @param {number} [params.recipientsCount=0]
 * @param {string} [params.subject] - Will be SHA-256 hashed before storage
 * @param {string} [params.messageId] - Graph/Gmail message ID
 * @param {Object} [params.metadata={}]
 */
export function logEmailAudit({
  tenantId,
  userId,
  emailAccountId = null,
  actionType,
  success = true,
  errorMessage = null,
  recipientsCount = 0,
  subject = null,
  messageId = null,
  metadata = {},
}) {
  // Fire and forget
  const supabase = getSupabase();

  supabase
    .from('email_audit_log')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      email_account_id: emailAccountId,
      action_type: actionType,
      success,
      error_message: errorMessage,
      recipients_count: recipientsCount,
      subject_hash: hashSubject(subject),
      message_id: messageId,
      metadata,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[email/audit] Failed to log audit entry:', error.message);
      }
    })
    .catch((err) => {
      console.error('[email/audit] Unexpected error logging audit:', err.message);
    });
}
