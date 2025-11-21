# Phase 3A: Audio Executive Briefings - Bloomberg-Style Implementation for PlexifyAEC

## Project Context
PlexifyAEC is evolving from a construction reporting platform into a "Bloomberg for Construction" - providing multimedia executive intelligence briefings. We're implementing audio narration as the first step toward full multimedia capabilities.

## Current State
- ✓ Executive Intelligence Feed displays project reports
- ✓ Report modal shows multiple narratives (Executive Summary, Technical Details, Owner Update)
- ✓ Voice recording and transcription working
- ✓ Claude AI enhancement integrated
- ✗ No audio playback capability
- ✗ No multimedia presentation

## Objective
Transform text reports into professional audio briefings that executives can listen to while commuting, similar to a Bloomberg morning briefing or podcast.

---

## Implementation Requirements

### 1. Audio Player Component
Add a professional audio player to the report modal header:

```jsx
// components/AudioPlayer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';

const AudioPlayer = ({ report, audioService }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentChapter, setCurrentChapter] = useState('intro');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const progressRef = useRef(null);
  const audioContextRef = useRef(null);
  
  // Chapter definitions with timestamps
  const chapters = [
    { id: 'intro', name: 'Introduction', start: 0 },
    { id: 'summary', name: 'Executive Summary', start: 10 },
    { id: 'work', name: 'Work Completed', start: 45 },
    { id: 'issues', name: 'Issues & Risks', start: 90 },
    { id: 'safety', name: 'Safety Update', start: 120 },
    { id: 'tomorrow', name: "Tomorrow's Plan", start: 150 },
    { id: 'closing', name: 'Closing', start: 180 }
  ];
  
  useEffect(() => {
    // Initialize audio when component mounts
    initializeAudio();
  }, [report]);
  
  const initializeAudio = async () => {
    setIsGenerating(true);
    try {
      await audioService.prepareAudioBriefing(report);
      setDuration(audioService.getTotalDuration());
      setIsGenerating(false);
    } catch (error) {
      console.error('Failed to prepare audio:', error);
      setIsGenerating(false);
    }
  };
  
  const handlePlayPause = () => {
    if (isPlaying) {
      audioService.pause();
    } else {
      audioService.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleChapterJump = (chapterId) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (chapter) {
      audioService.seekTo(chapter.start);
      setCurrentTime(chapter.start);
      setCurrentChapter(chapterId);
    }
  };
  
  const handleProgressClick = (e) => {
    const bounds = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    const newTime = percent * duration;
    audioService.seekTo(newTime);
    setCurrentTime(newTime);
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="audio-player-container bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-lg p-4 text-white">
      {/* Main Controls Row */}
      <div className="flex items-center space-x-4 mb-3">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlayPause}
          disabled={isGenerating}
          className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
        >
          {isGenerating ? (
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>
        
        {/* Progress Bar */}
        <div className="flex-1">
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="relative h-2 bg-white/20 rounded-full cursor-pointer group"
          >
            {/* Progress Fill */}
            <div
              className="absolute h-full bg-white rounded-full transition-all"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Chapter Markers */}
            {chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-white/50 rounded-full"
                style={{ left: `${(chapter.start / duration) * 100}%` }}
                title={chapter.name}
              />
            ))}
          </div>
          
          {/* Time Display */}
          <div className="flex justify-between mt-1 text-xs text-white/70">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Speed Control */}
        <select
          value={playbackRate}
          onChange={(e) => {
            const rate = parseFloat(e.target.value);
            setPlaybackRate(rate);
            audioService.setPlaybackRate(rate);
          }}
          className="bg-white/20 border border-white/30 rounded px-2 py-1 text-sm"
        >
          <option value="0.75">0.75x</option>
          <option value="1">1x</option>
          <option value="1.25">1.25x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>
      
      {/* Chapter Navigation */}
      <div className="flex flex-wrap gap-2">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => handleChapterJump(chapter.id)}
            className={`
              px-3 py-1 rounded-full text-xs transition-all
              ${currentChapter === chapter.id 
                ? 'bg-white text-purple-600' 
                : 'bg-white/20 hover:bg-white/30'}
            `}
          >
            {chapter.name}
          </button>
        ))}
      </div>
      
      {/* Current Chapter Display */}
      <div className="mt-3 text-sm text-white/90">
        <span className="font-semibold">Now Playing:</span> {
          chapters.find(ch => ch.id === currentChapter)?.name || 'Introduction'
        }
      </div>
    </div>
  );
};

export default AudioPlayer;
```

