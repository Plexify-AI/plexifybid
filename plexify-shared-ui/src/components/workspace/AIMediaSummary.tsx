import { useMemo, useState } from 'react';

type ChapterIcon = 'audio' | 'video';

interface Chapter {
  id: string;
  label: string;
  icon: ChapterIcon;
}

const PlayIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);

const HeadphonesIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 14v-2a8 8 0 0116 0v2"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 14a2 2 0 002 2h1v-6H6a2 2 0 00-2 2v2zm16 0a2 2 0 01-2 2h-1v-6h1a2 2 0 012 2v2z"
    />
  </svg>
);

const VideoIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14V10z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
    />
  </svg>
);

const chapters: Chapter[] = [
  { id: 'intro', label: 'Introduction', icon: 'audio' },
  { id: 'exec', label: 'Executive Summary', icon: 'audio' },
  { id: 'video', label: 'Video', icon: 'video' },
];

export default function AIMediaSummary() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeChapter, setActiveChapter] = useState('intro');

  const activeLabel = useMemo(
    () => chapters.find((c) => c.id === activeChapter)?.label ?? 'Introduction',
    [activeChapter]
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">AI Media Summary</h3>

      {/* Audio Briefing Widget */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
        <div className="flex items-center gap-2 mb-3">
          <HeadphonesIcon className="w-4 h-4" />
          <span className="text-sm font-semibold">Audio Briefing</span>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
          >
            {isPlaying ? (
              <PauseIcon className="w-[18px] h-[18px]" />
            ) : (
              <PlayIcon className="w-[18px] h-[18px] ml-0.5" />
            )}
          </button>

          <div className="flex-1 flex items-center gap-2 text-xs">
            <span>0:00</span>
            <div className="flex-1 h-1 bg-white/30 rounded-full">
              <div className="h-full w-0 bg-white rounded-full" />
            </div>
            <span>2:00</span>
          </div>

          <select className="bg-white/20 text-xs rounded px-2 py-1 border-none">
            <option>1x</option>
            <option>1.5x</option>
            <option>2x</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {chapters.map((ch) => (
            <button
              type="button"
              key={ch.id}
              onClick={() => setActiveChapter(ch.id)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition ${
                activeChapter === ch.id
                  ? 'bg-white text-indigo-600'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {ch.icon === 'video' ? (
                <VideoIcon className="w-3 h-3" />
              ) : (
                <HeadphonesIcon className="w-3 h-3" />
              )}
              {ch.label}
            </button>
          ))}
        </div>

        <div className="text-xs opacity-80 flex items-center gap-2">
          <span>Ready:</span>
          <HeadphonesIcon className="w-3 h-3" />
          <span>{activeLabel}</span>
          <span>•</span>
          <span>{isPlaying ? 'Playing' : 'Paused'}</span>
        </div>
      </div>

      {/* Visual Site Summary */}
      <div className="relative rounded-xl overflow-hidden bg-slate-300 aspect-video">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-400 to-slate-500" />
        <button
          type="button"
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <PlayIcon className="w-6 h-6 text-slate-700 ml-1" />
          </div>
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
          <span className="text-white text-sm font-medium">Visual Site Summary</span>
        </div>
      </div>
    </div>
  );
}
