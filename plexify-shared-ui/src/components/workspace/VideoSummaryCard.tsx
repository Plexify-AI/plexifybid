import { useState } from 'react';
import { PlexifyTheme } from '../../types/theme';

interface VideoSummaryCardProps {
  theme: PlexifyTheme;
  videoUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  duration?: string;
  description?: string;
}

export default function VideoSummaryCard({
  theme,
  videoUrl = '',
  thumbnailUrl = '',
  title = 'Video Summary',
  duration = '0:00',
  description = '',
}: VideoSummaryCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        style={{ backgroundColor: `${theme.primaryColor}10` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{duration}</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            {!isPlaying && thumbnailUrl ? (
              <>
                <img
                  src={thumbnailUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    <svg
                      className="w-8 h-8 text-white ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </button>
              </>
            ) : videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay={isPlaying}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No video available
              </div>
            )}
          </div>

          {description && (
            <p className="mt-3 text-sm text-gray-600">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
