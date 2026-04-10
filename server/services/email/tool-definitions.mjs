/**
 * Email Tool Definitions for Claude's Tool-Calling API
 *
 * 5 tools: send_email, list_emails, search_emails, get_email, reply_to_email
 *
 * These are conditionally injected into the Claude messages API
 * only when the tenant has an active email connection.
 */

export const emailToolDefinitions = [
  {
    name: 'send_email',
    description:
      'Send a new email on behalf of the user via their connected Outlook or Gmail account. ' +
      'ALWAYS show the user a preview and get explicit approval before calling this tool. ' +
      'Never send without confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['email'],
          },
          description: 'Recipients',
        },
        cc: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['email'],
          },
          description: 'CC recipients (optional)',
        },
        bcc: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
            required: ['email'],
          },
          description: 'BCC recipients (optional)',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body_html: {
          type: 'string',
          description: 'Email body in HTML format',
        },
        importance: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Email importance level (default: normal)',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source_id: {
                type: 'string',
                description: 'Deal Room source UUID — the file will be fetched from storage and attached',
              },
              filename: {
                type: 'string',
                description: 'Display filename for the attachment (optional — derived from source if omitted)',
              },
            },
            required: ['source_id'],
          },
          description: 'Files to attach from Deal Room sources (optional). Use the source UUID from deal room data.',
        },
      },
      required: ['to', 'subject', 'body_html'],
    },
  },
  {
    name: 'list_emails',
    description:
      'List recent emails from the user inbox or a specific folder. ' +
      'Returns subject, sender, date, and preview for each message.',
    input_schema: {
      type: 'object',
      properties: {
        folder: {
          type: 'string',
          description: "Folder name (default: inbox). Options: inbox, sentitems, drafts",
        },
        max_results: {
          type: 'number',
          description: 'Number of emails to return (default: 10, max: 50)',
        },
        unread_only: {
          type: 'boolean',
          description: 'If true, only return unread emails',
        },
      },
    },
  },
  {
    name: 'search_emails',
    description:
      'Search the user email by keyword, sender, date range, or subject. ' +
      'Use this to find specific conversations or threads.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — can include keywords, sender names, or phrases',
        },
        from: {
          type: 'string',
          description: 'Filter by sender email address',
        },
        subject: {
          type: 'string',
          description: 'Filter by subject line keywords',
        },
        after: {
          type: 'string',
          description: 'Only emails after this date (ISO 8601, e.g. 2026-01-15)',
        },
        before: {
          type: 'string',
          description: 'Only emails before this date (ISO 8601)',
        },
        max_results: {
          type: 'number',
          description: 'Number of results (default: 10, max: 50)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_email',
    description:
      'Get the full content of a specific email by its message ID. ' +
      'Use this after list_emails or search_emails to read the complete message body.',
    input_schema: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The email message ID (from list_emails or search_emails results)',
        },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'reply_to_email',
    description:
      'Reply to a specific email. The reply will be sent in the same thread. ' +
      'ALWAYS show the user a preview and get explicit approval before calling this tool.',
    input_schema: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The message ID to reply to',
        },
        body_html: {
          type: 'string',
          description: 'Reply body in HTML format',
        },
        reply_all: {
          type: 'boolean',
          description: 'If true, reply to all recipients (default: false)',
        },
      },
      required: ['message_id', 'body_html'],
    },
  },
];
