import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, 
  Upload, 
  FileText, 
  Pause, 
  Play, 
  Square, 
  Loader, 
  Check, 
  Edit2,
  Clock,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import useReportStore from '../../store/reportStore';
import { enhanceTranscriptWithAI } from '../../services/claudeProxy';

// Types for better type safety
interface ProcessedReport {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  rawTranscript: string;
  enhancedReport: string;
  audioUrl?: string;
  superintendent: {
    name: string;
    id: string;
  };
  status: 'submitted';
  createdAt: string;
}

// Voice recording hook with full functionality
const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  
  const startRecording = async () => {
    try {
      setError(null);
      setTranscript('');
      chunksRef.current = [];
      
      // Get microphone stream with optimized settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      
      streamRef.current = stream;
      
      // Create MediaRecorder for audio capture
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Start live transcription
      startLiveTranscription();
      
      // Auto-stop at 5 minutes
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, 300000); // 5 minutes
      
    } catch (error) {
      console.error('Microphone access error:', error);
      setError('Unable to access microphone. Please allow microphone permissions and try again.');
      throw error;
    }
  };
  
  const startLiveTranscription = () => {
    // Check browser support for Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Browser does not support speech recognition');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    let finalTranscript = '';
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText + ' ';
        } else {
          interimTranscript += transcriptText;
        }
      }
      
      setTranscript(finalTranscript + interimTranscript);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        console.log('No speech detected. Continuing...');
      } else if (event.error === 'network') {
        setError('Network error during transcription. Audio is still being recorded.');
      }
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
    };
    
    try {
      recognition.start();
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  return { 
    isRecording, 
    audioBlob, 
    duration, 
    transcript,
    error,
    startRecording, 
    stopRecording
  };
};

// Format time helper
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get dynamic prompts based on recording duration
const getPromptForDuration = (seconds: number): string => {
  if (seconds < 5) return "Start with weather and crew size...";
  if (seconds < 15) return "What work was completed today?";
  if (seconds < 25) return "Any issues or delays?";
  if (seconds < 35) return "Safety observations?";
  if (seconds < 45) return "What's planned for tomorrow?";
  return "Almost done! Wrap up your report...";
};

