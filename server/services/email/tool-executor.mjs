/**
 * Email Tool Execution Handler
 *
 * Dispatches Claude tool_use calls to the correct provider method.
 * Send/reply operations return pending_approval with a server-side draft.
 * Read operations execute immediately.
 *
 * All actions are logged to email_audit_log.
 */

import { getSupabase, downloadFile } from '../../lib/supabase.js';
import { getActiveAccount, createProvider, touchLastUsed } from './index.mjs';
import { ensureFreshToken } from './token-refresh.mjs';
import { logEmailAudit } from './audit.mjs';
import { wrapEmailHtml } from '../../lib/email-html.js';

/**
 * Resolve attachment source_ids into { filename, contentType, contentBase64 } objects.
 * Fetches files from Supabase Storage via deal_room_sources table.
 */
async function resolveAttachments(attachmentInputs, tenantId) {
  if (!attachmentInputs || attachmentInputs.length === 0) return [];

  const supabase = getSupabase();
  const resolved = [];

  for (const att of attachmentInputs) {
    try {
      // Look up the source record
      const { data: source, error } = await supabase
        .from('deal_room_sources')
        .select('id, file_name, content_type, storage_path')
        .eq('id', att.source_id)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !source || !source.storage_path) {
        console.warn(`[email/attachments] Source not found: ${att.source_id}`);
        continue;
      }

      // Download from Supabase Storage
      const blob = await downloadFile(source.storage_path);
      const buffer = Buffer.from(await blob.arrayBuffer());
      const contentBase64 = buffer.toString('base64');

      resolved.push({
        filename: att.filename || source.file_name,
        contentType: source.content_type || 'application/octet-stream',
        contentBase64,
      });
    } catch (err) {
      console.error(`[email/attachments] Failed to resolve ${att.source_id}:`, err.message);
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Tool executors — one per tool name
// ---------------------------------------------------------------------------

/**
 * Execute an email tool call.
 *
 * @param {string} toolName - Tool name from Claude's tool_use block
 * @param {Object} toolInput - Tool input from Claude's tool_use block
 * @param {string} tenantId - Tenant UUID
 * @returns {Promise<Object>} Tool result for Claude
 */
export async function executeEmailTool(toolName, toolInput, tenantId) {
  // Get active email account for tenant
  const account = await getActiveAccount(tenantId);
  if (!account) {
    return {
      error: 'No email account connected. Ask the user to connect their email from Settings > Email.',
    };
  }

  // Ensure token is fresh
  let accessToken;
  try {
    const result = await ensureFreshToken(account.id);
    accessToken = result.accessToken;
  } catch (err) {
    const provider = account.provider === 'microsoft' ? 'Outlook' : 'Gmail';
    return {
      error: `Your ${provider} connection has expired. Go to Settings > Email and click "Reconnect ${provider}" to re-authorize.`,
    };
  }

  // Create provider
  const provider = createProvider(account.provider, accessToken);

  // Touch last_used_at
  touchLastUsed(account.id);

  // Dispatch to handler
  try {
    switch (toolName) {
      case 'send_email':
        return await handleSendEmail(toolInput, tenantId, account, provider);
      case 'list_emails':
        return await handleListEmails(toolInput, tenantId, account, provider);
      case 'search_emails':
        return await handleSearchEmails(toolInput, tenantId, account, provider);
      case 'get_email':
        return await handleGetEmail(toolInput, tenantId, account, provider);
      case 'reply_to_email':
        return await handleReplyToEmail(toolInput, tenantId, account, provider);
      default:
        return { error: `Unknown email tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[email/tool-executor] ${toolName} failed:`, err.message);

    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: toolName === 'reply_to_email' ? 'reply' : toolName.replace('_emails', '').replace('_email', ''),
      success: false,
      errorMessage: err.message,
    });

    return { error: `Email operation failed: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Send — stores draft server-side, returns pending_approval
// ---------------------------------------------------------------------------

/**
 * Basic email format validation.
 * Returns null if valid, or an error string if invalid.
 */
function validateEmailAddresses(recipients, fieldName) {
  if (!recipients || recipients.length === 0) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const r of recipients) {
    if (!r.email || !emailRegex.test(r.email)) {
      return `Invalid email address in ${fieldName}: "${r.email || '(empty)'}". Please fix and try again.`;
    }
  }
  return null;
}

async function handleSendEmail(input, tenantId, account, _provider) {
  // Validate email addresses
  const toErr = validateEmailAddresses(input.to, 'To');
  if (toErr) return { error: toErr };
  const ccErr = validateEmailAddresses(input.cc, 'CC');
  if (ccErr) return { error: ccErr };
  const bccErr = validateEmailAddresses(input.bcc, 'BCC');
  if (bccErr) return { error: bccErr };

  // Resolve attachments from Deal Room sources
  const attachments = await resolveAttachments(input.attachments, tenantId);

  const draft = {
    to: input.to,
    cc: input.cc || [],
    bcc: input.bcc || [],
    subject: input.subject,
    bodyHtml: input.body_html,
    importance: input.importance || 'normal',
    attachments,
  };

  // Store draft server-side (Flag 1: never trust frontend with draft payload)
  const supabase = getSupabase();
  const { data: draftRow, error } = await supabase
    .from('email_send_drafts')
    .insert({
      tenant_id: tenantId,
      email_account_id: account.id,
      tool_name: 'send_email',
      draft_payload: draft,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store email draft: ${error.message}`);
  }

  logEmailAudit({
    tenantId,
    userId: account.user_id,
    emailAccountId: account.id,
    actionType: 'send',
    success: true,
    recipientsCount: (input.to?.length || 0) + (input.cc?.length || 0) + (input.bcc?.length || 0),
    subject: input.subject,
    metadata: { status: 'pending_approval', draft_id: draftRow.id },
  });

  return {
    status: 'pending_approval',
    draft_id: draftRow.id,
    message: 'Email draft created. The user must review and approve before sending.',
    draft: {
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body_html: draft.bodyHtml,
      importance: draft.importance,
      from: account.email_address,
      attachments: (draft.attachments || []).map(a => ({ filename: a.filename, content_type: a.contentType })),
    },
  };
}

// ---------------------------------------------------------------------------
// Reply — stores draft server-side, returns pending_approval
// ---------------------------------------------------------------------------

async function handleReplyToEmail(input, tenantId, account, provider) {
  // Fetch the original message so we can show context in preview
  let originalSubject = '';
  try {
    const original = await provider.getMessage(input.message_id);
    originalSubject = original.subject || '';
  } catch {
    // Non-fatal — preview works without original subject
  }

  const draft = {
    messageId: input.message_id,
    bodyHtml: input.body_html,
    replyAll: input.reply_all || false,
    originalSubject,
  };

  const supabase = getSupabase();
  const { data: draftRow, error } = await supabase
    .from('email_send_drafts')
    .insert({
      tenant_id: tenantId,
      email_account_id: account.id,
      tool_name: 'reply_to_email',
      draft_payload: draft,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store reply draft: ${error.message}`);
  }

  logEmailAudit({
    tenantId,
    userId: account.user_id,
    emailAccountId: account.id,
    actionType: 'reply',
    success: true,
    messageId: input.message_id,
    subject: originalSubject,
    metadata: { status: 'pending_approval', draft_id: draftRow.id, reply_all: draft.replyAll },
  });

  return {
    status: 'pending_approval',
    draft_id: draftRow.id,
    message: 'Reply draft created. The user must review and approve before sending.',
    draft: {
      message_id: input.message_id,
      body_html: input.body_html,
      reply_all: draft.replyAll,
      original_subject: originalSubject,
      from: account.email_address,
    },
  };
}

// ---------------------------------------------------------------------------
// List — executes immediately
// ---------------------------------------------------------------------------

async function handleListEmails(input, tenantId, account, provider) {
  const result = await provider.listMessages({
    folder: input.folder || 'inbox',
    maxResults: Math.min(input.max_results || 10, 50),
    unreadOnly: input.unread_only || false,
  });

  logEmailAudit({
    tenantId,
    userId: account.user_id,
    emailAccountId: account.id,
    actionType: 'list',
    metadata: { folder: input.folder || 'inbox', count: result.messages.length },
  });

  return {
    emails: result.messages.map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      preview: m.bodyPreview,
      date: m.receivedAt,
      is_read: m.isRead,
      has_attachments: m.hasAttachments,
    })),
    total: result.totalCount,
    next_page_token: result.nextPageToken,
  };
}

// ---------------------------------------------------------------------------
// Search — executes immediately
// ---------------------------------------------------------------------------

async function handleSearchEmails(input, tenantId, account, provider) {
  const result = await provider.searchMessages({
    query: input.query,
    from: input.from,
    subject: input.subject,
    after: input.after,
    before: input.before,
    maxResults: Math.min(input.max_results || 10, 50),
  });

  logEmailAudit({
    tenantId,
    userId: account.user_id,
    emailAccountId: account.id,
    actionType: 'search',
    metadata: { query_length: input.query?.length || 0, count: result.messages.length },
  });

  return {
    emails: result.messages.map(m => ({
      id: m.id,
      from: m.from,
      subject: m.subject,
      preview: m.bodyPreview,
      date: m.receivedAt,
      is_read: m.isRead,
      has_attachments: m.hasAttachments,
    })),
    total: result.totalCount,
  };
}

// ---------------------------------------------------------------------------
// Get — executes immediately
// ---------------------------------------------------------------------------

async function handleGetEmail(input, tenantId, account, provider) {
  const message = await provider.getMessage(input.message_id);

  logEmailAudit({
    tenantId,
    userId: account.user_id,
    emailAccountId: account.id,
    actionType: 'get',
    messageId: input.message_id,
  });

  return {
    id: message.id,
    thread_id: message.threadId,
    from: message.from,
    to: message.to,
    cc: message.cc,
    subject: message.subject,
    body_text: message.bodyText,
    body_html: message.bodyHtml,
    date: message.receivedAt,
    is_read: message.isRead,
    has_attachments: message.hasAttachments,
    importance: message.importance,
  };
}

// ---------------------------------------------------------------------------
// Confirm send — called by frontend after user approves
// ---------------------------------------------------------------------------

/**
 * Execute a previously approved send/reply draft.
 * Called from POST /api/email/confirm-send endpoint.
 *
 * @param {string} draftId - UUID from email_send_drafts
 * @param {string} tenantId - Must match the draft's tenant_id
 * @returns {Promise<Object>} { success: boolean, error?: string }
 */
export async function confirmSend(draftId, tenantId) {
  const supabase = getSupabase();

  // Load draft — verify tenant ownership and status
  const { data: draft, error } = await supabase
    .from('email_send_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .single();

  if (error || !draft) {
    return { success: false, error: 'Draft not found, already sent, or expired.' };
  }

  // Check expiry
  if (new Date(draft.expires_at) < new Date()) {
    await supabase
      .from('email_send_drafts')
      .update({ status: 'expired' })
      .eq('id', draftId);
    return { success: false, error: 'Draft has expired. Please ask Plexi to draft the email again.' };
  }

  // Load account for provider info
  const { data: account } = await supabase
    .from('email_accounts')
    .select('provider, email_address, user_id')
    .eq('id', draft.email_account_id)
    .single();

  if (!account) {
    return { success: false, error: 'Email account not found.' };
  }

  // Get fresh token
  let accessToken;
  try {
    const result = await ensureFreshToken(draft.email_account_id);
    accessToken = result.accessToken;
  } catch (err) {
    const providerName = account.provider === 'microsoft' ? 'Outlook' : 'Gmail';
    return { success: false, error: `Your ${providerName} connection has expired. Go to Settings > Email and click "Reconnect ${providerName}" to re-authorize.` };
  }

  const provider = createProvider(account.provider, accessToken);
  const payload = draft.draft_payload;

  try {
    // Wrap body HTML with tenant template (hero/footer images, signature,
    // readable colors). This is the single chokepoint before anything reaches
    // the provider — parity with saveDraftToProvider and saveDraftDirect so
    // sent mail matches saved drafts.
    const wrappedHtml = await wrapEmailHtml(payload.bodyHtml, tenantId);

    if (draft.tool_name === 'send_email') {
      await provider.sendEmail({
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject: payload.subject,
        bodyHtml: wrappedHtml,
        importance: payload.importance,
        attachments: payload.attachments,
      });
    } else if (draft.tool_name === 'reply_to_email') {
      await provider.replyToMessage({
        messageId: payload.messageId,
        bodyHtml: wrappedHtml,
        replyAll: payload.replyAll,
      });
    }

    // Mark draft as sent
    await supabase
      .from('email_send_drafts')
      .update({ status: 'sent' })
      .eq('id', draftId);

    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: draft.email_account_id,
      actionType: draft.tool_name === 'reply_to_email' ? 'reply' : 'send',
      recipientsCount: (payload.to?.length || 0) + (payload.cc?.length || 0) + (payload.bcc?.length || 0),
      subject: payload.subject || payload.originalSubject,
      metadata: { draft_id: draftId, confirmed: true },
    });

    return { success: true };
  } catch (err) {
    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: draft.email_account_id,
      actionType: draft.tool_name === 'reply_to_email' ? 'reply' : 'send',
      success: false,
      errorMessage: err.message,
      metadata: { draft_id: draftId },
    });

    return { success: false, error: `Failed to send: ${err.message}` };
  }
}

/**
 * Save a PlexifyAEC draft to the user's actual Gmail/Outlook Drafts folder.
 * Same auth flow as confirmSend but calls provider.saveDraft() instead of sendEmail().
 *
 * @param {string} draftId - UUID from email_send_drafts
 * @param {string} tenantId - Must match the draft's tenant_id
 * @returns {Promise<Object>} { success: boolean, gmailDraftId?: string, error?: string }
 */
export async function saveDraftToProvider(draftId, tenantId) {
  const supabase = getSupabase();

  // Load draft — verify tenant ownership and status
  const { data: draft, error } = await supabase
    .from('email_send_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .single();

  if (error || !draft) {
    return { success: false, error: 'Draft not found, already sent, or expired.' };
  }

  // Check expiry
  if (new Date(draft.expires_at) < new Date()) {
    await supabase
      .from('email_send_drafts')
      .update({ status: 'expired' })
      .eq('id', draftId);
    return { success: false, error: 'Draft has expired. Please ask Plexi to draft the email again.' };
  }

  // Get fresh token
  let accessToken;
  try {
    const result = await ensureFreshToken(draft.email_account_id);
    accessToken = result.accessToken;
  } catch (err) {
    return { success: false, error: `Authentication failed: ${err.message}. Reconnect your email in Settings > Email.` };
  }

  // Load account for provider info
  const { data: account } = await supabase
    .from('email_accounts')
    .select('provider, email_address, user_id')
    .eq('id', draft.email_account_id)
    .single();

  if (!account) {
    return { success: false, error: 'Email account not found.' };
  }

  const provider = createProvider(account.provider, accessToken);
  const payload = draft.draft_payload;

  // Check if provider supports saveDraft
  if (typeof provider.saveDraft !== 'function') {
    return { success: false, error: `Save to Drafts is not supported for ${account.provider} accounts yet.` };
  }

  try {
    // Wrap body in email template with signature + readable colors
    const wrappedHtml = await wrapEmailHtml(payload.bodyHtml, tenantId);

    const result = await provider.saveDraft({
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      bodyHtml: wrappedHtml,
    });

    // Mark draft as saved (not sent — user can still send from Gmail)
    await supabase
      .from('email_send_drafts')
      .update({ status: 'saved_to_drafts' })
      .eq('id', draftId);

    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: draft.email_account_id,
      actionType: 'save_draft',
      recipientsCount: (payload.to?.length || 0) + (payload.cc?.length || 0),
      subject: payload.subject,
      metadata: { draft_id: draftId, gmail_draft_id: result.draftId },
    });

    return { success: true, gmailDraftId: result.draftId };
  } catch (err) {
    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: draft.email_account_id,
      actionType: 'save_draft',
      success: false,
      errorMessage: err.message,
      metadata: { draft_id: draftId },
    });

    return { success: false, error: `Failed to save draft: ${err.message}` };
  }
}

/**
 * Send an email directly through the connected provider — no DB draft, no
 * confirmation queue. Sibling of saveDraftDirect for callers (Sprint BATCH-50
 * batch send) that already have user-reviewed bodies and want immediate dispatch.
 *
 * Wraps the body in the standard email template (signature + readable colors)
 * and routes to provider.sendEmail (Microsoft: POST /me/sendMail; Gmail: send).
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} email - { to: string|string[], subject: string, bodyHtml: string }
 * @returns {Promise<Object>} { success: boolean, error?: string, providerName?: string }
 */
export async function sendDirect(tenantId, email) {
  const account = await getActiveAccount(tenantId);
  if (!account) {
    return { success: false, error: 'No email account connected. Connect Outlook or Gmail in Settings > Email.' };
  }

  let accessToken;
  try {
    const result = await ensureFreshToken(account.id);
    accessToken = result.accessToken;
  } catch {
    const providerName = account.provider === 'microsoft' ? 'Outlook' : 'Gmail';
    return { success: false, error: `Your ${providerName} connection has expired. Reconnect in Settings > Email.` };
  }

  const provider = createProvider(account.provider, accessToken);

  if (typeof provider.sendEmail !== 'function') {
    return { success: false, error: `Direct send is not supported for ${account.provider} accounts yet.` };
  }

  const toArray = Array.isArray(email.to) ? email.to : [email.to];
  const toFormatted = toArray.map(addr => (typeof addr === 'object' ? addr : { email: addr }));

  try {
    const rawBody = email.bodyHtml || `<p>${(email.body || '').replace(/\n/g, '<br/>')}</p>`;
    const wrappedHtml = await wrapEmailHtml(rawBody, tenantId);

    await provider.sendEmail({
      to: toFormatted,
      cc: email.cc || [],
      bcc: email.bcc || [],
      subject: email.subject,
      bodyHtml: wrappedHtml,
    });

    touchLastUsed(account.id);

    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'send',
      recipientsCount: toArray.length,
      subject: email.subject,
      metadata: { direct: true, source: 'batch_email' },
    });

    return { success: true, providerName: account.provider };
  } catch (err) {
    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'send',
      success: false,
      errorMessage: err.message,
      metadata: { direct: true, source: 'batch_email' },
    });

    return { success: false, error: `Failed to send: ${err.message}`, providerName: account.provider };
  }
}

/**
 * Save an email directly to Gmail Drafts from raw content (no DB draft needed).
 * Used by the one-click "Save to Drafts" button on OutreachPreview.
 *
 * @param {string} tenantId - Tenant UUID
 * @param {Object} email - { to: string|string[], subject: string, bodyHtml: string }
 * @returns {Promise<Object>} { success: boolean, error?: string }
 */
export async function saveDraftDirect(tenantId, email) {
  // Get active email account
  const account = await getActiveAccount(tenantId);
  if (!account) {
    return { success: false, error: 'No email account connected. Connect Gmail in Settings > Email.' };
  }

  // Get fresh token
  let accessToken;
  try {
    const result = await ensureFreshToken(account.id);
    accessToken = result.accessToken;
  } catch (err) {
    const providerName = account.provider === 'microsoft' ? 'Outlook' : 'Gmail';
    return { success: false, error: `Your ${providerName} connection has expired. Go to Settings > Email and click "Reconnect ${providerName}" to re-authorize.` };
  }

  const provider = createProvider(account.provider, accessToken);

  if (typeof provider.saveDraft !== 'function') {
    return { success: false, error: `Save to Drafts is not supported for ${account.provider} accounts yet.` };
  }

  // Normalize recipients to array format
  const toArray = Array.isArray(email.to) ? email.to : [email.to];
  const toFormatted = toArray.map(addr => {
    if (typeof addr === 'object') return addr;
    return { email: addr };
  });

  try {
    // Wrap body in email template with signature + readable colors
    const rawBody = email.bodyHtml || `<p>${(email.body || '').replace(/\n/g, '<br/>')}</p>`;
    const wrappedHtml = await wrapEmailHtml(rawBody, tenantId);

    const result = await provider.saveDraft({
      to: toFormatted,
      cc: email.cc || [],
      bcc: email.bcc || [],
      subject: email.subject,
      bodyHtml: wrappedHtml,
    });

    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'save_draft',
      recipientsCount: toArray.length,
      subject: email.subject,
      metadata: { direct: true, gmail_draft_id: result.draftId },
    });

    return { success: true, gmailDraftId: result.draftId };
  } catch (err) {
    logEmailAudit({
      tenantId,
      userId: account.user_id,
      emailAccountId: account.id,
      actionType: 'save_draft',
      success: false,
      errorMessage: err.message,
      metadata: { direct: true },
    });

    return { success: false, error: `Failed to save draft: ${err.message}` };
  }
}
