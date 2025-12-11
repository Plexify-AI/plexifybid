import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface AudioBriefingCardProps {
  audioUrl: string;
  duration: number; // seconds
  chapters: Array<{ label: string; timestamp: number }>; // seconds
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(1, '0');
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${ss}`;
};

const AudioBriefingCard: React.FC<AudioBriefingCardProps> = ({ audioUrl, duration, chapters }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, []);

  const percent = useMemo(() => (duration ? Math.min(100, (time / duration) * 100) : 0), [time, duration]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seek = (t: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(duration, t));
  };

  return (
    <div className="card p-4">
      <div className="text-sm font-semibold text-gray-900 mb-2">Audio Briefing</div>

      <audio ref={audioRef} src={audioUrl} preload="none" />

      <div className="flex items-center gap-2 mb-2">
        <button onClick={toggle} className="btn btn-secondary btn-sm" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '⏸' : '▶'}
        </button>
        <div className="flex-1 h-2 bg-gray-200 rounded cursor-pointer" onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = x / rect.width;
          seek(pct * duration);
        }}>
          <div className="h-2 bg-primary-600 rounded" style={{ width: `${percent}%` }} />
        </div>
        <select
          aria-label="Playback speed"
          className="bg-white rounded border border-gray-300 px-2 py-1 text-xs"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        >
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
        <div className="text-xs text-gray-600 w-14 text-right select-none">{formatTime(time)} / {formatTime(duration)}</div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {chapters.map((c) => (
          <button
            key={c.label}
            onClick={() => seek(c.timestamp)}
            className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-600">Status: {playing ? '⏵ Playing' : '⏸ Paused'}</div>
    </div>
  );
};

export default AudioBriefingCard;
