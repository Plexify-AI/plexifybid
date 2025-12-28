import { PlexifyTheme } from '../../types/theme';
import { Message, SuggestedAction } from '../../types/workspace';
// Uses app-level public assets: /public/images/plexify-logo.png

interface AIMessageBubbleProps {
  message: Message;
  theme: PlexifyTheme;
  onSuggestedAction?: (action: SuggestedAction) => void;
}

export default function AIMessageBubble({
  message,
  theme,
  onSuggestedAction,
}: AIMessageBubbleProps) {
  const isAssistant = message.role === 'assistant';

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(date);
  };

  return (
    <div
      className={`flex items-start gap-3 ${
        isAssistant ? '' : 'flex-row-reverse'
      }`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isAssistant ? 'transparent' : '#e5e7eb',
        }}
      >
        {isAssistant ? (
          <img
            src="/images/plexify-logo.png?v=1"
            alt="Plexify"
            className="w-8 h-8 object-contain"
          />
        ) : (
          <svg
            className="w-4 h-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 ${isAssistant ? '' : 'text-right'}`}>
        <div
          className={`inline-block rounded-lg px-4 py-3 max-w-full ${
            isAssistant ? 'bg-gray-100 text-gray-900' : 'text-white'
          }`}
          style={!isAssistant ? { backgroundColor: theme.primaryColor } : undefined}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

          {isAssistant && message.citations && message.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.citations.map((citation, index) => (
                <button
                  key={citation.id}
                  type="button"
                  title={`${citation.sourceLabel}${citation.pageNumber ? ` (p. ${citation.pageNumber})` : ''}: ${citation.quote}`}
                  className="text-[11px] leading-none px-1.5 py-1 rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                >
                  [{index + 1}]
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <p
          className={`text-xs text-gray-400 mt-1 ${
            isAssistant ? '' : 'text-right'
          }`}
        >
          {formatTimestamp(message.timestamp)}
        </p>

        {isAssistant &&
          ((message.referencedSources && message.referencedSources.length > 0) ||
            typeof message.confidence === 'number') && (
            <div className="mt-2 text-xs text-gray-500">
              {message.referencedSources && message.referencedSources.length > 0 ? (
                <span>Referenced: {message.referencedSources.join(', ')}</span>
              ) : null}
              {typeof message.confidence === 'number' ? (
                <span className={message.referencedSources && message.referencedSources.length > 0 ? 'ml-2' : ''}>
                  Confidence: {message.confidence}%
                </span>
              ) : null}
            </div>
          )}

        {/* Suggested Actions */}
        {isAssistant && message.suggestedActions && message.suggestedActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestedActions.map((action, index) => (
              <button
                key={index}
                onClick={() => onSuggestedAction?.(action)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors"
                style={{
                  borderColor: theme.primaryColor,
                  color: theme.primaryColor,
                }}
              >
                {action.action === 'insert' && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                )}
                {action.action === 'replace' && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
                {action.action === 'expand' && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                )}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
