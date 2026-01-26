import React, { useState } from 'react';
import { PlexifyTheme } from '../../types/theme';

interface RegenerateWithAIButtonProps {
  theme: PlexifyTheme;
  label?: string;
  onRegenerate?: (instructions?: string) => Promise<void>;
  disabled?: boolean;
}

export default function RegenerateWithAIButton({
  theme,
  label = 'Regenerate with AI',
  onRegenerate,
  disabled = false,
}: RegenerateWithAIButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructions, setInstructions] = useState('');

  const handleRegenerate = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    try {
      await onRegenerate?.(instructions || undefined);
      setInstructions('');
      setShowInstructions(false);
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={handleRegenerate}
          disabled={isLoading || disabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
          style={{ backgroundColor: theme.primaryColor }}
        >
          {isLoading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Regenerating...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
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
              <span>{label}</span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          title="Add instructions"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>

      {showInstructions && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg p-3 z-10">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Instructions (optional)
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g., Make it more concise, Add more technical details..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': theme.primaryColor } as React.CSSProperties}
            rows={3}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowInstructions(false)}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="px-3 py-1 text-sm text-white rounded"
              style={{ backgroundColor: theme.primaryColor }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