// Recording Interface Component
const RecordingInterface: React.FC<{
  onStartRecording: () => void;
  onUploadRecording: () => void;
  onUseForm: () => void;
}> = ({ onStartRecording, onUploadRecording, onUseForm }) => {
  const { executiveIntelligence } = useReportStore();
  
  // Get recent reports
  const recentReports = executiveIntelligence.slice(0, 3);
  
  return (
    <div className="recording-interface p-6 flex flex-col items-center">
      {/* Instructions */}
      <div className="instructions text-center mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Record your daily report</h2>
        <p className="text-gray-700 text-lg mb-6">
          Tap the button and describe today's work, issues, and safety observations
        </p>
        <div className="prompt-chips flex flex-wrap gap-2 justify-center">
          <span className="prompt-chip">Weather conditions</span>
          <span className="prompt-chip">Work completed</span>
          <span className="prompt-chip">Crew size</span>
          <span className="prompt-chip">Issues encountered</span>
          <span className="prompt-chip">Tomorrow's plan</span>
        </div>
      </div>
      
      {/* Large Record Button */}
      <div className="record-button-container mb-8">
        <button className="record-button" onClick={onStartRecording}>
          <div className="record-btn-outer">
            <div className="record-btn-inner">
              <Mic size={48} className="mic-icon" />
            </div>
          </div>
        </button>
        <span className="record-label">Tap to Start Recording</span>
      </div>
      
      {/* Alternative Options */}
      <div className="alternatives w-full max-w-md">
        <div className="divider">
          <span>Or</span>
        </div>
        
        <div className="alt-options grid grid-cols-2 gap-4 mt-6">
          <button className="alt-btn upload" onClick={onUploadRecording}>
            <Upload size={24} />
            <span>Upload Recording</span>
          </button>
          <button className="alt-btn form" onClick={onUseForm}>
            <FileText size={24} />
            <span>Use Form</span>
          </button>
        </div>
      </div>
      
      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <div className="recent-reports w-full max-w-md mt-8">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Reports</h3>
          <div className="report-list space-y-2">
            {recentReports.map((report, index) => (
              <div key={report.id} className="report-item">
                <div className="report-item-content">
                  <span className="report-date">
                    {index === 0 ? 'Today' : index === 1 ? 'Yesterday' : '2 days ago'}
                  </span>
                  <span className="report-time">
                    {new Date(report.reportDate).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <span className="report-status submitted">Submitted</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Active Recording Component
const ActiveRecording: React.FC<{
  duration: number;
  isRecording: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}> = ({ duration, isRecording, onPause, onResume, onStop }) => {
  return (
    <div className="active-recording flex flex-col items-center p-6">
      {/* Recording Indicator */}
      <div className="recording-indicator">
        <div className="pulse-ring"></div>
        <div className="recording-dot"></div>
      </div>
      
      {/* Timer */}
      <div className="timer mt-8 text-4xl font-mono font-bold text-gray-900">
        {formatTime(duration)}
      </div>
      
      {/* Waveform Visualization Placeholder */}
      <div className="waveform w-full max-w-md h-24 mt-8 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="waveform-bars flex items-end gap-1">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="waveform-bar"
              style={{ 
                height: `${20 + Math.random() * 40}px`,
                animationDelay: `${i * 0.1}s` 
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Recording Prompts */}
      <div className="prompts mt-8 text-center">
        <p className="current-prompt text-lg text-gray-800 font-medium">
          {getPromptForDuration(duration)}
        </p>
      </div>
      
      {/* Controls */}
      <div className="controls mt-8 flex gap-6">
        <button 
          className="control-btn pause"
          onClick={isRecording ? onPause : onResume}
        >
          {isRecording ? <Pause size={28} /> : <Play size={28} />}
          <span>{isRecording ? 'Pause' : 'Resume'}</span>
        </button>
        <button className="control-btn stop" onClick={onStop}>
          <Square size={28} />
          <span>Finish</span>
        </button>
      </div>
      
      {/* Safety Note */}
      <p className="safety-note mt-6 text-sm text-gray-600">
        Recording will auto-stop at 5 minutes
      </p>
    </div>
  );
};

// Processing Screen Component
const ProcessingScreen: React.FC<{
  stage: string;
}> = ({ stage }) => {
  const stages = [
    { id: 'transcribing', label: 'Transcribing audio' },
    { id: 'extracting', label: 'Extracting key information' },
    { id: 'generating', label: 'Generating professional report' },
    { id: 'adding', label: 'Adding to executive feed' }
  ];
  
  const getCurrentStageIndex = () => stages.findIndex(s => s.id === stage);
  
  return (
    <div className="processing-screen p-6 flex flex-col items-center">
      <div className="processing-animation mb-6">
        <Loader className="animate-spin text-blue-600" size={64} />
      </div>
      
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Your Report</h2>
      <p className="text-gray-600 mb-8">Please wait while we enhance your recording...</p>
      
      <div className="stages w-full max-w-md space-y-4">
        {stages.map((stageItem, index) => {
          const currentIndex = getCurrentStageIndex();
          const status = index < currentIndex ? 'complete' : index === currentIndex ? 'active' : 'pending';
          
          return (
            <div key={stageItem.id} className={`process-stage ${status}`}>
              <div className="stage-indicator">
                {status === 'complete' ? (
                  <Check size={20} className="text-green-600" />
                ) : status === 'active' ? (
                  <Loader size={20} className="animate-spin text-blue-600" />
                ) : (
                  <div className="stage-number">{index + 1}</div>
                )}
              </div>
              <span className="stage-label">{stageItem.label}</span>
            </div>
          );
        })}
      </div>
      
      <p className="eta mt-8 text-sm text-gray-600">
        Estimated time: 15-30 seconds
      </p>
    </div>
  );
};

// Report Review Component
const ReportReview: React.FC<{
  report: any;
  onSubmit: () => void;
  onEdit: () => void;
}> = ({ report, onSubmit, onEdit }) => {
  return (
    <div className="report-review p-4">
      <div className="success-banner">
        <Check size={24} className="text-green-600" />
        <span className="text-green-800 font-medium">Report created successfully!</span>
      </div>
      
      {/* Report Preview */}
      <div className="report-preview">
        <h3 className="preview-title">Report Summary</h3>
        
        <div className="report-sections space-y-4">
          <div className="report-section">
            <label className="section-label">Date</label>
            <div className="section-value">{report.date}</div>
          </div>
          
          <div className="report-section">
            <label className="section-label">Weather</label>
            <div className="section-value">{report.weather}</div>
          </div>
          
          <div className="report-section">
            <label className="section-label">Manpower</label>
            <div className="section-value">
              {report.manpower.actual} workers ({report.manpower.planned} planned)
            </div>
          </div>
          
          <div className="report-section">
            <label className="section-label">Work Completed</label>
            <div className="section-value multiline">{report.workCompleted}</div>
          </div>
          
          <div className="report-section">
            <label className="section-label">Issues</label>
            <div className="section-value multiline">{report.issues}</div>
          </div>
          
          <div className="report-section">
            <label className="section-label">Safety</label>
            <div className="section-value">{report.safety}</div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="actions">
        <button className="btn-primary" onClick={onSubmit}>
          Submit Report
        </button>
        <button className="btn-secondary" onClick={onEdit}>
          <Edit2 size={20} />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
};



// Storage utilities
const saveReportToStorage = (report: ProcessedReport) => {
  try {
    const existingReports = JSON.parse(localStorage.getItem('fieldReports') || '[]');
    existingReports.unshift(report); // Add to beginning
    
    // Keep only last 50 reports
    const trimmedReports = existingReports.slice(0, 50);
    
    localStorage.setItem('fieldReports', JSON.stringify(trimmedReports));
    console.log('Report saved to storage');
  } catch (error) {
    console.error('Failed to save report:', error);
  }
};

const updateExecutiveFeed = (report: ProcessedReport) => {
  try {
    const feedData = JSON.parse(localStorage.getItem('executiveFeed') || '[]');
    
    // Create feed item from report
    const feedItem = {
      id: report.id,
      type: 'fieldReport',
      projectName: report.projectName,
      superintendent: report.superintendent,
      summary: report.enhancedReport.substring(0, 200) + '...',
      fullReport: report.enhancedReport,
      timestamp: report.createdAt,
      priority: 'normal'
    };
    
    feedData.unshift(feedItem);
    
    // Keep only last 100 feed items
    const trimmedFeed = feedData.slice(0, 100);
    
    localStorage.setItem('executiveFeed', JSON.stringify(trimmedFeed));
    
    // Trigger update event
    window.dispatchEvent(new CustomEvent('feedUpdate', { 
      detail: feedItem 
    }));
    
    console.log('Executive feed updated');
  } catch (error) {
    console.error('Failed to update executive feed:', error);
  }
};

// Main FieldView Component with full functionality
const FieldView: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'ready' | 'recording' | 'processing' | 'complete' | 'error'>('ready');
  const [selectedProject, setSelectedProject] = useState(''); // No default - force user selection
  const [processingStage, setProcessingStage] = useState('transcribing');
  const [processedReport, setProcessedReport] = useState<ProcessedReport | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const { 
    isRecording, 
    audioBlob, 
    duration, 
    transcript,
    error,
    startRecording, 
    stopRecording 
  } = useVoiceRecording();
  
  const { addExecutiveIntelligence } = useReportStore();
  
  // Mock projects data
  const projects = [
    { id: 'proj1', name: 'Memorial Regional Medical Center' },
    { id: 'proj2', name: 'Centennial Tower' },
    { id: 'proj3', name: 'River Crossing Bridge' },
    { id: 'proj4', name: 'Downtown Convention Center' },
    { id: 'proj5', name: 'Tech Campus Phase II' }
  ];
  
  // Handle start recording
  const handleStartRecording = async () => {
    if (!selectedProject) {
      alert('Please select a project before starting recording.');
      return;
    }
    
    try {
      setErrorMessage('');
      await startRecording();
      setMode('recording');
    } catch (error) {
      console.error('Recording failed:', error);
      setErrorMessage('Unable to access microphone. Please check permissions and try again.');
      setMode('error');
    }
  };
  
  // Handle stop recording
  const handleStopRecording = () => {
    stopRecording();
    if (transcript.trim().length < 10) {
      setErrorMessage('Recording too short. Please try again and speak for at least 10 seconds.');
      setMode('error');
      return;
    }
    setMode('processing');
    processRecording();
  };
  
  // Complete processing pipeline
  const processRecording = async () => {
    try {
      setProcessingStage('transcribing');
      
      // Get the transcript (from live recognition)
      let finalTranscript = transcript.trim();
      
      if (!finalTranscript || finalTranscript.length < 10) {
        throw new Error('No transcript captured. Please try speaking more clearly.');
      }
      
      console.log('Processing transcript:', finalTranscript);
      
      // Enhance with Claude using the new service with better error handling
      setProcessingStage('enhancing');
      const enhancedReport = await enhanceTranscriptWithAI(finalTranscript);
      
      // Create report object with project information
      const selectedProjectData = projects.find(p => p.id === selectedProject);
      const report: ProcessedReport = {
        id: `report-${Date.now()}`,
        date: new Date().toISOString(),
        projectId: selectedProject,
        projectName: selectedProjectData?.name || 'Unknown Project',
        rawTranscript: finalTranscript,
        enhancedReport: enhancedReport,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
        superintendent: {
          name: 'Field Superintendent',
          id: 'user-1'
        },
        status: 'submitted',
        createdAt: new Date().toISOString()
      };
      
      console.log('🎯 Report created for project:', {
        projectId: selectedProject,
        projectName: selectedProjectData?.name,
        reportId: report.id
      });
      
      setProcessingStage('saving');
      
      // Save to localStorage
      saveReportToStorage(report);
      
      // Update executive feed
      updateExecutiveFeed(report);
      
      // Show success
      setProcessingStage('complete');
      setProcessedReport(report);
      setMode('complete');
      
    } catch (error) {
      console.error('Error processing recording:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process recording. Please try again.');
      setMode('error');
    }
  };
  
  // Handle report submission
  const handleSubmitReport = () => {
    if (processedReport) {
      // Create executive intelligence report for the feed
      const executiveReport = {
        id: processedReport.id,
        projectId: processedReport.projectId,
        projectName: processedReport.projectName,
        projectPhase: 'Construction',
        location: 'Construction Site',
        reportDate: new Date(),
        superintendent: {
          id: processedReport.superintendent.id,
          name: processedReport.superintendent.name,
          contact: 'field@contractor.com'
        },
        narratives: {
          executive: processedReport.enhancedReport.substring(0, 500),
          technical: processedReport.rawTranscript,
          owner: processedReport.enhancedReport
        },
        flags: {
          scheduleImpact: processedReport.enhancedReport.toLowerCase().includes('delay'),
          safetyIncident: processedReport.enhancedReport.toLowerCase().includes('incident'),
          ownerNotification: false,
          budgetImpact: processedReport.enhancedReport.toLowerCase().includes('budget'),
          weatherDelay: processedReport.enhancedReport.toLowerCase().includes('weather')
        },
        context: {
          activeRFIs: [],
          openIssues: []
        },
        fieldReport: {
          workCompleted: [{
            id: 'work1',
            description: processedReport.enhancedReport,
            location: 'Field Location',
            status: 'completed' as const,
            trades: ['General Construction']
          }],
          safetyObservations: [{
            id: 'safety1',
            type: 'observation' as const,
            description: 'Safety report included in voice recording',
            location: 'Site Wide',
            dateTime: new Date(),
            severity: 'low' as const,
            status: 'resolved' as const
          }],
          equipmentUsed: [],
          materialDeliveries: [],
          subcontractorActivities: [],
          qualityObservations: []
        },
        media: {
          photos: [],
          documents: []
        }
      };
      
      console.log('📊 Submitting executive intelligence report:', {
        projectId: executiveReport.projectId,
        projectName: executiveReport.projectName,
        reportId: executiveReport.id
      });
      
      addExecutiveIntelligence(executiveReport);
      
      console.log('✅ Report successfully submitted to Executive Feed');
      
      // Reset and navigate
      setMode('ready');
      setProcessedReport(null);
      
      // Navigate back to executive feed
      navigate('/home');
    }
  };
  
  const handleRetry = () => {
    setMode('ready');
    setErrorMessage('');
    setProcessedReport(null);
  };
  
  return (
    <div className="field-view">
      {/* Header */}
      <div className="field-header">
        <h1 className="field-title">Priority Report</h1>
        <div className="project-selector">
          <div className="select-container">
            <select 
              value={selectedProject} 
              onChange={(e) => {
                console.log('🎯 Project selected:', e.target.value);
                setSelectedProject(e.target.value);
              }}
              className={`project-select ${selectedProject ? 'selected' : 'placeholder'}`}
            >
              <option value="">Select Project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown className="select-icon" size={20} />
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="field-content">
        {mode === 'ready' && (
          <RecordingInterface
            onStartRecording={handleStartRecording}
            onUploadRecording={() => alert('Upload feature coming soon')}
            onUseForm={() => alert('Form feature coming soon')}
          />
        )}
        
        {mode === 'recording' && (
          <div className="recording-screen p-6">
            <div className="text-center mb-6">
              <div className="recording-indicator mb-4">
                <div className="pulse-ring"></div>
                <div className="recording-dot"></div>
              </div>
              
              <div className="timer text-4xl font-mono font-bold text-gray-900 mb-4">
                {formatTime(duration)}
              </div>
              
              <p className="current-prompt text-lg text-gray-800 font-medium mb-6">
                {getPromptForDuration(duration)}
              </p>
              
              <button 
                className="control-btn stop bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg"
                onClick={handleStopRecording}
              >
                <Square size={24} className="mr-2" />
                Stop Recording
              </button>
            </div>
            
            {/* Live Transcript Display */}
            {transcript && (
              <div className="transcript-display bg-white rounded-lg p-4 mt-6 max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-800">Live Transcript:</h3>
                  <button 
                    onClick={() => setShowTranscript(!showTranscript)}
                    className="text-blue-600 text-sm"
                  >
                    {showTranscript ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showTranscript && (
                  <div className="text-gray-700 bg-gray-50 rounded p-3 max-h-40 overflow-y-auto">
                    {transcript}
                  </div>
                )}
              </div>
            )}
            
            {error && (
              <div className="error-display bg-red-50 border border-red-200 rounded-lg p-4 mt-4 max-w-2xl mx-auto">
                <div className="flex items-center">
                  <AlertCircle className="text-red-600 mr-2" size={20} />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {mode === 'processing' && (
          <div className="processing-screen p-6 flex flex-col items-center">
            <div className="processing-animation mb-6">
              <Loader className="animate-spin text-blue-600" size={64} />
            </div>
            
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Your Report</h2>
            <p className="text-gray-600 mb-8">Please wait while we enhance your recording...</p>
            
            <div className="stages w-full max-w-md space-y-4">
              {[
                { id: 'transcribing', label: 'Processing transcript' },
                { id: 'enhancing', label: 'Enhancing with AI' },
                { id: 'saving', label: 'Saving report' },
                { id: 'complete', label: 'Complete!' }
              ].map((stage, index) => {
                const isActive = processingStage === stage.id;
                const isComplete = ['transcribing', 'enhancing', 'saving'].slice(0, index).every(s => 
                  ['enhancing', 'saving', 'complete'].includes(processingStage) || processingStage === 'complete'
                );
                
                return (
                  <div key={stage.id} className={`process-stage ${isComplete ? 'complete' : isActive ? 'active' : 'pending'}`}>
                    <div className="stage-indicator">
                      {isComplete ? (
                        <Check size={20} className="text-green-600" />
                      ) : isActive ? (
                        <Loader size={20} className="animate-spin text-blue-600" />
                      ) : (
                        <div className="stage-number text-gray-400">{index + 1}</div>
                      )}
                    </div>
                    <span className="stage-label">{stage.label}</span>
                  </div>
                );
              })}
            </div>
            
            <p className="eta mt-8 text-sm text-gray-600">
              This may take 15-30 seconds...
            </p>
          </div>
        )}
        
        {mode === 'complete' && processedReport && (
          <div className="complete-screen p-6">
            <div className="success-banner bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center">
              <Check size={24} className="text-green-600 mr-3" />
              <span className="text-green-800 font-medium">Report created successfully!</span>
            </div>
            
            <div className="report-preview bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Report</h3>
              
              <div className="report-content">
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-600">Project: </span>
                  <span className="text-gray-900">{processedReport.projectName}</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-600">Date: </span>
                  <span className="text-gray-900">
                    {new Date(processedReport.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="enhanced-report bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                  <h4 className="font-medium mb-2">Enhanced Report:</h4>
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {processedReport.enhancedReport}
                  </div>
                </div>
                
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    View original transcript
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700">
                    {processedReport.rawTranscript}
                  </div>
                </details>
              </div>
            </div>
            
            <div className="actions flex gap-4">
              <button
                className="btn-primary flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 font-medium"
                onClick={handleSubmitReport}
              >
                Submit to Operations Dashboard
              </button>
              <button 
                className="btn-secondary px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                onClick={() => setMode('ready')}
              >
                Create New Report
              </button>
            </div>
          </div>
        )}
        
        {mode === 'error' && (
          <div className="error-screen p-6 flex flex-col items-center">
            <div className="error-icon mb-4">
              <AlertCircle size={64} className="text-red-600" />
            </div>
            
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Recording Failed</h2>
            <p className="text-gray-600 mb-6 text-center max-w-md">
              {errorMessage || error || 'An error occurred while processing your recording.'}
            </p>
            
            <div className="actions flex gap-4">
              <button 
                className="btn-primary bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 font-medium"
                onClick={handleRetry}
              >
                Try Again
              </button>
              <button 
                className="btn-secondary px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                onClick={() => navigate('/home')}
              >
                Back to Feed
              </button>
            </div>
            
            <div className="troubleshooting mt-8 bg-blue-50 rounded-lg p-4 max-w-md">
              <h3 className="font-semibold text-blue-900 mb-2">Troubleshooting Tips:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Check microphone permissions in browser settings</li>
                <li>• Ensure you're using Chrome, Edge, or Safari</li>
                <li>• Speak clearly and close to your microphone</li>
                <li>• Record for at least 10 seconds</li>
                <li>• Check your internet connection</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldView;