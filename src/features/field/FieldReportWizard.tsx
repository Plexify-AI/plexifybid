import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import VoiceInput from '../../components/VoiceInput';
import PhotoCapture from '../../components/PhotoCapture';
import { 
  FieldReport, 
  VoiceInput as VoiceInputType,
  PhotoCapture as PhotoCaptureType,
  FieldReportWorkItem,
  FieldReportSafetyItem,
  FieldReportIssue
} from '../../types/field';
import { mockDailyReports } from '../../services/simpleMockData';
import { UnifiedDailyIntelligence } from '../../types';
import useReportStore from '../../store/reportStore';

/**
 * Field Report Wizard Component
 * 
 * Simplified wizard for field personnel to create reports with voice input,
 * photo capture, and AI enhancement that feeds directly to executive dashboard
 */
const FieldReportWizard: React.FC = () => {
  const navigate = useNavigate();
  
  // Get store methods for report management
  const { addFieldReport, addPhotoToReport } = useReportStore();
  
  // Mock project data
  const projects = mockDailyReports.map(report => ({
    id: report.projectId,
    name: report.projectName,
    location: report.location || 'Project location'
  }));
  
  // Simplified wizard steps
  const wizardSteps = [
    { id: 'project', title: 'Project Selection', description: 'Select the project you are reporting on' },
    { id: 'capture', title: 'Quick Capture', description: 'Use voice and photos to document site conditions' },
    { id: 'enhance', title: 'AI Enhancement', description: 'Let AI enhance your report with insights' },
    { id: 'review', title: 'Review & Submit', description: 'Review and submit your report' }
  ];
  
  // Initialize empty field report
  const initialReport: FieldReport = {
    id: uuidv4(),
    projectId: '',
    reportDate: new Date(),
    createdBy: {
      id: 'field-user-1',
      name: 'Field User',
      role: 'Superintendent'
    },
    status: 'draft',
    completionProgress: 0,
    lastModified: new Date(),
    
    generalInfo: {
      projectName: '',
      location: '',
      reportType: 'daily',
      shift: 'day',
      generalNotes: ''
    },
    
    weatherConditions: {
      temperature: 72,
      temperatureUnit: 'F',
      conditions: ['Clear'],
      precipitation: 0,
      windSpeed: 5,
      windSpeedUnit: 'mph',
      humidity: 50,
      delayedWork: false
    },
    
    workCompleted: [],
    workPlanned: [],
    safetyObservations: [],
    issues: [],
    materials: [],
    equipment: [],
    personnel: [],
    photos: [],
    voiceNotes: [],
    
    aiEnhancements: undefined
  };
  
  // State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [report, setReport] = useState<FieldReport>(initialReport);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showVoiceInput, setShowVoiceInput] = useState<boolean>(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState<boolean>(false);
  const [aiProcessingProgress, setAiProcessingProgress] = useState<number>(0);
  const [aiProcessingStep, setAiProcessingStep] = useState<string>('');
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  const [executiveFeedPreview, setExecutiveFeedPreview] = useState<UnifiedDailyIntelligence | null>(null);
  
  // Refs
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update progress when changing steps
  useEffect(() => {
    const progress = Math.round((currentStepIndex / (wizardSteps.length - 1)) * 100);
    setReport(prev => ({
      ...prev,
      completionProgress: progress,
      lastModified: new Date()
    }));
  }, [currentStepIndex, wizardSteps.length]);
  
  // Navigate to next step
  const handleNextStep = useCallback(() => {
    if (currentStepIndex < wizardSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }, [currentStepIndex, wizardSteps.length]);
  
  // Navigate to previous step
  const handlePreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);
  
  // Handle project selection
  const handleProjectSelect = useCallback((projectId: string) => {
    const selectedProject = projects.find(p => p.id === projectId);
    
    if (selectedProject) {
      setReport(prev => ({
        ...prev,
        projectId: selectedProject.id,
        generalInfo: {
          ...prev.generalInfo,
          projectName: selectedProject.name,
          location: selectedProject.location
        }
      }));
    }
  }, [projects]);
  
  // Handle voice input toggle
  const handleVoiceInputToggle = useCallback(() => {
    setShowVoiceInput(prev => !prev);
  }, []);
  
  // Process voice input
  const handleVoiceInputComplete = useCallback((voiceInput: VoiceInputType) => {
    // Add voice note to report
    setReport(prev => ({
      ...prev,
      voiceNotes: [...prev.voiceNotes, voiceInput]
    }));
    
    // Process based on the content type
    if (voiceInput.processedContent) {
      const { type, structuredData } = voiceInput.processedContent;
      
      switch (type) {
        case 'workCompleted':
          setReport(prev => ({
            ...prev,
            workCompleted: [...prev.workCompleted, structuredData as FieldReportWorkItem]
          }));
          break;
          
        case 'safetyObservation':
          setReport(prev => ({
            ...prev,
            safetyObservations: [...prev.safetyObservations, structuredData as FieldReportSafetyItem]
          }));
          break;
          
        case 'issue':
          setReport(prev => ({
            ...prev,
            issues: [...prev.issues, structuredData as FieldReportIssue]
          }));
          break;
          
        case 'weather':
          setReport(prev => ({
            ...prev,
            weatherConditions: {
              ...prev.weatherConditions,
              ...structuredData
            }
          }));
          break;
          
        case 'general':
          setReport(prev => ({
            ...prev,
            generalInfo: {
              ...prev.generalInfo,
              generalNotes: prev.generalInfo.generalNotes 
                ? `${prev.generalInfo.generalNotes}\n\n${voiceInput.rawTranscription}`
                : voiceInput.rawTranscription
            }
          }));
          break;
      }
    }
    
    // Close voice input
    setShowVoiceInput(false);
  }, []);
  
  // Handle photo capture toggle
  const handlePhotoCaptureToggle = useCallback(() => {
    setShowPhotoCapture(prev => !prev);
  }, []);
  
  // Process captured photo - Updated to use the store
  const handlePhotoCaptureComplete = useCallback((photo: PhotoCaptureType) => {
    // Add photo to local report state
    setReport(prev => {
      const updatedReport = {
        ...prev,
        photos: [...prev.photos, photo]
      };
      
      // If we have a project ID, also add to the store for immediate sync to executive view
      if (updatedReport.projectId) {
        addPhotoToReport(updatedReport.id, photo);
      }
      
      return updatedReport;
    });
    
    // Close photo capture
    setShowPhotoCapture(false);
  }, [addPhotoToReport]);
  
  // Simulate AI processing
  const simulateAIProcessing = useCallback(() => {
    setIsProcessing(true);
    setAiProcessingProgress(0);
    setAiProcessingStep('Initializing AI processing...');
    
    // Simulate processing steps with progress updates
    const totalSteps = 5;
    let currentStep = 0;
    
    progressTimerRef.current = setInterval(() => {
      currentStep++;
      const progress = Math.round((currentStep / totalSteps) * 100);
      setAiProcessingProgress(progress);
      
      switch (currentStep) {
        case 1:
          setAiProcessingStep('Analyzing field data...');
          break;
        case 2:
          setAiProcessingStep('Processing voice transcriptions...');
          break;
        case 3:
          setAiProcessingStep('Analyzing site photos...');
          break;
        case 4:
          setAiProcessingStep('Generating executive intelligence...');
          break;
        case 5:
          setAiProcessingStep('Preparing executive feed update...');
          
          // Clear the timer when processing is complete
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
          }
          
          // Generate executive feed preview
          const executiveIntelligence = generateExecutiveFeedItem(report);
          setExecutiveFeedPreview(executiveIntelligence);
          
          // Update report with AI enhancements
          setReport(prev => ({
            ...prev,
            aiEnhancements: {
              executiveSummary: generateExecutiveSummary(report),
              technicalNarrative: generateTechnicalNarrative(report),
              ownerUpdate: generateOwnerUpdate(report),
              suggestedFlags: {
                scheduleImpact: hasScheduleImpact(report),
                safetyIncident: hasSafetyIncident(report),
                ownerNotification: hasOwnerNotification(report),
                budgetImpact: hasBudgetImpact(report),
                weatherDelay: hasWeatherDelay(report)
              },
              suggestedTags: ['construction', 'field-report', 'daily'],
              suggestedFollowups: generateFollowups(report)
            },
            status: 'ai-processing'
          }));
          
          // Move to next step after a short delay
          setTimeout(() => {
            setIsProcessing(false);
            handleNextStep();
          }, 1000);
          break;
      }
    }, 1200);
    
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [report, handleNextStep]);
  
  // Generate executive feed item from field report
  const generateExecutiveFeedItem = (fieldReport: FieldReport): UnifiedDailyIntelligence => {
    // Create a mock unified daily intelligence item based on the field report
    const intelligence: UnifiedDailyIntelligence = {
      id: `exec-${fieldReport.id}`,
      projectId: fieldReport.projectId,
      projectName: fieldReport.generalInfo.projectName,
      projectPhase: 'Construction',
      reportDate: new Date(),
      superintendent: {
        id: fieldReport.createdBy.id,
        name: fieldReport.createdBy.name,
        email: 'superintendent@example.com',
        phone: '555-123-4567'
      },
      location: fieldReport.generalInfo.location,
      weather: {
        temperature: fieldReport.weatherConditions.temperature,
        conditions: fieldReport.weatherConditions.conditions.join(', '),
        impact: fieldReport.weatherConditions.delayedWork ? 'Delayed work' : 'No impact'
      },
      flags: {
        scheduleImpact: hasScheduleImpact(fieldReport),
        safetyIncident: hasSafetyIncident(fieldReport),
        ownerNotification: hasOwnerNotification(fieldReport),
        budgetImpact: hasBudgetImpact(fieldReport),
        weatherDelay: hasWeatherDelay(fieldReport)
      },
      narratives: {
        executive: generateExecutiveSummary(fieldReport),
        technical: generateTechnicalNarrative(fieldReport),
        owner: generateOwnerUpdate(fieldReport)
      },
      fieldReport: {
        workCompleted: fieldReport.workCompleted,
        workPlanned: fieldReport.workPlanned,
        safetyObservations: fieldReport.safetyObservations
      },
      context: {
        activeRFIs: [],
        openIssues: fieldReport.issues.map(issue => ({
          id: issue.id,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
          createdDate: issue.createdDate,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }))
      },
      media: {
        photos: fieldReport.photos.map(photo => ({
          id: photo.id,
          url: photo.uri,
          caption: photo.caption,
          dateTime: photo.timestamp,
          location: photo.location?.room || fieldReport.generalInfo.location
        })),
        videos: [],
        documents: []
      }
    };
    
    return intelligence;
  };
  
  // Helper function to generate executive summary
  const generateExecutiveSummary = (report: FieldReport): string => {
    const projectName = report.generalInfo.projectName;
    const location = report.generalInfo.location;
    const workCompleted = report.workCompleted.length;
    const issues = report.issues.length;
    const safetyItems = report.safetyObservations.length;
    const weatherConditions = report.weatherConditions.conditions.join(', ');
    
    let summary = `Daily field report for ${projectName} at ${location}. `;
    
    if (workCompleted > 0) {
      summary += `Completed ${workCompleted} work items today. `;
    }
    
    if (issues > 0) {
      const criticalIssues = report.issues.filter(i => i.priority === 'critical').length;
      if (criticalIssues > 0) {
        summary += `Identified ${criticalIssues} critical issues requiring immediate attention. `;
      } else {
        summary += `Documented ${issues} issues. `;
      }
    }
    
    if (safetyItems > 0) {
      const incidents = report.safetyObservations.filter(s => s.type === 'incident').length;
      if (incidents > 0) {
        summary += `Reported ${incidents} safety incidents. `;
      } else {
        summary += `Recorded ${safetyItems} safety observations. `;
      }
    }
    
    if (report.weatherConditions.delayedWork) {
      summary += `Weather conditions (${weatherConditions}) caused delays in scheduled work. `;
    } else {
      summary += `Weather conditions: ${weatherConditions}. `;
    }
    
    if (report.photos.length > 0) {
      summary += `Documented with ${report.photos.length} site photos. `;
    }
    
    return summary;
  };
  
  // Helper function to generate technical narrative
  const generateTechnicalNarrative = (report: FieldReport): string => {
    const projectName = report.generalInfo.projectName;
    let narrative = `Technical Daily Report - ${projectName} - ${formatDate(report.reportDate)}\n\n`;
    
    // Weather section
    narrative += `WEATHER CONDITIONS:\n`;
    narrative += `Temperature: ${report.weatherConditions.temperature}°${report.weatherConditions.temperatureUnit}, `;
    narrative += `Conditions: ${report.weatherConditions.conditions.join(', ')}\n\n`;
    
    // Work completed section
    narrative += `WORK COMPLETED:\n`;
    if (report.workCompleted.length > 0) {
      report.workCompleted.forEach((item, index) => {
        narrative += `${index + 1}. ${item.description} - Location: ${item.location}\n`;
      });
    } else {
      narrative += `No work completed items recorded.\n`;
    }
    narrative += '\n';
    
    // Safety section
    if (report.safetyObservations.length > 0) {
      narrative += `SAFETY:\n`;
      report.safetyObservations.forEach((item, index) => {
        narrative += `${index + 1}. ${item.type.toUpperCase()}: ${item.description}\n`;
      });
      narrative += '\n';
    }
    
    // Issues section
    if (report.issues.length > 0) {
      narrative += `ISSUES & CHALLENGES:\n`;
      report.issues.forEach((item, index) => {
        narrative += `${index + 1}. ${item.title} (${item.priority.toUpperCase()})\n`;
      });
    }
    
    return narrative;
  };
  
  // Helper function to generate owner update
  const generateOwnerUpdate = (report: FieldReport): string => {
    const projectName = report.generalInfo.projectName;
    let update = `${projectName} - Daily Progress Update - ${formatDate(report.reportDate)}\n\n`;
    
    update += `Dear Project Stakeholders,\n\n`;
    
    // Highlight key accomplishments
    if (report.workCompleted.length > 0) {
      update += `Today's Progress Highlights:\n`;
      report.workCompleted.forEach((item, index) => {
        update += `• ${item.description}\n`;
      });
      update += '\n';
    }
    
    // Note any critical issues
    const criticalIssues = report.issues.filter(i => i.priority === 'critical' || i.priority === 'high');
    if (criticalIssues.length > 0) {
      update += `Items Requiring Attention:\n`;
      criticalIssues.forEach(issue => {
        update += `• ${issue.title}\n`;
      });
      update += '\n';
    }
    
    // Photos reference
    if (report.photos.length > 0) {
      update += `Today's report includes ${report.photos.length} site photos documenting current progress.\n\n`;
    }
    
    update += `Regards,\n${report.createdBy.name}\n${report.createdBy.role}`;
    
    return update;
  };
  
  // Generate followups based on report content
  const generateFollowups = (report: FieldReport): string[] => {
    const followups: string[] = [];
    
    // Add followups for critical issues
    report.issues
      .filter(issue => issue.priority === 'critical' || issue.priority === 'high')
      .forEach(issue => {
        followups.push(`Resolve critical issue: ${issue.title}`);
      });
    
    // Add followups for safety incidents
    report.safetyObservations
      .filter(safety => safety.type === 'incident')
      .forEach(safety => {
        followups.push(`Follow up on safety ${safety.type}: ${safety.description}`);
      });
    
    return followups;
  };
  
  // Helper functions to determine flags
  const hasScheduleImpact = (report: FieldReport): boolean => {
    return report.issues.some(issue => 
      issue.description.toLowerCase().includes('schedule') ||
      issue.description.toLowerCase().includes('delay')
    ) || report.weatherConditions.delayedWork;
  };
  
  const hasSafetyIncident = (report: FieldReport): boolean => {
    return report.safetyObservations.some(safety => safety.type === 'incident');
  };
  
  const hasOwnerNotification = (report: FieldReport): boolean => {
    return report.issues.some(issue => issue.priority === 'critical');
  };
  
  const hasBudgetImpact = (report: FieldReport): boolean => {
    return report.issues.some(issue => 
      issue.description.toLowerCase().includes('budget') ||
      issue.description.toLowerCase().includes('cost')
    );
  };
  
  const hasWeatherDelay = (report: FieldReport): boolean => {
    return report.weatherConditions.delayedWork;
  };
  
  // Helper function to format date
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Submit report - Updated to use the store
  const handleSubmitReport = useCallback(() => {
    setIsSubmitting(true);
    
    // Update report status
    const finalReport = {
      ...report,
      status: 'submitted',
      lastModified: new Date()
    };
    
    // Save to the store to sync with executive view
    addFieldReport(finalReport);
    
    // Update local state
    setReport(finalReport);
    
    // Simulate submission delay for UI feedback
    setTimeout(() => {
      // Show success message
      setShowSuccessMessage(true);
      
      // Navigate to executive view after a delay
      setTimeout(() => {
        setIsSubmitting(false);
        navigate('/executive');
      }, 2000);
    }, 1500);
  }, [report, addFieldReport, navigate]);
  
  // Render the current step content
  const renderStepContent = () => {
    const currentStep = wizardSteps[currentStepIndex];
    
    switch (currentStep.id) {
      case 'project':
        return renderProjectSelection();
      case 'capture':
        return renderQuickCapture();
      case 'enhance':
        return renderAIEnhancement();
      case 'review':
        return renderReview();
      default:
        return <div>Unknown step</div>;
    }
  };
  
  // Render project selection step
  const renderProjectSelection = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Select Project</h2>
        <p className="text-gray-600">Choose the project you are reporting on today.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {projects.map(project => (
            <div 
              key={project.id}
              className={`project-card p-4 cursor-pointer transition-colors ${
                report.projectId === project.id 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
              }`}
              onClick={() => handleProjectSelect(project.id)}
            >
              <h3 className="font-medium text-gray-900">{project.name}</h3>
              <p className="text-sm text-gray-500">{project.location}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render quick capture step
  const renderQuickCapture = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Quick Capture</h2>
        <p className="text-gray-600">Use voice and photos to quickly document site conditions.</p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center my-8">
          <button
            onClick={handleVoiceInputToggle}
            className="voice-capture-button flex flex-col items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-sm font-medium">Voice Input</span>
          </button>
          
          <button
            onClick={handlePhotoCaptureToggle}
            className="field-action-button bg-blue-600 flex flex-col items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium">Photo Capture</span>
          </button>
        </div>
        
        {/* Summary of captured content */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">Captured Content</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex items-center text-gray-700 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="font-medium">Voice Notes</span>
              </div>
              <p className="text-sm text-gray-600">{report.voiceNotes.length} voice notes captured</p>
            </div>
            
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex items-center text-gray-700 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Work Items</span>
              </div>
              <p className="text-sm text-gray-600">{report.workCompleted.length} work items documented</p>
            </div>
            
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex items-center text-gray-700 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Photos</span>
              </div>
              <p className="text-sm text-gray-600">{report.photos.length} photos captured</p>
            </div>
          </div>
          
          {/* Photo gallery preview */}
          {report.photos.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Photo Gallery</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {report.photos.slice(0, 4).map(photo => (
                  <div key={photo.id} className="bg-gray-100 rounded-lg overflow-hidden h-24 relative">
                    <img 
                      src={photo.uri} 
                      alt={photo.caption} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-1">
                      <p className="text-white text-xs truncate">{photo.caption}</p>
                    </div>
                  </div>
                ))}
                {report.photos.length > 4 && (
                  <div className="bg-gray-100 rounded-lg overflow-hidden h-24 flex items-center justify-center">
                    <span className="text-gray-500 font-medium">+{report.photos.length - 4} more</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render AI enhancement step
  const renderAIEnhancement = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">AI Enhancement</h2>
        <p className="text-gray-600">Let AI analyze your report and enhance it with insights.</p>
        
        {isProcessing ? (
          <div className="bg-white rounded-lg p-6 border border-gray-200 text-center">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
              <div 
                className="bg-primary-600 h-2.5 rounded-full" 
                style={{ width: `${aiProcessingProgress}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-primary-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-lg font-medium text-primary-700">{aiProcessingStep}</span>
            </div>
            
            <p className="text-gray-500">Please wait while our AI analyzes your field report...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Enhance Your Report</h3>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              Our AI will analyze your field data, enhance descriptions, generate executive summaries, 
              and prepare your report for the executive dashboard.
            </p>
            <button
              onClick={simulateAIProcessing}
              className="btn btn-primary"
            >
              Start AI Enhancement
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // Render review step
  const renderReview = () => {
    return (
      <div className="space-y-6">
        {showSuccessMessage ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Report Submitted Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your field report has been processed and added to the Executive Intelligence Feed.
            </p>
            <button
              onClick={() => navigate('/executive')}
              className="btn btn-primary"
            >
              View in Executive Dashboard
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-gray-900">Review & Submit</h2>
            <p className="text-gray-600">Review your enhanced report before submission.</p>
            
            {/* Executive Feed Preview */}
            {executiveFeedPreview && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">Executive Feed Preview</h3>
                  <p className="text-sm text-gray-500">Here's how your report will appear in the Executive Intelligence Feed</p>
                </div>
                
                <div className="p-4">
                  <div className="intelligence-card">
                    <div className="intelligence-card-header">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">{executiveFeedPreview.projectName}</h2>
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="mr-2">{executiveFeedPreview.projectPhase}</span>
                          <span>•</span>
                          <span className="ml-2">{executiveFeedPreview.superintendent.name}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(executiveFeedPreview.reportDate)}
                      </div>
                    </div>
                    
                    <div className="intelligence-card-body">
                      {/* Flags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {executiveFeedPreview.flags.scheduleImpact && (
                          <span className="status-flag status-flag-schedule">Schedule Impact</span>
                        )}
                        {executiveFeedPreview.flags.safetyIncident && (
                          <span className="status-flag status-flag-safety">Safety Incident</span>
                        )}
                        {executiveFeedPreview.flags.ownerNotification && (
                          <span className="status-flag status-flag-owner">Owner Notification</span>
                        )}
                        {executiveFeedPreview.flags.budgetImpact && (
                          <span className="status-flag status-flag-budget">Budget Impact</span>
                        )}
                        {executiveFeedPreview.flags.weatherDelay && (
                          <span className="status-flag status-flag-weather">Weather Delay</span>
                        )}
                      </div>
                      
                      {/* Executive Summary */}
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h3>
                        <p className="text-gray-800">
                          {executiveFeedPreview.narratives.executive}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Enhanced Report Summary */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Enhanced Report Summary</h3>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Project Details</h4>
                    <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Project:</span> {report.generalInfo.projectName}</p>
                    <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Location:</span> {report.generalInfo.location}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium">Report Date:</span> {formatDate(report.reportDate)}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Report Statistics</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Work Items</p>
                        <p className="text-lg font-medium text-gray-900">{report.workCompleted.length}</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Photos</p>
                        <p className="text-lg font-medium text-gray-900">{report.photos.length}</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Issues</p>
                        <p className="text-lg font-medium text-gray-900">{report.issues.length}</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-xs text-gray-500">Safety Items</p>
                        <p className="text-lg font-medium text-gray-900">{report.safetyObservations.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {report.aiEnhancements && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">AI-Enhanced Content</h4>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-800">{report.aiEnhancements.executiveSummary}</p>
                    </div>
                    
                    {report.aiEnhancements.suggestedFlags && (
                      <div className="mt-3">
                        <h5 className="text-xs font-medium text-gray-700 mb-1">Suggested Flags</h5>
                        <div className="flex flex-wrap gap-2">
                          {report.aiEnhancements.suggestedFlags.scheduleImpact && (
                            <span className="status-flag status-flag-schedule">Schedule Impact</span>
                          )}
                          {report.aiEnhancements.suggestedFlags.safetyIncident && (
                            <span className="status-flag status-flag-safety">Safety Incident</span>
                          )}
                          {report.aiEnhancements.suggestedFlags.ownerNotification && (
                            <span className="status-flag status-flag-owner">Owner Notification</span>
                          )}
                          {report.aiEnhancements.suggestedFlags.budgetImpact && (
                            <span className="status-flag status-flag-budget">Budget Impact</span>
                          )}
                          {report.aiEnhancements.suggestedFlags.weatherDelay && (
                            <span className="status-flag status-flag-weather">Weather Delay</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-center mt-6">
              <button
                onClick={handleSubmitReport}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit to Operations Dashboard'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };
  
  // Render voice input modal
  const renderVoiceInputModal = () => {
    if (!showVoiceInput) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
          <VoiceInput 
            onVoiceInputComplete={handleVoiceInputComplete}
            onCancel={() => setShowVoiceInput(false)}
            projectId={report.projectId}
          />
        </div>
      </div>
    );
  };
  
  // Render photo capture modal
  const renderPhotoCaptureModal = () => {
    if (!showPhotoCapture) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
          <PhotoCapture 
            onPhotoComplete={handlePhotoCaptureComplete}
            onCancel={() => setShowPhotoCapture(false)}
            projectId={report.projectId}
            initialLocation={report.generalInfo.location}
          />
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Wizard Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Field Report Wizard</h1>
        <p className="text-gray-600">Create a comprehensive field report with voice and photo capture</p>
        
        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-medium text-gray-700">{report.completionProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-primary-600 h-2.5 rounded-full" 
              style={{ width: `${report.completionProgress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Steps */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
          {wizardSteps.map((step, index) => (
            <div 
              key={step.id}
              className={`p-3 rounded-lg text-center cursor-pointer ${
                index === currentStepIndex
                  ? 'bg-primary-100 border-2 border-primary-500'
                  : index < currentStepIndex
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}
              onClick={() => index <= currentStepIndex + 1 && setCurrentStepIndex(index)}
            >
              <div className="flex items-center justify-center mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  index === currentStepIndex
                    ? 'bg-primary-500 text-white'
                    : index < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-700'
                }`}>
                  {index < currentStepIndex ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
              <div className="text-xs font-medium">
                {step.title}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
        {renderStepContent()}
      </div>
      
      {/* Navigation Buttons */}
      {!showSuccessMessage && (
        <div className="flex justify-between">
          <button
            onClick={handlePreviousStep}
            disabled={currentStepIndex === 0}
            className={`btn ${
              currentStepIndex === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-secondary'
            }`}
          >
            Previous
          </button>
          
          {currentStepIndex < wizardSteps.length - 1 && (
            <button
              onClick={handleNextStep}
              className="btn btn-primary"
            >
              Next
            </button>
          )}
        </div>
      )}
      
      {/* Modals */}
      {renderVoiceInputModal()}
      {renderPhotoCaptureModal()}
    </div>
  );
};

export default FieldReportWizard;
