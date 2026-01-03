import { useEffect, useRef, useState } from 'react';
import type { Podcast } from '../services/podcastService';

export default function PodcastPlayerWidget({
  podcast,
  isGenerating = false,
}: {
  podcast: Podcast | null;
  isGenerating?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () =>
      setDuration(audio.duration || podcast?.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [podcast]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(e.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handlePlaybackRateChange = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isGenerating) {
    return (
      <div className="podcast-player podcast-player--generating">
        <div className="podcast-player__header">
          <span className="podcast-player__icon">Deep Dive Podcast</span>
          <span className="podcast-player__title">Generating...</span>
        </div>
        <div className="podcast-player__progress-container">
          <div className="podcast-player__spinner" />
          <p className="podcast-player__status">
            Creating your deep dive podcast. This may take 30-60 seconds...
          </p>
        </div>
      </div>
    );
  }

  if (!podcast) return null;

  return (
    <div className="podcast-player">
      <audio ref={audioRef} src={podcast.podcastUrl} preload="metadata" />

      <div className="podcast-player__header">
        <span className="podcast-player__icon">Deep Dive</span>
        <div className="podcast-player__info">
          <span className="podcast-player__title">{podcast.title}</span>
          <span className="podcast-player__meta">
            {formatTime(podcast.duration)}
          </span>
        </div>
      </div>

      <div className="podcast-player__controls">
        <button
          className="podcast-player__play-btn"
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <span className="podcast-player__time">{formatTime(currentTime)}</span>

        <input
          type="range"
          className="podcast-player__seek"
          min={0}
          max={duration || podcast.duration}
          value={currentTime}
          onChange={handleSeek}
        />

        <span className="podcast-player__time">
          {formatTime(duration || podcast.duration)}
        </span>

        <select
          value={playbackRate}
          onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
          className="podcast-player__speed"
        >
          <option value={0.75}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>

        <button
          className={`podcast-player__transcript-btn ${showTranscript ? 'active' : ''}`}
          onClick={() => setShowTranscript((s) => !s)}
          aria-label="Toggle transcript"
        >
          Transcript
        </button>
      </div>

      {showTranscript && podcast.script ? (
        <div className="podcast-player__transcript">
          <h4 className="podcast-player__transcript-title">Transcript</h4>
          <div className="podcast-player__transcript-content">
            {podcast.script.map((turn, idx) => (
              <div
                key={idx}
                className={`podcast-player__turn podcast-player__turn--${turn.speaker.toLowerCase()}`}
              >
                <span className="podcast-player__speaker">
                  {turn.speaker}:
                </span>
                <span className="podcast-player__text">{turn.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
