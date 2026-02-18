/**
 * AudioBriefingPlayer — Custom HTML5 audio player for Deal Room
 *
 * Plays ElevenLabs-generated briefings (single voice) and podcasts (two voice).
 * Loads audio via fetch + blob URL to support Authorization headers.
 * Matches the dark theme of DealRoomPage.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Download,
  Headphones,
  Mic,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioRecord {
  id: string;
  deal_room_id: string;
  artifact_id: string | null;
  audio_type: 'briefing' | 'podcast';
  title: string;
  script: string | null;
  podcast_script: Array<{ speaker: string; text: string }> | null;
  duration_seconds: number | null;
  status: 'generating' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

interface AudioBriefingPlayerProps {
  audio: AudioRecord;
  dealRoomId: string;
  token: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AudioBriefingPlayer: React.FC<AudioBriefingPlayerProps> = ({
  audio,
  dealRoomId,
  token,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audio.duration_seconds || 0);
  const [speed, setSpeed] = useState(1);
  const [scriptExpanded, setScriptExpanded] = useState(false);

  // Load audio blob on mount
  useEffect(() => {
    if (audio.status !== 'ready') return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/deal-rooms/${dealRoomId}/audio/${audio.id}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load audio (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [audio.id, audio.status, dealRoomId, token]);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Audio event listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => {
      if (el.duration && isFinite(el.duration)) setDuration(el.duration);
    };
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [blobUrl]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  }, [playing]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
  }, [duration]);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${audio.title || audio.audio_type}-${audio.id.slice(0, 8)}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [blobUrl, audio]);

  const isBriefing = audio.audio_type === 'briefing';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generating state
  if (audio.status === 'generating') {
    return (
      <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4 flex items-center gap-3">
        <Loader2 size={18} className="text-blue-400 animate-spin" />
        <span className="text-sm text-gray-300">
          Generating {isBriefing ? 'audio briefing' : 'podcast'}...
        </span>
      </div>
    );
  }

  // Error state
  if (audio.status === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4">
        <p className="text-sm text-red-400">
          Audio generation failed: {audio.error_message || 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl overflow-hidden">
      {/* Hidden audio element */}
      {blobUrl && <audio ref={audioRef} src={blobUrl} preload="auto" />}

      {/* Player controls */}
      <div className="p-4">
        {/* Header row: type badge + title */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isBriefing
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                : 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
            }`}
          >
            {isBriefing ? (
              <Headphones size={11} />
            ) : (
              <Mic size={11} />
            )}
            {isBriefing ? 'Briefing' : 'Podcast'}
          </span>
          <span className="text-sm font-medium text-white truncate">
            {audio.title}
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={loading || !blobUrl}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={16} className="text-blue-400 animate-spin" />
            ) : playing ? (
              <Pause size={16} className="text-blue-400" />
            ) : (
              <Play size={16} className="text-blue-400 ml-0.5" />
            )}
          </button>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div
              className="flex-1 h-1.5 bg-gray-700/50 rounded-full cursor-pointer relative group"
              onClick={handleSeek}
            >
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progress}%`, marginLeft: '-6px' }}
              />
            </div>
            <span className="text-xs text-gray-500 w-10 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>

          {/* Speed */}
          <button
            onClick={cycleSpeed}
            className="flex-shrink-0 px-2 py-1 rounded-md text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors tabular-nums"
          >
            {speed}x
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!blobUrl}
            className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors disabled:opacity-40"
            title="Download MP3"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Expandable script */}
      {(audio.script || audio.podcast_script) && (
        <div className="border-t border-gray-700/30">
          <button
            onClick={() => setScriptExpanded(!scriptExpanded)}
            className="w-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            {scriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {scriptExpanded ? 'Hide Script' : 'Read Script'}
          </button>

          {scriptExpanded && (
            <div className="px-4 pb-4 max-h-64 overflow-y-auto">
              {audio.podcast_script ? (
                <div className="space-y-2">
                  {audio.podcast_script.map((section, i) => (
                    <div key={i} className="flex gap-2">
                      <span
                        className={`flex-shrink-0 text-xs font-semibold mt-0.5 ${
                          section.speaker === 'host'
                            ? 'text-pink-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        {section.speaker === 'host' ? 'HOST' : 'ANALYST'}
                      </span>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {section.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {audio.script}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioBriefingPlayer;
