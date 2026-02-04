import React, { useState, useRef } from 'react';
import AudioPlayer from 'react-h5-audio-player';
import { PlexifyTheme } from '../../types/theme';
import { AudioChapter } from '../../types/workspace';

interface AudioBriefingCardProps {
  theme: PlexifyTheme;
  audioUrl?: string;
  title?: string;
  duration?: string;
  chapters?: AudioChapter[];
  onChapterSelect?: (timestamp: number) => void;
}

export default function AudioBriefingCard({
  theme,
  audioUrl = '',
  title = 'Audio Briefing',
  duration = '0:00',
  chapters = [],
  onChapterSelect,
}: AudioBriefingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const playerRef = useRef<AudioPlayer>(null);

  const handleChapterClick = (timestamp: number) => {
    if (playerRef.current?.audio?.current) {
      playerRef.current.audio.current.currentTime = timestamp;
      playerRef.current.audio.current.play();
    }
    onChapterSelect?.(timestamp);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 12a3 3 0 11-6 0 3 3 0 016 0z"
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
          {audioUrl && (
            <AudioPlayer
              ref={playerRef}
              src={audioUrl}
              showJumpControls={false}
              customAdditionalControls={[]}
              customVolumeControls={[]}
              layout="horizontal-reverse"
              className="rounded-lg"
              style={
                {
                  '--rhap_theme-color': theme.primaryColor,
                } as React.CSSProperties
              }
            />
          )}

          {chapters.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Chapters
              </h4>
              <div className="space-y-1">
                {chapters.map((chapter, index) => (
                  <button
                    key={index}
                    onClick={() => handleChapterClick(chapter.timestamp)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 flex items-center justify-between group"
                  >
                    <span className="text-gray-700">{chapter.label}</span>
                    <span
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: theme.primaryColor }}
                    >
                      {formatTime(chapter.timestamp)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