### 2. Audio Narration Service

```javascript
// services/AudioNarrationService.js
class AudioNarrationService {
  constructor() {
    this.isPlaying = false;
    this.currentUtterance = null;
    this.utteranceQueue = [];
    this.chapterTimestamps = {};
    this.totalDuration = 0;
    this.playbackRate = 1.0;
    
    // Check for voice availability
    this.initializeVoices();
    
    // Bind event handlers
    this.handleUtteranceEnd = this.handleUtteranceEnd.bind(this);
  }
  
  initializeVoices() {
    // Get available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Prefer high-quality voices in order of preference
      this.preferredVoice = 
        voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find(v => v.lang.startsWith('en-US')) ||
        voices[0];
      
      console.log('Selected voice:', this.preferredVoice?.name);
    };
    
    // Voices may load async
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
  
  async prepareAudioBriefing(report) {
    // Clear any existing queue
    this.clearQueue();
    
    // Generate the script
    const script = this.generateScript(report);
    
    // Create utterances for each chapter
    let currentTime = 0;
    this.utteranceQueue = [];
    this.chapterTimestamps = {};
    
    for (const [chapterId, text] of Object.entries(script)) {
      this.chapterTimestamps[chapterId] = currentTime;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.preferredVoice;
      utterance.rate = this.playbackRate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Store chapter info on utterance
      utterance.chapterId = chapterId;
      
      // Estimate duration (approximately 150 words per minute)
      const wordCount = text.split(' ').length;
      const estimatedDuration = (wordCount / 150) * 60;
      currentTime += estimatedDuration;
      
      this.utteranceQueue.push(utterance);
    }
    
    this.totalDuration = currentTime;
    return this.totalDuration;
  }
  
  generateScript(report) {
    const projectName = report.projectName || 'the project';
    const superintendent = report.superintendent?.name || 'the field team';
    const date = new Date(report.timestamp).toLocaleDateString();
    const time = new Date(report.timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    
    // Build conversational script
    const script = {
      intro: `Good ${this.getTimeOfDay()}. This is your PlexifyAEC construction intelligence briefing 
              for ${projectName}. This report was filed by ${superintendent} on ${date} at ${time}.`,
      
      summary: this.cleanTextForSpeech(report.executiveSummary || report.narratives?.executive || 
                'No executive summary available.'),
      
      work: report.workCompleted ? 
            `Work completed today: ${this.cleanTextForSpeech(report.workCompleted)}` :
            'No work progress reported for today.',
      
      issues: report.issues || report.openIssues ? 
              `Issues requiring your attention: ${this.cleanTextForSpeech(report.issues || report.openIssues)}` :
              'No critical issues reported.',
      
      safety: report.safetyIncidents ? 
              `Safety alert: ${this.cleanTextForSpeech(report.safetyIncidents)}` :
              'Safety status: All clear with no incidents reported.',
      
      tomorrow: report.tomorrowPlan || report.upcomingWork ?
                `Looking ahead: ${this.cleanTextForSpeech(report.tomorrowPlan || report.upcomingWork)}` :
                'Tomorrow\'s activities will continue as scheduled.',
      
      closing: `This concludes your audio briefing for ${projectName}. 
                The full written report is available in your dashboard. 
                Have a productive ${this.getTimeOfDay()}.`
    };
    
    return script;
  }
  
  cleanTextForSpeech(text) {
    // Remove or replace content that doesn't work well in speech
    return text
      .replace(/\[.*?\]/g, '') // Remove markdown links
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\n+/g, '. ') // Replace line breaks with pauses
      .replace(/[•·]/g, '') // Remove bullet points
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }
  
  play() {
    if (this.utteranceQueue.length === 0) {
      console.warn('No audio prepared');
      return;
    }
    
    // Cancel any existing speech
    window.speechSynthesis.cancel();
    
    // Start playing from the beginning
    this.currentUtteranceIndex = 0;
    this.playNextUtterance();
    this.isPlaying = true;
  }
  
  playNextUtterance() {
    if (this.currentUtteranceIndex >= this.utteranceQueue.length) {
      this.isPlaying = false;
      this.onComplete?.();
      return;
    }
    
    const utterance = this.utteranceQueue[this.currentUtteranceIndex];
    
    utterance.onend = () => {
      this.currentUtteranceIndex++;
      if (this.isPlaying) {
        this.playNextUtterance();
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.currentUtteranceIndex++;
      if (this.isPlaying) {
        this.playNextUtterance();
      }
    };
    
    window.speechSynthesis.speak(utterance);
  }
  
  pause() {
    window.speechSynthesis.pause();
    this.isPlaying = false;
  }
  
  resume() {
    window.speechSynthesis.resume();
    this.isPlaying = true;
  }
  
  stop() {
    window.speechSynthesis.cancel();
    this.isPlaying = false;
    this.currentUtteranceIndex = 0;
  }
  
  seekTo(timeInSeconds) {
    // Find the chapter that contains this timestamp
    let targetChapterIndex = 0;
    const chapterEntries = Object.entries(this.chapterTimestamps);
    
    for (let i = 0; i < chapterEntries.length; i++) {
      if (chapterEntries[i][1] <= timeInSeconds) {
        targetChapterIndex = i;
      }
    }
    
    // Stop current playback
    this.stop();
    
    // Start from the target chapter
    this.currentUtteranceIndex = targetChapterIndex;
    if (this.isPlaying) {
      this.playNextUtterance();
    }
  }
  
  setPlaybackRate(rate) {
    this.playbackRate = rate;
    // Update all queued utterances
    this.utteranceQueue.forEach(utterance => {
      utterance.rate = rate;
    });
  }
  
  getTotalDuration() {
    return this.totalDuration;
  }
  
  clearQueue() {
    this.stop();
    this.utteranceQueue = [];
    this.chapterTimestamps = {};
    this.totalDuration = 0;
  }
}

export default AudioNarrationService;
```

