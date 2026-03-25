/**
 * Microsoft Graph Email Adapter
 *
 * Implements the unified email provider interface using Microsoft Graph API.
 * Targets personal Outlook.com accounts (uses /me/ endpoint, not /users/{id}/).
 *
 * Rate limits: 10,000 requests per 10 min per app per mailbox.
 * Max 4 concurrent requests per app per mailbox.
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { FOLDER_MAP } from '../types.mjs';

/**
 * Create a Microsoft Graph adapter for a specific access token.
 *
 * @param {string} accessToken - Decrypted OAuth access token
 * @returns {import('../types.mjs').EmailProvider}
 */
export function createMicrosoftProvider(accessToken) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Map a Graph message object to our EmailMessage shape. */
  function mapMessage(msg) {
    return {
      id: msg.id,
      threadId: msg.conversationId || null,
      from: msg.from?.emailAddress
        ? { name: msg.from.emailAddress.name || '', email: msg.from.emailAddress.address }
        : { name: '', email: '' },
      to: (msg.toRecipients || []).map(r => ({
        name: r.emailAddress?.name || '',
        email: r.emailAddress?.address || '',
      })),
      cc: (msg.ccRecipients || []).map(r => ({
        name: r.emailAddress?.name || '',
        email: r.emailAddress?.address || '',
      })),
      bcc: (msg.bccRecipients || []).map(r => ({
        name: r.emailAddress?.name || '',
        email: r.emailAddress?.address || '',
      })),
      subject: msg.subject || '(no subject)',
      bodyPreview: (msg.bodyPreview || '').substring(0, 200),
      bodyHtml: msg.body?.contentType === 'html' ? (msg.body?.content || '') : '',
      bodyText: msg.body?.contentType === 'text' ? (msg.body?.content || '') : (msg.bodyPreview || ''),
      receivedAt: msg.receivedDateTime || msg.createdDateTime || '',
      isRead: msg.isRead ?? false,
      hasAttachments: msg.hasAttachments ?? false,
      importance: msg.importance || 'normal',
    };
  }

  /** Resolve folder name to Graph wellKnownName. */
  function resolveFolder(folder) {
    const key = (folder || 'inbox').toLowerCase();
    return FOLDER_MAP[key] || key;
  }

  /** Standard $select to keep payloads small for list/search. */
  const LIST_SELECT = [
    'id', 'conversationId', 'subject', 'bodyPreview', 'from',
    'toRecipients', 'ccRecipients', 'receivedDateTime',
    'isRead', 'hasAttachments', 'importance',
  ].join(',');

  /** Full $select for getMessage (includes body). */
  const FULL_SELECT = [
    ...LIST_SELECT.split(','),
    'body', 'bccRecipients', 'createdDateTime',
  ].join(',');

  // -------------------------------------------------------------------------
  // Provider methods
  // -------------------------------------------------------------------------

  /**
   * Send a new email.
   * @param {import('../types.mjs').SendEmailParams} params
   * @returns {Promise<import('../types.mjs').SendEmailResult>}
   */
  async function sendEmail(params) {
    const message = {
      subject: params.subject,
      body: {
        contentType: 'html',
        content: params.bodyHtml,
      },
      toRecipients: params.to.map(r => ({
        emailAddress: { address: r.email, name: r.name || '' },
      })),
    };

    if (params.cc?.length) {
      message.ccRecipients = params.cc.map(r => ({
        emailAddress: { address: r.email, name: r.name || '' },
      }));
    }

    if (params.bcc?.length) {
      message.bccRecipients = params.bcc.map(r => ({
        emailAddress: { address: r.email, name: r.name || '' },
      }));
    }

    if (params.importance && params.importance !== 'normal') {
      message.importance = params.importance;
    }

    // POST /me/sendMail — sends immediately, no draft created
    await client.api('/me/sendMail').post({ message, saveToSentItems: true });

    return { success: true };
  }

  /**
   * List messages from a folder.
   * @param {import('../types.mjs').EmailListParams} params
   * @returns {Promise<import('../types.mjs').EmailListResult>}
   */
  async function listMessages(params = {}) {
    const folder = resolveFolder(params.folder);
    const top = Math.min(params.maxResults || 20, 50);

    let request = client
      .api(`/me/mailFolders/${folder}/messages`)
      .select(LIST_SELECT)
      .top(top)
      .orderby('receivedDateTime desc');

    if (params.unreadOnly) {
      request = request.filter('isRead eq false');
    }

    if (params.pageToken) {
      // Graph uses @odata.nextLink as a full URL, but we pass just the skipToken
      request = request.query({ $skipToken: params.pageToken });
    }

    const response = await request.get();

    const messages = (response.value || []).map(mapMessage);

    // Extract skipToken from @odata.nextLink if present
    let nextPageToken = null;
    if (response['@odata.nextLink']) {
      const url = new URL(response['@odata.nextLink']);
      nextPageToken = url.searchParams.get('$skipToken') || null;
    }

    return {
      messages,
      nextPageToken,
      totalCount: response['@odata.count'] ?? messages.length,
    };
  }

  /**
   * Search messages using KQL.
   * @param {import('../types.mjs').EmailSearchParams} params
   * @returns {Promise<import('../types.mjs').EmailListResult>}
   */
  async function searchMessages(params) {
    const top = Math.min(params.maxResults || 20, 50);

    // Build KQL query parts
    const parts = [];
    if (params.query) parts.push(`"${params.query}"`);
    if (params.from) parts.push(`from:${params.from}`);
    if (params.subject) parts.push(`subject:"${params.subject}"`);

    // Date filters use $filter instead of $search on personal accounts
    let filterParts = [];
    if (params.after) {
      filterParts.push(`receivedDateTime ge ${params.after}T00:00:00Z`);
    }
    if (params.before) {
      filterParts.push(`receivedDateTime le ${params.before}T23:59:59Z`);
    }

    let request = client
      .api('/me/messages')
      .select(LIST_SELECT)
      .top(top)
      .orderby('receivedDateTime desc');

    if (parts.length > 0) {
      request = request.query({ $search: parts.join(' ') });
    }

    if (filterParts.length > 0) {
      request = request.filter(filterParts.join(' and '));
    }

    const response = await request.get();
    const messages = (response.value || []).map(mapMessage);

    let nextPageToken = null;
    if (response['@odata.nextLink']) {
      const url = new URL(response['@odata.nextLink']);
      nextPageToken = url.searchParams.get('$skipToken') || null;
    }

    return {
      messages,
      nextPageToken,
      totalCount: response['@odata.count'] ?? messages.length,
    };
  }

  /**
   * Get a single message by ID with full body.
   * @param {string} messageId
   * @returns {Promise<import('../types.mjs').EmailMessage>}
   */
  async function getMessage(messageId) {
    const msg = await client
      .api(`/me/messages/${messageId}`)
      .select(FULL_SELECT)
      .get();

    return mapMessage(msg);
  }

  /**
   * Reply to a message.
   * @param {import('../types.mjs').ReplyParams} params
   * @returns {Promise<import('../types.mjs').SendEmailResult>}
   */
  async function replyToMessage(params) {
    const endpoint = params.replyAll
      ? `/me/messages/${params.messageId}/replyAll`
      : `/me/messages/${params.messageId}/reply`;

    await client.api(endpoint).post({
      comment: params.bodyHtml,
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Return provider interface
  // -------------------------------------------------------------------------

  return {
    sendEmail,
    listMessages,
    searchMessages,
    getMessage,
    replyToMessage,
  };
}
