/**
 * Gmail Email Adapter
 *
 * Implements the unified email provider interface using the Gmail API.
 * Uses the `googleapis` package with OAuth2 access tokens.
 *
 * Key differences from Microsoft Graph:
 * - Sends require raw RFC 2822 messages (base64url encoded)
 * - List returns IDs only — needs batch get for metadata
 * - Body is nested MIME parts — recursive extraction
 * - Replies require explicit In-Reply-To / References / threadId headers
 *
 * Rate limits: 250 quota units/second per user.
 */

import { google } from 'googleapis';

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create a Gmail API client from a decrypted access token.
 * @param {string} accessToken
 * @returns {import('googleapis').gmail_v1.Gmail}
 */
function createGmailClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// ---------------------------------------------------------------------------
// Helpers — RFC 2822, MIME parsing, header extraction
// ---------------------------------------------------------------------------

/**
 * Build a raw RFC 2822 email message, base64url encoded for Gmail send.
 */
function buildRawEmail({ to, cc, bcc, subject, bodyHtml, from, inReplyTo, references, threadSubject }) {
  const boundary = `plx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const formatAddr = (r) => r.name ? `${r.name} <${r.email}>` : r.email;

  const headers = [
    `From: ${from}`,
    `To: ${to.map(formatAddr).join(', ')}`,
  ];

  if (cc?.length) headers.push(`Cc: ${cc.map(formatAddr).join(', ')}`);
  if (bcc?.length) headers.push(`Bcc: ${bcc.map(formatAddr).join(', ')}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  headers.push(
    `Subject: ${threadSubject || subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    '',
    Buffer.from(bodyHtml, 'utf-8').toString('base64'),
    `--${boundary}--`,
  );

  const rawMessage = headers.join('\r\n');
  return Buffer.from(rawMessage).toString('base64url');
}

/**
 * Recursively extract body content from Gmail MIME parts.
 * @param {Object} payload - Gmail message payload
 * @param {string} mimeType - 'text/html' or 'text/plain'
 * @returns {string|null}
 */
function extractBody(payload, mimeType = 'text/html') {
  if (payload.mimeType === mimeType && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractBody(part, mimeType);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Get a specific header value from Gmail message headers array.
 * @param {Array<{name: string, value: string}>} headers
 * @param {string} name - Header name (case-insensitive)
 * @returns {string}
 */
function getHeader(headers, name) {
  const h = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

/**
 * Parse an email address string like "Ken D'Amato <ken@example.com>"
 * @param {string} raw
 * @returns {{ name: string, email: string }}
 */
function parseAddress(raw) {
  if (!raw) return { name: '', email: '' };
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: '', email: raw.trim() };
}

/**
 * Parse a comma-separated list of email addresses.
 * @param {string} raw
 * @returns {Array<{ name: string, email: string }>}
 */
function parseAddressList(raw) {
  if (!raw) return [];
  // Split on comma but not inside quotes/angle brackets
  return raw.split(/,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(parseAddress).filter(a => a.email);
}

/**
 * Check if a message has attachments by inspecting parts.
 */
function hasAttachmentParts(payload) {
  if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId) return true;
  if (payload.parts) return payload.parts.some(hasAttachmentParts);
  return false;
}

/**
 * Map a Gmail message object to our unified EmailMessage shape.
 * @param {Object} msg - Gmail API message (format: 'full' or 'metadata')
 * @returns {import('../types.mjs').EmailMessage}
 */
function mapMessage(msg) {
  const headers = msg.payload?.headers || [];
  const labels = msg.labelIds || [];

  return {
    id: msg.id,
    threadId: msg.threadId || null,
    from: parseAddress(getHeader(headers, 'From')),
    to: parseAddressList(getHeader(headers, 'To')),
    cc: parseAddressList(getHeader(headers, 'Cc')),
    bcc: parseAddressList(getHeader(headers, 'Bcc')),
    subject: getHeader(headers, 'Subject') || '(no subject)',
    bodyPreview: msg.snippet || '',
    bodyHtml: msg.payload ? (extractBody(msg.payload, 'text/html') || '') : '',
    bodyText: msg.payload ? (extractBody(msg.payload, 'text/plain') || msg.snippet || '') : '',
    receivedAt: msg.internalDate
      ? new Date(parseInt(msg.internalDate, 10)).toISOString()
      : getHeader(headers, 'Date') || '',
    isRead: !labels.includes('UNREAD'),
    hasAttachments: msg.payload ? hasAttachmentParts(msg.payload) : false,
    importance: getHeader(headers, 'Importance')?.toLowerCase() === 'high' ? 'high' : 'normal',
  };
}

/**
 * Map Gmail folder names to label IDs.
 */
const LABEL_MAP = {
  inbox: 'INBOX',
  sent: 'SENT',
  sentitems: 'SENT',
  drafts: 'DRAFT',
  trash: 'TRASH',
  spam: 'SPAM',
  starred: 'STARRED',
};

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Create a Gmail adapter for a specific access token.
 *
 * @param {string} accessToken - Decrypted OAuth access token
 * @returns {import('../types.mjs').EmailProvider}
 */
export function createGmailProvider(accessToken) {
  const gmail = createGmailClient(accessToken);

  // -------------------------------------------------------------------------
  // Send
  // -------------------------------------------------------------------------

  async function sendEmail(params) {
    // Get sender email from profile
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const from = profile.data.emailAddress;

    const raw = buildRawEmail({
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      from,
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { success: true, messageId: res.data.id };
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  async function listMessages(params = {}) {
    const folder = (params.folder || 'inbox').toLowerCase();
    const labelId = LABEL_MAP[folder] || 'INBOX';
    const maxResults = Math.min(params.maxResults || 20, 50);

    const queryParts = [];
    if (params.unreadOnly) queryParts.push('is:unread');

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults,
      q: queryParts.join(' ') || undefined,
      pageToken: params.pageToken || undefined,
    });

    const messageIds = listRes.data.messages || [];
    if (messageIds.length === 0) {
      return { messages: [], nextPageToken: null, totalCount: 0 };
    }

    // Batch fetch metadata (up to 10 concurrent)
    const messages = await batchGetMessages(gmail, messageIds, 'metadata');

    return {
      messages: messages.map(mapMessage),
      nextPageToken: listRes.data.nextPageToken || null,
      totalCount: listRes.data.resultSizeEstimate || messages.length,
    };
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  async function searchMessages(params) {
    const maxResults = Math.min(params.maxResults || 20, 50);
    const q = buildGmailQuery(params);

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q,
    });

    const messageIds = listRes.data.messages || [];
    if (messageIds.length === 0) {
      return { messages: [], nextPageToken: null, totalCount: 0 };
    }

    const messages = await batchGetMessages(gmail, messageIds, 'metadata');

    return {
      messages: messages.map(mapMessage),
      nextPageToken: listRes.data.nextPageToken || null,
      totalCount: listRes.data.resultSizeEstimate || messages.length,
    };
  }

  // -------------------------------------------------------------------------
  // Get single message
  // -------------------------------------------------------------------------

  async function getMessage(messageId) {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return mapMessage(res.data);
  }

  // -------------------------------------------------------------------------
  // Reply
  // -------------------------------------------------------------------------

  async function replyToMessage(params) {
    // Get original message for threading headers
    const original = await gmail.users.messages.get({
      userId: 'me',
      id: params.messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Message-ID'],
    });

    const origHeaders = original.data.payload?.headers || [];
    const origMessageId = getHeader(origHeaders, 'Message-ID');
    const origSubject = getHeader(origHeaders, 'Subject');
    const origFrom = getHeader(origHeaders, 'From');
    const origTo = getHeader(origHeaders, 'To');
    const origCc = getHeader(origHeaders, 'Cc');

    // Get sender email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const from = profile.data.emailAddress;

    // Build reply recipients
    let replyTo;
    if (params.replyAll) {
      // Reply-all: original From + To + Cc, minus ourselves
      const all = [origFrom, origTo, origCc].filter(Boolean).join(', ');
      replyTo = parseAddressList(all).filter(a => a.email.toLowerCase() !== from.toLowerCase());
    } else {
      replyTo = [parseAddress(origFrom)];
    }

    // Build subject
    const replySubject = origSubject.startsWith('Re:') ? origSubject : `Re: ${origSubject}`;

    const raw = buildRawEmail({
      to: replyTo,
      subject: replySubject,
      threadSubject: replySubject,
      bodyHtml: params.bodyHtml,
      from,
      inReplyTo: origMessageId,
      references: origMessageId,
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: original.data.threadId,
      },
    });

    return { success: true, messageId: res.data.id };
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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Batch-fetch message details (up to 10 concurrent).
 */
async function batchGetMessages(gmail, messageIds, format = 'metadata') {
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const fetched = await Promise.all(
      batch.map(({ id }) =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format,
          metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'],
        }).then(r => r.data)
          .catch(err => {
            console.error(`[email/gmail] Failed to fetch message ${id}:`, err.message);
            return null;
          })
      )
    );
    results.push(...fetched.filter(Boolean));
  }

  return results;
}

/**
 * Build a Gmail search query from EmailSearchParams.
 */
function buildGmailQuery(params) {
  const parts = [];
  if (params.query) parts.push(params.query);
  if (params.from) parts.push(`from:${params.from}`);
  if (params.subject) parts.push(`subject:${params.subject}`);
  if (params.after) parts.push(`after:${params.after.replace(/-/g, '/')}`);
  if (params.before) parts.push(`before:${params.before.replace(/-/g, '/')}`);
  return parts.join(' ');
}