### 3. Report Modal Integration

```javascript
// components/ReportModal.jsx - Update existing modal
import React, { useState, useEffect } from 'react';
import AudioPlayer from './AudioPlayer';
import AudioNarrationService from '../services/AudioNarrationService';

const ReportModal = ({ report, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('executive');
  const [audioService] = useState(() => new AudioNarrationService());
  
  // Existing modal code...
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Modal Header */}
        <div className="modal-header">
          <h2>{report.projectName}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        {/* Audio Player - New Addition */}
        <AudioPlayer report={report} audioService={audioService} />
        
        {/* Existing Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={activeTab === 'executive' ? 'active' : ''} 
            onClick={() => setActiveTab('executive')}
          >
            Executive Summary
          </button>
          <button 
            className={activeTab === 'technical' ? 'active' : ''} 
            onClick={() => setActiveTab('technical')}
          >
            Technical Details
          </button>
          <button 
            className={activeTab === 'owner' ? 'active' : ''} 
            onClick={() => setActiveTab('owner')}
          >
            Owner Update
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'executive' && (
            <div>{report.narratives?.executive || report.executiveSummary}</div>
          )}
          {activeTab === 'technical' && (
            <div>{report.narratives?.technical || report.technicalDetails}</div>
          )}
          {activeTab === 'owner' && (
            <div>{report.narratives?.owner || report.ownerUpdate}</div>
          )}
        </div>
        
        {/* Site Photos Section */}
        {report.photos && report.photos.length > 0 && (
          <div className="photos-section">
            <h3>Site Photos</h3>
            <div className="photo-grid">
              {report.photos.map((photo, index) => (
                <img key={index} src={photo.url} alt={photo.caption} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
```

### 4. Styling

