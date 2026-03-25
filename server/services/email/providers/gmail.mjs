/**
 * Gmail Email Adapter — STUB
 *
 * Validates the provider abstraction layer.
 * All methods throw a clear error directing to Phase 2 implementation.
 */

const NOT_IMPLEMENTED = 'Gmail provider not yet implemented. Coming in Phase 2.';

export function createGmailProvider(_accessToken) {
  const stub = (method) => async () => {
    throw new Error(`[email/gmail] ${method}(): ${NOT_IMPLEMENTED}`);
  };

  return {
    sendEmail: stub('sendEmail'),
    listMessages: stub('listMessages'),
    searchMessages: stub('searchMessages'),
    getMessage: stub('getMessage'),
    replyToMessage: stub('replyToMessage'),
  };
}
