import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceInput as VoiceInputType, ProcessedVoiceContent, VoiceContentType } from '../types/field';
import { v4 as uuidv4 } from 'uuid';

// Define SpeechRecognition interface for TypeScript
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Define window with SpeechRecognition for TypeScript
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface VoiceInputProps {
  onVoiceInputComplete: (voiceInput: VoiceInputType) => void;
  onCancel: () => void;
  projectId: string;
  placeholder?: string;
  maxDuration?: number; // in seconds
}

/**
 * VoiceInput Component
 * 
 * Provides voice recording functionality using the Web Speech API
 * with visual feedback and mock AI processing
 */
const VoiceInput: React.FC<VoiceInputProps> = ({
  onVoiceInputComplete,
  onCancel,
  projectId,
  placeholder = "Press the microphone button and speak...",
  maxDuration = 60
}) => {
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [processedContent, setProcessedContent] = useState<ProcessedVoiceContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  
  // Initialize speech recognition
  useEffect(() => {
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported in this browser");
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsRecording(true);
      setStatus('recording');
      startTimeRef.current = new Date();
      
      // Start duration timer
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000);
          setDuration(elapsed);
          
          // Auto-stop if max duration reached
          if (elapsed >= maxDuration) {
            stopRecording();
          }
        }
      }, 1000);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log("Speech recognition result received", event);
      
      // Reset interim transcript for this result batch
      let currentInterimTranscript = '';
      let finalTranscript = '';
      let highestConfidence = 0;
      
      // Process all results since last event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        console.log(`Result ${i}: ${result[0].transcript}, isFinal: ${result.isFinal}`);
        
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
          // Update highest confidence if this result has higher confidence
          if (result[0].confidence > highestConfidence) {
            highestConfidence = result[0].confidence;
          }
        } else {
          currentInterimTranscript += result[0].transcript;
        }
      }
      
      // Only update final transcript if we have new final content
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        console.log("Updated final transcript:", transcript + finalTranscript);
      }
      
      setInterimTranscript(currentInterimTranscript);
      console.log("Current interim transcript:", currentInterimTranscript);
      
      if (highestConfidence > 0) {
        setConfidence(highestConfidence);
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event);
      setError(`Error: ${event.error} - ${event.message}`);
      setStatus('failed');
      stopRecording();
    };
    
    recognition.onend = () => {
      console.log("Speech recognition ended");
      console.log("Final transcript:", transcript);
      
      // Only process if we have actual transcript and weren't manually cancelled
      if (transcript.trim() && status === 'recording') {
        processTranscription();
      } else if (status === 'recording') {
        setStatus('failed');
        setError("No speech detected. Please try again.");
      }
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
    
    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [transcript, confidence, status, maxDuration]);
  
  // Start recording
  const startRecording = useCallback(() => {
    if (recognitionRef.current) {
      // Reset state
      setTranscript("");
      setInterimTranscript("");
      setDuration(0);
      setConfidence(0);
      setError(null);
      setStatus('idle');
      setProcessedContent(null);
      
      // Start recognition
      try {
        console.log("Starting speech recognition...");
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setError('Failed to start recording. Please try again.');
      }
    } else {
      console.error("Speech recognition is not available");
      setError("Speech recognition is not available.");
    }
  }, []);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      console.log("Stopping speech recognition...");
      recognitionRef.current.stop();
    }
  }, []);
  
  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (isRecording) {
      if (isPaused) {
        // Resume recording
        if (recognitionRef.current) {
          console.log("Resuming speech recognition...");
          recognitionRef.current.start();
        }
        setIsPaused(false);
      } else {
        // Pause recording
        if (recognitionRef.current) {
          console.log("Pausing speech recognition...");
          recognitionRef.current.stop();
        }
        setIsPaused(true);
      }
    }
  }, [isRecording, isPaused]);
  
  // Mock AI processing of transcription
  const processTranscription = useCallback(() => {
    setIsProcessing(true);
    setStatus('processing');
    
    // Simulate AI processing delay
    setTimeout(() => {
      // Mock AI content type detection based on transcript content
      let contentType: VoiceContentType = 'general';
      let structuredData: any = {};
      let enhancedText = transcript;
      
      // Simple keyword-based detection for demo purposes
      const lowerTranscript = transcript.toLowerCase();
      
      if (lowerTranscript.includes('completed') || lowerTranscript.includes('finished') || lowerTranscript.includes('installed')) {
        contentType = 'workCompleted';
        
        // Extract potential location
        let location = 'unknown location';
        if (lowerTranscript.includes('floor')) {
          const floorMatch = lowerTranscript.match(/(\d+)(?:st|nd|rd|th)? floor/i);
          if (floorMatch) location = floorMatch[0];
        } else if (lowerTranscript.includes('area') || lowerTranscript.includes('section')) {
          const areaMatch = lowerTranscript.match(/(north|south|east|west|central) (area|section)/i);
          if (areaMatch) location = areaMatch[0];
        }
        
        // Extract potential trade
        let trades = [];
        if (lowerTranscript.includes('electrical')) trades.push('Electrical');
        if (lowerTranscript.includes('plumbing')) trades.push('Plumbing');
        if (lowerTranscript.includes('concrete')) trades.push('Concrete');
        if (lowerTranscript.includes('steel')) trades.push('Steel');
        if (lowerTranscript.includes('carpentry')) trades.push('Carpentry');
        
        // Extract potential quantity
        let quantity = null;
        let unit = null;
        const quantityMatch = lowerTranscript.match(/(\d+)\s+(feet|meters|yards|square feet|cubic yards|tons)/i);
        if (quantityMatch) {
          quantity = parseInt(quantityMatch[1]);
          unit = quantityMatch[2];
        }
        
        structuredData = {
          id: uuidv4(),
          description: enhanceWorkDescription(transcript),
          location: location,
          status: 'completed',
          progress: 100,
          trades: trades.length > 0 ? trades : ['General'],
          quantity: quantity,
          unit: unit,
          notes: transcript
        };
        
        // Enhance text with more professional construction terminology
        enhancedText = enhanceWorkDescription(transcript);
      } else if (lowerTranscript.includes('safety') || lowerTranscript.includes('hazard') || lowerTranscript.includes('incident')) {
        contentType = 'safetyObservation';
        
        // Determine severity
        let severity = 'medium';
        if (lowerTranscript.includes('critical') || lowerTranscript.includes('severe') || lowerTranscript.includes('emergency')) {
          severity = 'critical';
        } else if (lowerTranscript.includes('minor') || lowerTranscript.includes('low')) {
          severity = 'low';
        }
        
        // Determine type
        let type = 'observation';
        if (lowerTranscript.includes('incident')) type = 'incident';
        if (lowerTranscript.includes('near miss')) type = 'near-miss';
        if (lowerTranscript.includes('violation')) type = 'violation';
        
        structuredData = {
          id: uuidv4(),
          type: type,
          description: enhanceSafetyDescription(transcript),
          location: extractLocation(transcript),
          severity: severity,
          status: 'open',
          dateTime: new Date(),
          reportedBy: 'Field User',
          requiresFollowup: severity === 'critical' || severity === 'high'
        };
        
        enhancedText = enhanceSafetyDescription(transcript);
      } else if (lowerTranscript.includes('issue') || lowerTranscript.includes('problem') || lowerTranscript.includes('delay')) {
        contentType = 'issue';
        
        // Determine priority
        let priority = 'medium';
        if (lowerTranscript.includes('critical') || lowerTranscript.includes('urgent') || lowerTranscript.includes('immediate')) {
          priority = 'critical';
        } else if (lowerTranscript.includes('minor') || lowerTranscript.includes('low')) {
          priority = 'low';
        } else if (lowerTranscript.includes('high') || lowerTranscript.includes('major')) {
          priority = 'high';
        }
        
        structuredData = {
          id: uuidv4(),
          title: extractIssueTitle(transcript),
          description: transcript,
          location: extractLocation(transcript),
          priority: priority,
          status: 'open',
          category: determineIssueCategory(transcript),
          createdDate: new Date(),
          reportedBy: 'Field User',
          impact: {
            schedule: lowerTranscript.includes('schedule') || lowerTranscript.includes('delay'),
            budget: lowerTranscript.includes('cost') || lowerTranscript.includes('budget'),
            quality: lowerTranscript.includes('quality') || lowerTranscript.includes('standard'),
            safety: lowerTranscript.includes('safety') || lowerTranscript.includes('hazard')
          }
        };
        
        enhancedText = enhanceIssueDescription(transcript);
      } else if (lowerTranscript.includes('weather') || lowerTranscript.includes('rain') || lowerTranscript.includes('temperature')) {
        contentType = 'weather';
        
        // Extract temperature if mentioned
        let temperature = null;
        const tempMatch = lowerTranscript.match(/(\d+)\s*(?:degrees|°)\s*(?:fahrenheit|celsius|f|c)?/i);
        if (tempMatch) {
          temperature = parseInt(tempMatch[1]);
        }
        
        structuredData = {
          temperature: temperature || 72,
          temperatureUnit: lowerTranscript.includes('celsius') || lowerTranscript.includes('c') ? 'C' : 'F',
          conditions: extractWeatherConditions(transcript),
          precipitation: estimatePrecipitation(transcript),
          windSpeed: estimateWindSpeed(transcript),
          windSpeedUnit: 'mph',
          humidity: 50, // Default value
          impactDescription: extractWeatherImpact(transcript),
          delayedWork: lowerTranscript.includes('delay') || lowerTranscript.includes('stop') || lowerTranscript.includes('halt')
        };
        
        enhancedText = enhanceWeatherDescription(transcript);
      }
      
      // Create processed content
      const processedContent: ProcessedVoiceContent = {
        type: contentType,
        structuredData: structuredData,
        enhancedText: enhancedText,
        confidence: Math.min(0.7 + (confidence * 0.3), 0.98), // Scale up confidence but cap at 0.98
        entities: extractEntities(transcript)
      };
      
      setProcessedContent(processedContent);
      setStatus('completed');
      setIsProcessing(false);
      
      // Create final voice input object
      const voiceInput: VoiceInputType = {
        id: uuidv4(),
        timestamp: new Date(),
        rawTranscription: transcript,
        duration: duration,
        confidence: confidence,
        status: 'completed',
        processedContent: processedContent
      };
      
      // Notify parent component
      onVoiceInputComplete(voiceInput);
    }, 2000); // 2 second processing delay for demo
  }, [transcript, confidence, duration, onVoiceInputComplete]);
  
  // Helper functions for AI processing simulation
  
  const extractLocation = (text: string): string => {
    const locationPatterns = [
      /(?:at|in|on)\s+(?:the\s+)?([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\s+(?:area|section|floor|room|building|site)/i,
      /([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\s+(?:area|section|floor|room|building|site)/i,
      /(?:north|south|east|west|central)\s+(?:area|section|wing)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return "Main construction area";
  };
  
  const extractEntities = (text: string) => {
    const entities = [];
    
    // Extract locations
    const locationMatch = text.match(/(?:at|in|on)\s+(?:the\s+)?([a-z0-9]+(?:\s+[a-z0-9]+){0,3})\s+(?:area|section|floor|room|building|site)/i);
    if (locationMatch) {
      entities.push({
        type: 'location',
        value: locationMatch[0],
        confidence: 0.85,
        startIndex: locationMatch.index || 0,
        endIndex: (locationMatch.index || 0) + locationMatch[0].length
      });
    }
    
    // Extract trades
    const trades = ['electrical', 'plumbing', 'concrete', 'steel', 'carpentry', 'masonry', 'hvac', 'painting'];
    trades.forEach(trade => {
      const regex = new RegExp(`\\b${trade}\\b`, 'i');
      const match = text.match(regex);
      if (match) {
        entities.push({
          type: 'trade',
          value: trade,
          confidence: 0.9,
          startIndex: match.index || 0,
          endIndex: (match.index || 0) + match[0].length
        });
      }
    });
    
    // Extract quantities
    const quantityMatch = text.match(/(\d+)\s+(feet|meters|yards|square feet|cubic yards|tons)/i);
    if (quantityMatch) {
      entities.push({
        type: 'quantity',
        value: quantityMatch[0],
        confidence: 0.8,
        startIndex: quantityMatch.index || 0,
        endIndex: (quantityMatch.index || 0) + quantityMatch[0].length
      });
    }
    
    return entities;
  };
  
  const extractIssueTitle = (text: string): string => {
    // Take first sentence or first 50 characters
    const firstSentence = text.split(/[.!?]/, 1)[0];
    if (firstSentence.length < 50) return firstSentence;
    return firstSentence.substring(0, 47) + '...';
  };
  
  const determineIssueCategory = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('design') || lowerText.includes('drawing') || lowerText.includes('specification')) return 'design';
    if (lowerText.includes('material') || lowerText.includes('supply') || lowerText.includes('delivery')) return 'material';
    if (lowerText.includes('equipment') || lowerText.includes('machine') || lowerText.includes('tool')) return 'equipment';
    if (lowerText.includes('worker') || lowerText.includes('crew') || lowerText.includes('labor')) return 'personnel';
    if (lowerText.includes('rain') || lowerText.includes('snow') || lowerText.includes('temperature')) return 'weather';
    if (lowerText.includes('build') || lowerText.includes('install') || lowerText.includes('construct')) return 'construction';
    return 'other';
  };
  
  const extractWeatherConditions = (text: string): string[] => {
    const conditions = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('rain') || lowerText.includes('shower')) conditions.push('Rain');
    if (lowerText.includes('snow') || lowerText.includes('flurry')) conditions.push('Snow');
    if (lowerText.includes('wind') || lowerText.includes('gust')) conditions.push('Windy');
    if (lowerText.includes('fog') || lowerText.includes('mist')) conditions.push('Fog');
    if (lowerText.includes('cloud')) conditions.push('Cloudy');
    if (lowerText.includes('sun') || lowerText.includes('clear')) conditions.push('Sunny');
    if (lowerText.includes('hot') || lowerText.includes('heat')) conditions.push('Hot');
    if (lowerText.includes('cold') || lowerText.includes('freez')) conditions.push('Cold');
    if (lowerText.includes('humid')) conditions.push('Humid');
    
    return conditions.length > 0 ? conditions : ['Clear'];
  };
  
  const estimatePrecipitation = (text: string): number => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('heavy rain') || lowerText.includes('downpour')) return 1.5;
    if (lowerText.includes('rain') || lowerText.includes('shower')) return 0.5;
    if (lowerText.includes('light rain') || lowerText.includes('drizzle')) return 0.1;
    if (lowerText.includes('snow')) return 2.0;
    
    return 0;
  };
  
  const estimateWindSpeed = (text: string): number => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('strong wind') || lowerText.includes('high wind')) return 25;
    if (lowerText.includes('wind')) return 15;
    if (lowerText.includes('breeze')) return 8;
    
    return 5;
  };
  
  const extractWeatherImpact = (text: string): string => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('delay') || lowerText.includes('stop') || lowerText.includes('halt')) {
      return 'Weather conditions have caused work delays';
    }
    
    if (lowerText.includes('slow') || lowerText.includes('difficult')) {
      return 'Weather conditions have slowed work progress';
    }
    
    if (lowerText.includes('no impact') || lowerText.includes('not affect')) {
      return 'No significant impact on construction activities';
    }
    
    return 'Weather conditions noted with minimal impact on work';
  };
  
  const enhanceWorkDescription = (text: string): string => {
    // This would be replaced with actual AI processing
    // For demo, we'll just make it sound more professional
    let enhanced = text;
    
    // Replace common phrases with more professional construction terminology
    enhanced = enhanced.replace(/put up/gi, 'installed');
    enhanced = enhanced.replace(/fixed/gi, 'remediated');
    enhanced = enhanced.replace(/finished/gi, 'completed');
    enhanced = enhanced.replace(/worked on/gi, 'executed');
    
    return enhanced;
  };
  
  const enhanceSafetyDescription = (text: string): string => {
    // This would be replaced with actual AI processing
    // For demo, we'll just make it sound more professional
    let enhanced = text;
    
    // Replace common phrases with more professional safety terminology
    enhanced = enhanced.replace(/saw a problem/gi, 'observed a safety concern');
    enhanced = enhanced.replace(/dangerous/gi, 'hazardous');
    enhanced = enhanced.replace(/unsafe/gi, 'non-compliant with safety standards');
    
    return enhanced;
  };
  
  const enhanceIssueDescription = (text: string): string => {
    // This would be replaced with actual AI processing
    // For demo, we'll just make it sound more professional
    let enhanced = text;
    
    // Replace common phrases with more professional issue terminology
    enhanced = enhanced.replace(/problem with/gi, 'issue regarding');
    enhanced = enhanced.replace(/can't/gi, 'unable to');
    enhanced = enhanced.replace(/broke/gi, 'malfunctioned');
    
    return enhanced;
  };
  
  const enhanceWeatherDescription = (text: string): string => {
    // This would be replaced with actual AI processing
    // For demo, we'll just make it sound more professional
    let enhanced = text;
    
    // Replace common phrases with more professional weather terminology
    enhanced = enhanced.replace(/rained a lot/gi, 'experienced heavy precipitation');
    enhanced = enhanced.replace(/very hot/gi, 'elevated temperatures');
    enhanced = enhanced.replace(/windy/gi, 'high wind conditions');
    
    return enhanced;
  };
  
  // Render
  return (
    <div className="voice-input-container bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex flex-col space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Voice Input</h3>
          {status !== 'idle' && (
            <button 
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Cancel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            status === 'recording' ? 'bg-red-500 animate-pulse' : 
            status === 'processing' ? 'bg-yellow-500' :
            status === 'completed' ? 'bg-green-500' :
            status === 'failed' ? 'bg-red-500' :
            'bg-gray-300'
          }`}></div>
          <span className="text-sm text-gray-600">
            {status === 'idle' && 'Ready to record'}
            {status === 'recording' && `Recording${isPaused ? ' (Paused)' : ''} - ${duration}s`}
            {status === 'processing' && 'Processing audio...'}
            {status === 'completed' && 'Recording complete'}
            {status === 'failed' && 'Recording failed'}
          </span>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        
        {/* Transcription display */}
        <div className={`min-h-[100px] max-h-[200px] overflow-y-auto p-3 rounded-lg ${
          status === 'idle' ? 'bg-gray-50 text-gray-400' : 'bg-white border border-gray-200 text-gray-800'
        }`}>
          {transcript || interimTranscript ? (
            <>
              <p className="mb-2">{transcript}</p>
              {interimTranscript && (
                <p className="text-gray-400 italic">{interimTranscript}</p>
              )}
            </>
          ) : (
            <p className="text-gray-400">{placeholder}</p>
          )}
        </div>
        
        {/* Processed content display */}
        {processedContent && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <h4 className="text-sm font-medium text-blue-800 mb-1">AI-Enhanced Content</h4>
            <p className="text-gray-800">{processedContent.enhancedText}</p>
            
            <div className="mt-2">
              <span className="text-xs font-medium text-blue-700">Detected Type:</span>
              <span className="text-xs ml-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {processedContent.type.charAt(0).toUpperCase() + processedContent.type.slice(1)}
              </span>
              
              <span className="text-xs font-medium text-blue-700 ml-3">Confidence:</span>
              <span className="text-xs ml-1">
                {Math.round(processedContent.confidence * 100)}%
              </span>
            </div>
            
            {processedContent.entities.length > 0 && (
              <div className="mt-2">
                <span className="text-xs font-medium text-blue-700">Detected Entities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {processedContent.entities.map((entity, index) => (
                    <span key={index} className="text-xs bg-white text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                      {entity.type}: {entity.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {status === 'idle' && (
            <button
              onClick={startRecording}
              className="voice-capture-button"
              aria-label="Start recording"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          
          {status === 'recording' && (
            <>
              <button
                onClick={togglePause}
                className="field-action-button bg-yellow-600"
                aria-label={isPaused ? "Resume recording" : "Pause recording"}
              >
                {isPaused ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={stopRecording}
                className="voice-capture-button animate-pulse"
                aria-label="Stop recording"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            </>
          )}
          
          {status === 'processing' && (
            <div className="flex items-center justify-center h-16">
              <svg className="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-primary-700">Processing voice input...</span>
            </div>
          )}
          
          {status === 'completed' && (
            <div className="flex space-x-3">
              <button
                onClick={startRecording}
                className="btn btn-secondary"
                aria-label="Record again"
              >
                Record Again
              </button>
            </div>
          )}
          
          {status === 'failed' && (
            <button
              onClick={startRecording}
              className="btn btn-primary"
              aria-label="Try again"
            >
              Try Again
            </button>
          )}
        </div>
        
        {/* Progress bar for recording duration */}
        {isRecording && (
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-red-600 h-2.5 rounded-full" 
              style={{ width: `${(duration / maxDuration) * 100}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceInput;
