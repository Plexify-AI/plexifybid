/**
 * AudioNarrationService - Bloomberg-Style Audio Briefings
 * 
 * Transforms PlexifyAEC construction reports into professional audio briefings
 * using browser Text-to-Speech API with chapter navigation and playback controls.
 */

class AudioNarrationService {
  constructor() {
    this.isPlaying = false;
    this.currentUtterance = null;
    this.utteranceQueue = [];
    this.chapterTimestamps = {};
    this.totalDuration = 0;
    this.playbackRate = 1.0;
    this.currentUtteranceIndex = 0;
    this.currentTime = 0;
    this.currentChapter = 'intro';
    
    // Event handlers
    this.onTimeUpdate = null;
    this.onChapterChange = null;
    this.onComplete = null;
    this.onError = null;
    
    // Check for voice availability
    this.initializeVoices();
    
    // Time tracking interval
    this.timeUpdateInterval = null;
  }
  
  initializeVoices() {
    // Get available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      console.log('📢 Available voices:', voices.map(v => ({ name: v.name, lang: v.lang })));
      
      // Prefer high-quality voices in order of preference
      this.preferredVoice = 
        voices.find(v => v.name.includes('Microsoft David') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Microsoft Zira') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Microsoft Mark') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Alex') && v.lang.startsWith('en')) ||
        voices.find(v => v.lang.startsWith('en-US')) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0];
      
      console.log('🎙️ Selected voice:', this.preferredVoice?.name || 'Default voice');
    };
    
    // Voices may load async
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoices();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }
  
  async prepareAudioBriefing(report) {
    console.log('🎧 Preparing audio briefing for:', report.projectName);
    
    // Clear any existing queue
    this.clearQueue();
    
    // Generate the conversational script
    const script = this.generateScript(report);
    
    console.log('📝 Generated script chapters:', Object.keys(script));
    
    // Create utterances for each chapter
    let currentTime = 0;
    this.utteranceQueue = [];
    this.chapterTimestamps = {};
    
    const chapters = [
      'intro', 'summary', 'work', 'issues', 'safety', 'tomorrow', 'closing'
    ];
    
    for (const chapterId of chapters) {
      const text = script[chapterId];
      if (!text || text.trim().length === 0) continue;
      
      this.chapterTimestamps[chapterId] = currentTime;
      
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }
      utterance.rate = this.playbackRate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Store chapter info on utterance
      utterance.chapterId = chapterId;
      
      // Estimate duration (approximately 150 words per minute, adjusted for pauses)
      const wordCount = text.split(' ').length;
      const estimatedDuration = (wordCount / 140) * 60; // Slightly slower for clarity
      currentTime += estimatedDuration;
      
      this.utteranceQueue.push(utterance);
    }
    
    this.totalDuration = currentTime;
    this.currentTime = 0;
    this.currentChapter = 'intro';
    
    console.log('⏱️ Total estimated duration:', Math.round(this.totalDuration), 'seconds');
    console.log('📊 Chapter timestamps:', this.chapterTimestamps);
    
    return this.totalDuration;
  }
  
  generateScript(report) {
    const projectName = report.projectName || 'the project';
    const superintendent = report.superintendent?.name || 'the field team';
    const date = new Date(report.reportDate || Date.now()).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long', 
      day: 'numeric'
    });
    const time = new Date(report.reportDate || Date.now()).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    
    // Extract content from report structure
    const executiveSummary = report.narratives?.executive || 
                             report.executiveSummary || 
                             'Executive summary not available';
    
    const workCompleted = report.fieldReport?.workCompleted || 
                          report.workCompleted || 
                          [];
    
    const safetyObservations = report.fieldReport?.safetyObservations || 
                               report.safetyObservations || 
                               [];
    
    const openIssues = report.context?.openIssues || 
                       report.issues || 
                       [];
    
    // Build conversational script with professional tone
    const script = {
      intro: `Good ${this.getTimeOfDay()}. This is your PlexifyAEC construction intelligence briefing 
              for ${projectName}. This report was filed by ${superintendent} on ${date} at ${time}. 
              Let's review today's key developments.`,
      
      summary: `Here's your executive summary. ${this.cleanTextForSpeech(executiveSummary)}`,
      
      work: this.generateWorkScript(workCompleted),
      
      issues: this.generateIssuesScript(openIssues),
      
      safety: this.generateSafetyScript(safetyObservations),
      
      tomorrow: report.narratives?.technical ? 
                `Looking ahead to tomorrow's activities. ${this.cleanTextForSpeech(report.narratives.technical)}` :
                `Tomorrow's work will continue as scheduled per the project timeline.`,
      
      closing: `This concludes your audio briefing for ${projectName}. 
                The complete written report with photos and technical details is available in your dashboard. 
                Have a productive ${this.getTimeOfDay()}.`
    };
    
    return script;
  }
  
  generateWorkScript(workCompleted) {
    if (!workCompleted || workCompleted.length === 0) {
      return 'No specific work activities were reported for today.';
    }
    
    if (Array.isArray(workCompleted)) {
      const workItems = workCompleted.slice(0, 3).map(work => {
        let script = work.description || 'Work activity reported';
        if (work.location) script += ` at ${work.location}`;
        if (work.quantity && work.unit) script += `, ${work.quantity} ${work.unit}`;
        return script;
      }).join('. ');
      
      return `Today's work progress includes: ${this.cleanTextForSpeech(workItems)}`;
    }
    
    return `Work completed today: ${this.cleanTextForSpeech(workCompleted)}`;
  }
  
  generateIssuesScript(openIssues) {
    if (!openIssues || openIssues.length === 0) {
      return 'No critical issues or delays are reported at this time.';
    }
    
    if (Array.isArray(openIssues)) {
      const criticalIssues = openIssues.filter(issue => 
        issue.priority === 'critical' || issue.priority === 'high'
      );
      
      if (criticalIssues.length > 0) {
        const issueText = criticalIssues.slice(0, 2).map(issue => 
          `${issue.title}: ${issue.description || 'Details in written report'}`
        ).join('. ');
        
        return `Issues requiring your attention: ${this.cleanTextForSpeech(issueText)}`;
      }
      
      return `${openIssues.length} minor issues are being tracked. Details are in the written report.`;
    }
    
    return `Issues update: ${this.cleanTextForSpeech(openIssues)}`;
  }
  
  generateSafetyScript(safetyObservations) {
    if (!safetyObservations || safetyObservations.length === 0) {
      return 'Safety status: All clear with no incidents reported today.';
    }
    
    if (Array.isArray(safetyObservations)) {
      const incidents = safetyObservations.filter(safety => 
        safety.type === 'incident' || safety.severity === 'high'
      );
      
      if (incidents.length > 0) {
        const incidentText = incidents[0].description || 'Safety incident reported';
        return `Safety alert: ${this.cleanTextForSpeech(incidentText)}. See the full report for details and corrective actions.`;
      }
      
      return `Safety update: ${safetyObservations.length} observations recorded. All routine with no incidents.`;
    }
    
    return `Safety report: ${this.cleanTextForSpeech(safetyObservations)}`;
  }
  
  cleanTextForSpeech(text) {
    if (typeof text !== 'string') return '';
    
    return text
      .replace(/\[.*?\]/g, '') // Remove markdown links
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\*/g, '') // Remove italic markers
      .replace(/\n+/g, '. ') // Replace line breaks with pauses
      .replace(/[•·]/g, '') // Remove bullet points
      .replace(/&/g, 'and') // Replace ampersand
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\.\s*\./g, '.') // Remove double periods
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
      console.warn('⚠️ No audio prepared');
      this.onError?.('No audio content prepared');
      return;
    }
    
    console.log('▶️ Starting audio playback');
    
    // Cancel any existing speech
    window.speechSynthesis.cancel();
    
    // Start playing from current position
    this.playFromCurrentPosition();
    this.isPlaying = true;
    
    // Start time tracking
    this.startTimeTracking();
  }
  
  playFromCurrentPosition() {
    // Find which chapter to start from based on current time
    let startIndex = 0;
    const chapterEntries = Object.entries(this.chapterTimestamps);
    
    for (let i = 0; i < chapterEntries.length; i++) {
      if (chapterEntries[i][1] <= this.currentTime) {
        startIndex = i;
        this.currentChapter = chapterEntries[i][0];
      }
    }
    
    this.currentUtteranceIndex = startIndex;
    this.playNextUtterance();
  }
  
  playNextUtterance() {
    if (this.currentUtteranceIndex >= this.utteranceQueue.length) {
      console.log('🏁 Audio playback complete');
      this.isPlaying = false;
      this.stopTimeTracking();
      this.onComplete?.();
      return;
    }
    
    const utterance = this.utteranceQueue[this.currentUtteranceIndex];
    
    console.log('🎵 Playing chapter:', utterance.chapterId);
    
    // Update current chapter
    this.currentChapter = utterance.chapterId;
    this.onChapterChange?.(utterance.chapterId);
    
    utterance.onend = () => {
      this.currentUtteranceIndex++;
      if (this.isPlaying) {
        this.playNextUtterance();
      }
    };
    
    utterance.onerror = (event) => {
      console.error('❌ Speech synthesis error:', event);
      this.onError?.(`Speech error: ${event.error}`);
      this.currentUtteranceIndex++;
      if (this.isPlaying) {
        this.playNextUtterance();
      }
    };
    
    window.speechSynthesis.speak(utterance);
  }
  
  pause() {
    console.log('⏸️ Pausing audio');
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
    this.isPlaying = false;
    this.stopTimeTracking();
  }
  
  resume() {
    console.log('▶️ Resuming audio');
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else {
      // If not paused, restart from current position
      this.playFromCurrentPosition();
    }
    this.isPlaying = true;
    this.startTimeTracking();
  }
  
  stop() {
    console.log('⏹️ Stopping audio');
    window.speechSynthesis.cancel();
    this.isPlaying = false;
    this.currentUtteranceIndex = 0;
    this.currentTime = 0;
    this.currentChapter = 'intro';
    this.stopTimeTracking();
  }
  
  seekTo(timeInSeconds) {
    console.log('⏭️ Seeking to:', timeInSeconds);
    
    // Update current time
    this.currentTime = Math.max(0, Math.min(timeInSeconds, this.totalDuration));
    
    // Find the chapter that contains this timestamp
    let targetChapter = 'intro';
    const chapterEntries = Object.entries(this.chapterTimestamps);
    
    for (let i = chapterEntries.length - 1; i >= 0; i--) {
      if (chapterEntries[i][1] <= this.currentTime) {
        targetChapter = chapterEntries[i][0];
        break;
      }
    }
    
    // Stop current playback
    const wasPlaying = this.isPlaying;
    this.stop();
    
    // Update chapter
    this.currentChapter = targetChapter;
    this.onChapterChange?.(targetChapter);
    
    // Restart if was playing
    if (wasPlaying) {
      this.play();
    }
  }
  
  jumpToChapter(chapterId) {
    const timestamp = this.chapterTimestamps[chapterId];
    if (timestamp !== undefined) {
      this.seekTo(timestamp);
    }
  }
  
  setPlaybackRate(rate) {
    console.log('🏃 Setting playback rate:', rate);
    this.playbackRate = rate;
    
    // Update all queued utterances
    this.utteranceQueue.forEach(utterance => {
      utterance.rate = rate;
    });
    
    // If currently playing, restart with new rate
    if (this.isPlaying) {
      const wasPlaying = true;
      this.pause();
      setTimeout(() => {
        if (wasPlaying) this.resume();
      }, 100);
    }
  }
  
  startTimeTracking() {
    this.stopTimeTracking();
    
    this.timeUpdateInterval = setInterval(() => {
      if (this.isPlaying) {
        // Increment time based on playback rate
        this.currentTime += this.playbackRate;
        this.currentTime = Math.min(this.currentTime, this.totalDuration);
        
        // Check for chapter changes
        const chapterEntries = Object.entries(this.chapterTimestamps);
        for (let i = chapterEntries.length - 1; i >= 0; i--) {
          const [chapterId, timestamp] = chapterEntries[i];
          if (timestamp <= this.currentTime && this.currentChapter !== chapterId) {
            this.currentChapter = chapterId;
            this.onChapterChange?.(chapterId);
            break;
          }
        }
        
        this.onTimeUpdate?.(this.currentTime);
      }
    }, 1000);
  }
  
  stopTimeTracking() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }
  
  // Getters
  getTotalDuration() {
    return this.totalDuration;
  }
  
  getCurrentTime() {
    return this.currentTime;
  }
  
  getCurrentChapter() {
    return this.currentChapter;
  }
  
  getChapterTimestamps() {
    return this.chapterTimestamps;
  }
  
  isSupported() {
    return 'speechSynthesis' in window;
  }
  
  clearQueue() {
    this.stop();
    this.utteranceQueue = [];
    this.chapterTimestamps = {};
    this.totalDuration = 0;
    this.currentTime = 0;
    this.currentChapter = 'intro';
  }
}

export default AudioNarrationService;