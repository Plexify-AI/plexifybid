/**
 * Email Provider — JSDoc Type Definitions
 *
 * Unified interface for email operations across providers (Microsoft, Gmail).
 * All providers must return data matching these shapes.
 */

/**
 * @typedef {Object} EmailAddress
 * @property {string} [name] - Display name
 * @property {string} email - Email address
 */

/**
 * @typedef {Object} EmailMessage
 * @property {string} id - Provider message ID
 * @property {string|null} threadId - Conversation thread ID
 * @property {EmailAddress} from - Sender
 * @property {EmailAddress[]} to - Recipients
 * @property {EmailAddress[]} cc - CC recipients
 * @property {EmailAddress[]} bcc - BCC recipients
 * @property {string} subject - Subject line
 * @property {string} bodyPreview - First 200 chars of body
 * @property {string} bodyHtml - Full HTML body
 * @property {string} bodyText - Plain text body
 * @property {string} receivedAt - ISO 8601 timestamp
 * @property {boolean} isRead - Read status
 * @property {boolean} hasAttachments - Attachment indicator
 * @property {'low'|'normal'|'high'} importance - Importance level
 */

/**
 * @typedef {Object} SendEmailParams
 * @property {EmailAddress[]} to - Recipients (required)
 * @property {EmailAddress[]} [cc] - CC recipients
 * @property {EmailAddress[]} [bcc] - BCC recipients
 * @property {string} subject - Subject line (required)
 * @property {string} bodyHtml - HTML body (required)
 * @property {string} [bodyText] - Plain text fallback
 * @property {'low'|'normal'|'high'} [importance] - Default: 'normal'
 */

/**
 * @typedef {Object} SendEmailResult
 * @property {boolean} success
 * @property {string} [messageId] - Provider message ID of sent email
 */

/**
 * @typedef {Object} EmailSearchParams
 * @property {string} query - Search query (provider-native syntax)
 * @property {string} [folder] - Folder name (default: 'inbox')
 * @property {string} [from] - Filter by sender email
 * @property {string} [to] - Filter by recipient email
 * @property {string} [subject] - Filter by subject keywords
 * @property {string} [after] - ISO date (e.g. 2026-01-15)
 * @property {string} [before] - ISO date
 * @property {number} [maxResults] - Default: 20, max: 50
 */

/**
 * @typedef {Object} EmailListParams
 * @property {string} [folder] - Folder name (default: 'inbox')
 * @property {number} [maxResults] - Default: 20, max: 50
 * @property {string} [pageToken] - Pagination token
 * @property {boolean} [unreadOnly] - Only unread messages
 */

/**
 * @typedef {Object} EmailListResult
 * @property {EmailMessage[]} messages
 * @property {string|null} nextPageToken
 * @property {number} totalCount
 */

/**
 * @typedef {Object} ReplyParams
 * @property {string} messageId - Message to reply to
 * @property {string} bodyHtml - Reply body HTML
 * @property {boolean} [replyAll] - Reply to all recipients (default: false)
 */

/**
 * Email provider interface — all adapters must implement these methods.
 *
 * @typedef {Object} EmailProvider
 * @property {(params: SendEmailParams) => Promise<SendEmailResult>} sendEmail
 * @property {(params: EmailListParams) => Promise<EmailListResult>} listMessages
 * @property {(params: EmailSearchParams) => Promise<EmailListResult>} searchMessages
 * @property {(messageId: string) => Promise<EmailMessage>} getMessage
 * @property {(params: ReplyParams) => Promise<SendEmailResult>} replyToMessage
 */

export const EMAIL_PROVIDERS = {
  MICROSOFT: 'microsoft',
  GMAIL: 'gmail',
};

export const CONNECTION_STATUS = {
  ACTIVE: 'active',
  NEEDS_REAUTH: 'needs_reauth',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

// Graph folder name → Graph API wellKnownName mapping
export const FOLDER_MAP = {
  inbox: 'inbox',
  sentitems: 'sentitems',
  sent: 'sentitems',
  drafts: 'drafts',
  deleted: 'deleteditems',
  junk: 'junkemail',
};
