import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { FieldReport, PhotoCapture } from '../types/field';
import { UnifiedDailyIntelligence } from '../types';
import { mockDailyReports } from '../services/simpleMockData';

// Define the store state interface
interface ReportState {
  // Field reports data
  fieldReports: FieldReport[];
  
  // Executive intelligence data (derived from field reports)
  executiveIntelligence: UnifiedDailyIntelligence[];
  
  // Actions
  addFieldReport: (report: FieldReport) => void;
  updateFieldReport: (reportId: string, updatedReport: Partial<FieldReport>) => void;
  addPhotoToReport: (reportId: string, photo: PhotoCapture) => void;
  getFieldReportById: (reportId: string) => FieldReport | undefined;
  getExecutiveIntelligenceById: (id: string) => UnifiedDailyIntelligence | undefined;
  addExecutiveIntelligence: (intelligence: UnifiedDailyIntelligence) => void;
  
  // Conversion functions
  convertToExecutiveIntelligence: (fieldReport: FieldReport) => UnifiedDailyIntelligence;
  
  // Sync functions
  syncFieldReportToExecutive: (reportId: string) => void;
}

/**
 * Report Store
 * 
 * Central store for managing field reports and executive intelligence data
 * Handles synchronization between field view and executive dashboard
 */
const useReportStore = create<ReportState>((set, get) => ({
  // Initialize with mock data for demonstration
  fieldReports: [],
  executiveIntelligence: mockDailyReports,
  
  // Add a new field report
  addFieldReport: (report: FieldReport) => {
    set(state => {
      const newReports = [...state.fieldReports, report];
      
      // Automatically convert and add to executive intelligence
      const execIntelligence = get().convertToExecutiveIntelligence(report);
      const newExecIntelligence = [...state.executiveIntelligence, execIntelligence];
      
      return { 
        fieldReports: newReports,
        executiveIntelligence: newExecIntelligence
      };
    });
  },
  
  // Update an existing field report
  updateFieldReport: (reportId: string, updatedReport: Partial<FieldReport>) => {
    set(state => {
      const reportIndex = state.fieldReports.findIndex(r => r.id === reportId);
      
      if (reportIndex === -1) return state;
      
      const updatedReports = [...state.fieldReports];
      updatedReports[reportIndex] = {
        ...updatedReports[reportIndex],
        ...updatedReport,
        lastModified: new Date()
      };
      
      // Sync changes to executive intelligence
      get().syncFieldReportToExecutive(reportId);
      
      return { fieldReports: updatedReports };
    });
  },
  
  // Add a photo to a specific report
  addPhotoToReport: (reportId: string, photo: PhotoCapture) => {
    set(state => {
      const reportIndex = state.fieldReports.findIndex(r => r.id === reportId);
      
      if (reportIndex === -1) return state;
      
      const updatedReports = [...state.fieldReports];
      updatedReports[reportIndex] = {
        ...updatedReports[reportIndex],
        photos: [...updatedReports[reportIndex].photos, photo],
        lastModified: new Date()
      };
      
      // Sync the photo to executive intelligence
      const execIndex = state.executiveIntelligence.findIndex(
        e => e.id === `exec-${reportId}` || e.projectId === updatedReports[reportIndex].projectId
      );
      
      if (execIndex !== -1) {
        const updatedExecIntelligence = [...state.executiveIntelligence];
        
        // Add photo to executive intelligence
        updatedExecIntelligence[execIndex] = {
          ...updatedExecIntelligence[execIndex],
          media: {
            ...updatedExecIntelligence[execIndex].media,
            photos: [
              ...updatedExecIntelligence[execIndex].media.photos,
              {
                id: photo.id,
                url: photo.uri,
                caption: photo.caption,
                dateTime: photo.timestamp,
                location: photo.location?.room || updatedReports[reportIndex].generalInfo.location
              }
            ]
          }
        };
        
        return { 
          fieldReports: updatedReports,
          executiveIntelligence: updatedExecIntelligence
        };
      }
      
      return { fieldReports: updatedReports };
    });
  },
  
  // Get a field report by ID
  getFieldReportById: (reportId: string) => {
    return get().fieldReports.find(r => r.id === reportId);
  },
  
  // Get executive intelligence by ID
  getExecutiveIntelligenceById: (id: string) => {
    return get().executiveIntelligence.find(e => e.id === id);
  },
  
  // Add executive intelligence directly (for voice reports)
  addExecutiveIntelligence: (intelligence: UnifiedDailyIntelligence) => {
    set(state => {
      console.log('📊 Adding executive intelligence to store:', {
        id: intelligence.id,
        projectId: intelligence.projectId,
        projectName: intelligence.projectName
      });
      
      // Check if intelligence for this project already exists today
      const today = new Date().toDateString();
      const existingIndex = state.executiveIntelligence.findIndex(
        e => e.projectId === intelligence.projectId && 
        new Date(e.reportDate).toDateString() === today
      );
      
      const updatedIntelligence = [...state.executiveIntelligence];
      
      if (existingIndex !== -1) {
        // Update existing intelligence for today
        console.log('📊 Updating existing intelligence for project:', intelligence.projectId);
        updatedIntelligence[existingIndex] = {
          ...updatedIntelligence[existingIndex],
          ...intelligence,
          reportDate: new Date() // Update timestamp
        };
      } else {
        // Add new intelligence
        console.log('📊 Adding new intelligence for project:', intelligence.projectId);
        updatedIntelligence.unshift(intelligence); // Add to beginning for latest-first ordering
      }
      
      return { executiveIntelligence: updatedIntelligence };
    });
  },
  
  // Convert a field report to executive intelligence format
  convertToExecutiveIntelligence: (fieldReport: FieldReport): UnifiedDailyIntelligence => {
    // Create a new executive intelligence object from the field report
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
        scheduleImpact: fieldReport.aiEnhancements?.suggestedFlags?.scheduleImpact || false,
        safetyIncident: fieldReport.aiEnhancements?.suggestedFlags?.safetyIncident || false,
        ownerNotification: fieldReport.aiEnhancements?.suggestedFlags?.ownerNotification || false,
        budgetImpact: fieldReport.aiEnhancements?.suggestedFlags?.budgetImpact || false,
        weatherDelay: fieldReport.aiEnhancements?.suggestedFlags?.weatherDelay || false
      },
      narratives: {
        executive: fieldReport.aiEnhancements?.executiveSummary || 'Executive summary pending AI enhancement',
        technical: fieldReport.aiEnhancements?.technicalNarrative || 'Technical narrative pending AI enhancement',
        owner: fieldReport.aiEnhancements?.ownerUpdate || 'Owner update pending AI enhancement'
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
  },
  
  // Sync a field report to its executive intelligence counterpart
  syncFieldReportToExecutive: (reportId: string) => {
    set(state => {
      const fieldReport = state.fieldReports.find(r => r.id === reportId);
      
      if (!fieldReport) return state;
      
      // Find matching executive intelligence or create new one
      const execIndex = state.executiveIntelligence.findIndex(
        e => e.id === `exec-${reportId}` || e.projectId === fieldReport.projectId
      );
      
      const updatedExecIntelligence = [...state.executiveIntelligence];
      
      if (execIndex !== -1) {
        // Update existing executive intelligence
        updatedExecIntelligence[execIndex] = get().convertToExecutiveIntelligence(fieldReport);
      } else {
        // Create new executive intelligence
        updatedExecIntelligence.push(get().convertToExecutiveIntelligence(fieldReport));
      }
      
      return { executiveIntelligence: updatedExecIntelligence };
    });
  }
}));

export default useReportStore;