```css
/* styles/AudioPlayer.css */
.audio-player-container {
  background: linear-gradient(to right, #7c3aed, #2563eb);
  padding: 1rem;
  border-radius: 0.5rem 0.5rem 0 0;
  color: white;
}

.audio-player-container button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Progress bar hover effect */
.audio-player-container .progress-bar-container:hover {
  transform: scaleY(1.5);
}

/* Chapter marker pulse animation */
@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.chapter-marker {
  animation: pulse 2s infinite;
}

/* Loading animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .audio-player-container {
    padding: 0.75rem;
  }
  
  .chapter-navigation {
    display: flex;
    overflow-x: auto;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
  }
  
  .chapter-navigation::-webkit-scrollbar {
    height: 4px;
  }
  
  .chapter-navigation::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }
}
```

### 5. Future Enhancement Path

```javascript
// config/audioConfig.js
export const AUDIO_CONFIG = {
  // Current: Browser TTS
  provider: 'browser-tts',
  
  // Future: Azure Speech Services Configuration
  azure: {
    enabled: false, // Set to true when ready to upgrade
    endpoint: 'https://eastus.tts.speech.microsoft.com/',
    apiKey: process.env.VITE_AZURE_SPEECH_KEY,
    voice: 'en-US-JennyNeural', // Professional voice
    outputFormat: 'audio-16khz-128kbitrate-mono-mp3',
    features: {
      ssml: true, // Speech Synthesis Markup Language
      neuralVoice: true,
      wordBoundary: true, // For precise timestamp sync
      viseme: false // For future avatar animation
    }
  },
  
  // Future: Additional Features
  enhancements: {
    backgroundMusic: false,
    multiVoice: false, // Different voices for quotes
    soundEffects: false,
    podcastFeed: false, // RSS generation
    offlineCache: false // Download for offline listening
  }
};
```

## Testing Instructions

### Functionality Testing
1. Navigate to Executive Intelligence Feed
2. Click "View Full Report" on any report card
3. Verify audio player appears at top of modal
4. Click play button - should hear narration start
5. Test pause/resume functionality
6. Test chapter navigation buttons
7. Test timeline scrubbing
8. Test playback speed control
9. Verify narration matches report content
10. Close modal and open different report

### Browser Compatibility Testing
- [ ] Chrome (primary)
- [ ] Edge
- [ ] Safari
- [ ] Firefox
- [ ] Mobile Chrome
- [ ] Mobile Safari

### Edge Cases
- [ ] Reports with missing data
- [ ] Very long reports (test performance)
- [ ] Reports with special characters
- [ ] Multiple modals opened in sequence
- [ ] Background tab behavior

## Acceptance Criteria

### Must Have (MVP)
- [x] Audio player UI in modal header
- [x] Play/pause functionality
- [x] Chapter navigation
- [x] Timeline with progress
- [x] Playback speed control
- [x] Browser TTS working
- [x] Mobile responsive

### Should Have (Next Iteration)
- [ ] Download audio as MP3
- [ ] Continue playing when modal closes
- [ ] Remember playback position
- [ ] Keyboard shortcuts
- [ ] Volume control
- [ ] Audio waveform visualization

### Could Have (Future)
- [ ] Azure Speech integration
- [ ] Multiple voice options
- [ ] Background music
- [ ] Daily digest mode
- [ ] Podcast RSS feed
- [ ] Offline support

## Implementation Notes

### Performance Considerations
- Initialize audio service once per session
- Cache generated scripts
- Lazy load audio player component
- Use requestAnimationFrame for progress updates

### Accessibility
- Keyboard navigation support
- Screen reader announcements
- Visible focus indicators
- Sufficient color contrast

### Error Handling
- Gracefully handle missing speech synthesis
- Fallback for unsupported browsers
- Network error recovery
- User feedback for all states

## Migration Path to Azure Speech

When ready to upgrade from browser TTS to Azure:

1. Update `audioConfig.js` to enable Azure
2. Implement `AzureSpeechService` class
3. Replace `SpeechSynthesisUtterance` with Azure API calls
4. Store generated MP3 files
5. Add download functionality
6. Implement caching strategy

---

## Summary

This implementation provides a professional audio narration system for PlexifyAEC reports, transforming text summaries into listenable briefings. The browser TTS approach enables immediate functionality while the architecture supports future enhancement with premium voices and additional multimedia features.