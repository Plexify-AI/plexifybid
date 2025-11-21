/**
 * AudioPlayer Component - Professional Bloomberg-Style Audio Briefings
 * 
 * Provides professional audio playback controls with chapter navigation,
 * timeline scrubbing, and playback speed controls for construction report briefings.
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Loader, 
  AlertCircle,
  Headphones 
} from 'lucide-react';

const AudioPlayer = ({ report, audioService }) => {
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentChapter, setCurrentChapter] = useState('intro');
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  
  // UI state
  const [showChapters, setShowChapters] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const progressRef = useRef(null);
  
  // Chapter definitions with names and icons
  const chapters = [
    { id: 'intro', name: 'Introduction', icon: '🎙️' },
    { id: 'summary', name: 'Executive Summary', icon: '📋' },
    { id: 'work', name: 'Work Progress', icon: '🔨' },
    { id: 'issues', name: 'Issues & Risks', icon: '⚠️' },
    { id: 'safety', name: 'Safety Update', icon: '🛡️' },
    { id: 'tomorrow', name: "Tomorrow's Plan", icon: '📅' },
    { id: 'closing', name: 'Closing', icon: '✅' }
  ];
  
  // Initialize audio service and event handlers
  useEffect(() => {
    if (!audioService.isSupported()) {
      setIsSupported(false);
      setError('Text-to-speech is not supported in this browser');
      setIsGenerating(false);
      return;
    }
    
    initializeAudio();
    
    // Set up event handlers
    audioService.onTimeUpdate = handleTimeUpdate;
    audioService.onChapterChange = handleChapterChange;
    audioService.onComplete = handleComplete;
    audioService.onError = handleError;
    
    return () => {
      audioService.stop();
      audioService.onTimeUpdate = null;
      audioService.onChapterChange = null;
      audioService.onComplete = null;
      audioService.onError = null;
    };
  }, [report]);
  
  // Initialize audio when component mounts or report changes
  const initializeAudio = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      console.log('🎧 AudioPlayer: Initializing for report:', report.projectName);
      
      const totalDuration = await audioService.prepareAudioBriefing(report);
      setDuration(totalDuration);
      setCurrentTime(0);
      setCurrentChapter('intro');
      setIsGenerating(false);
      
      console.log('✅ AudioPlayer: Audio briefing prepared, duration:', Math.round(totalDuration), 'seconds');
    } catch (error) {
      console.error('❌ AudioPlayer: Failed to prepare audio:', error);
      setError('Failed to prepare audio briefing');
      setIsGenerating(false);
    }
  };
  
  // Event handlers
  const handleTimeUpdate = (time) => {
    if (!isDragging) {
      setCurrentTime(time);
    }
  };
  
  const handleChapterChange = (chapterId) => {
    setCurrentChapter(chapterId);
  };
  
  const handleComplete = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentChapter('intro');
  };
  
  const handleError = (errorMessage) => {
    setError(errorMessage);
    setIsPlaying(false);
  };
  
  // Control handlers
  const handlePlayPause = () => {
    if (isGenerating || error) return;
    
    try {
      if (isPlaying) {
        audioService.pause();
        setIsPlaying(false);
      } else {
        audioService.play();
        setIsPlaying(true);
      }
    } catch (err) {
      handleError('Playback failed');
    }
  };
  
  const handleChapterJump = (chapterId) => {
    if (isGenerating || error) return;
    
    try {
      audioService.jumpToChapter(chapterId);
      setCurrentChapter(chapterId);
      setShowChapters(false);
    } catch (err) {
      handleError('Chapter navigation failed');
    }
  };
  
  const handleProgressClick = (e) => {
    if (isGenerating || error || duration === 0) return;
    
    const bounds = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
    const newTime = percent * duration;
    
    try {
      audioService.seekTo(newTime);
      setCurrentTime(newTime);
    } catch (err) {
      handleError('Seek failed');
    }
  };
  
  const handleProgressDrag = (e) => {
    if (isGenerating || error || duration === 0) return;
    
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent) => {
      const bounds = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - bounds.left) / bounds.width));
      const newTime = percent * duration;
      setCurrentTime(newTime);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      try {
        audioService.seekTo(currentTime);
      } catch (err) {
        handleError('Seek failed');
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    try {
      audioService.setPlaybackRate(rate);
    } catch (err) {
      handleError('Speed change failed');
    }
  };
  
  // Utility functions
  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getProgressPercent = () => {
    if (duration === 0) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  };
  
  const getCurrentChapterName = () => {
    const chapter = chapters.find(ch => ch.id === currentChapter);
    return chapter ? chapter.name : 'Introduction';
  };
  
  // Don't render if not supported
  if (!isSupported) {
    return (
      <div className="audio-player-container bg-gray-600 text-white rounded-t-lg p-4">
        <div className="flex items-center justify-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="text-sm">Audio briefings not supported in this browser</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="audio-player-container bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-lg p-4 text-white">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Headphones className="w-5 h-5 mr-2" />
          <h3 className="font-semibold text-lg">Audio Briefing</h3>
        </div>
        
        {/* Chapter Toggle (Mobile) */}
        <button
          onClick={() => setShowChapters(!showChapters)}
          className="md:hidden px-3 py-1 bg-white/20 rounded-full text-xs hover:bg-white/30"
        >
          Chapters
        </button>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-3 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 text-red-300" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      {/* Main Controls Row */}
      <div className="flex items-center space-x-4 mb-3">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={isGenerating || error}
          className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isGenerating ? (
            <Loader className="w-6 h-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>
        
        {/* Progress Section */}
        <div className="flex-1">
          {/* Progress Bar */}
          <div className="relative mb-1">
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              onMouseDown={handleProgressDrag}
              className="relative h-3 bg-white/20 rounded-full cursor-pointer group hover:bg-white/25 transition-colors"
              title="Click to seek"
            >
              {/* Progress Fill */}
              <div
                className="absolute h-full bg-white rounded-full transition-all duration-300 ease-out"
                style={{ width: `${getProgressPercent()}%` }}
              />
              
              {/* Progress Handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${getProgressPercent()}% - 8px)` }}
              />
              
              {/* Chapter Markers */}
              {Object.entries(audioService.getChapterTimestamps()).map(([chapterId, timestamp]) => (
                <div
                  key={chapterId}
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-white/70 rounded-full opacity-60 hover:opacity-100"
                  style={{ left: `${duration > 0 ? (timestamp / duration) * 100 : 0}%` }}
                  title={chapters.find(ch => ch.id === chapterId)?.name || chapterId}
                />
              ))}
            </div>
            
            {/* Time Display */}
            <div className="flex justify-between mt-1 text-xs text-white/70">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        
        {/* Speed Control */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-white/70 hidden sm:block">Speed:</span>
          <select
            value={playbackRate}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            disabled={isGenerating || error}
            className="bg-white/20 border border-white/30 rounded px-2 py-1 text-sm focus:bg-white/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>
      
      {/* Chapter Navigation */}
      <div className={`chapter-navigation ${showChapters ? 'block' : 'hidden md:block'}`}>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {chapters.map((chapter) => {
            const isActive = currentChapter === chapter.id;
            const timestamp = audioService.getChapterTimestamps()[chapter.id];
            const isAvailable = timestamp !== undefined;
            
            return (
              <button
                key={chapter.id}
                onClick={() => handleChapterJump(chapter.id)}
                disabled={!isAvailable || isGenerating || error}
                className={`
                  flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-white text-purple-600 shadow-lg' 
                    : 'bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed'}
                  ${!isAvailable ? 'opacity-30' : ''}
                `}
                title={`Jump to ${chapter.name}${timestamp ? ` (${formatTime(timestamp)})` : ''}`}
              >
                <span className="mr-1.5">{chapter.icon}</span>
                <span className="hidden sm:inline">{chapter.name}</span>
                <span className="sm:hidden">{chapter.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Current Chapter Display */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex items-center text-white/90">
          <span className="font-medium mr-2">
            {isPlaying ? 'Now Playing:' : 'Ready:'}
          </span>
          <span>
            {chapters.find(ch => ch.id === currentChapter)?.icon} {getCurrentChapterName()}
          </span>
        </div>
        
        {/* Status Indicator */}
        <div className="flex items-center text-white/70">
          {isGenerating ? (
            <><Loader className="w-3 h-3 mr-1 animate-spin" /> Preparing...</>
          ) : error ? (
            <><AlertCircle className="w-3 h-3 mr-1" /> Error</>
          ) : isPlaying ? (
            <><div className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse" /> Live</>
          ) : (
            <><div className="w-2 h-2 bg-gray-400 rounded-full mr-1.5" /> Paused</>
          )}
        </div>
      </div>
      
      {/* Generating State */}
      {isGenerating && (
        <div className="mt-3 bg-white/10 rounded-lg p-3 flex items-center justify-center">
          <Loader className="w-4 h-4 mr-2 animate-spin" />
          <span className="text-sm">Generating your Bloomberg-style briefing...</span>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;