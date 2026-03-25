/**
 * Email Tool Execution Handler
 *
 * Dispatches Claude tool_use calls to the correct provider method.
 * Send/reply operations return pending_approval with a server-side draft.
 * Read operations execute immediately.
 *
 * All actions are logged to email_audit_log.
 */

import { getSupabase } from '../../lib/supabase.js';
import { getActiveAccount, createProvider, touchLastUsed } from './index.mjs';
import { ensureFreshToken } from './token-refresh.mjs';
import { logEmailAudit } from './audit.mjs';

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
    return {
      error: `Email authentication failed: ${err.message}. The user may need to reconnect from Settings.`,
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

async function handleSendEmail(input, tenantId, account, _provider) {
  const draft = {
    to: input.to,
    cc: input.cc || [],
    subject: input.subject,
    bodyHtml: input.body_html,
    importance: input.importance || 'normal',
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
    recipientsCount: (input.to?.length || 0) + (input.cc?.length || 0),
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
      subject: draft.subject,
      body_html: draft.bodyHtml,
      importance: draft.importance,
      from: account.email_address,
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

  // Get fresh token
  let accessToken;
  try {
    const result = await ensureFreshToken(draft.email_account_id);
    accessToken = result.accessToken;
  } catch (err) {
    return { success: false, error: `Authentication failed: ${err.message}` };
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

  try {
    if (draft.tool_name === 'send_email') {
      await provider.sendEmail({
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        bodyHtml: payload.bodyHtml,
        importance: payload.importance,
      });
    } else if (draft.tool_name === 'reply_to_email') {
      await provider.replyToMessage({
        messageId: payload.messageId,
        bodyHtml: payload.bodyHtml,
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
      recipientsCount: (payload.to?.length || 0) + (payload.cc?.length || 0),
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
