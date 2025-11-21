/**
 * Field Report Types
 * 
 * TypeScript interfaces for field data capture, including voice input,
 * photo capture, and structured field reports.
 */

import { Trade, Equipment, Material, SafetyObservationType, SafetySeverity } from './index';

/**
 * Voice Input Types
 */
export interface VoiceInput {
  id: string;
  timestamp: Date;
  rawTranscription: string;
  duration: number; // in seconds
  confidence: number; // 0-1 confidence score from speech recognition
  status: 'recording' | 'processing' | 'completed' | 'failed';
  processedContent?: ProcessedVoiceContent;
}

export interface ProcessedVoiceContent {
  type: VoiceContentType;
  structuredData: any; // Will be one of the structured types below based on 'type'
  enhancedText?: string; // AI-enhanced version of the raw transcription
  confidence: number; // 0-1 confidence score from AI processing
  entities: ExtractedEntity[];
}

export type VoiceContentType = 
  | 'workCompleted' 
  | 'workPlanned' 
  | 'safetyObservation' 
  | 'issue' 
  | 'weather' 
  | 'material' 
  | 'equipment' 
  | 'personnel' 
  | 'general';

export interface ExtractedEntity {
  type: string; // e.g., 'location', 'trade', 'quantity', 'material', etc.
  value: string;
  confidence: number; // 0-1 confidence score
  startIndex: number; // Position in original text
  endIndex: number;
}

/**
 * Photo Capture Types
 */
export interface PhotoCapture {
  id: string;
  timestamp: Date;
  uri: string; // Local or remote URI to the image
  thumbnail?: string; // Optional thumbnail URI
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number; // in meters
    floor?: number; // For multi-story buildings
    building?: string;
    room?: string;
  };
  annotations: PhotoAnnotation[];
  tags: string[];
  caption: string;
  aiGeneratedCaption?: string;
  associatedWith?: {
    type: 'workItem' | 'issue' | 'safety' | 'rfi' | 'general';
    id: string;
  };
}

export interface PhotoAnnotation {
  id: string;
  type: 'text' | 'arrow' | 'rectangle' | 'circle' | 'freeform';
  coordinates: number[][]; // Array of [x, y] coordinates
  text?: string; // For text annotations
  color: string;
}

/**
 * Field Report Structure
 */
export interface FieldReport {
  id: string;
  projectId: string;
  reportDate: Date;
  createdBy: {
    id: string;
    name: string;
    role: string;
    email?: string;
  };
  status: FieldReportStatus;
  completionProgress: number; // 0-100%
  lastModified: Date;
  
  // Report sections
  generalInfo: FieldReportGeneralInfo;
  weatherConditions: FieldReportWeather;
  workCompleted: FieldReportWorkItem[];
  workPlanned: FieldReportWorkItem[];
  safetyObservations: FieldReportSafetyItem[];
  issues: FieldReportIssue[];
  materials: FieldReportMaterial[];
  equipment: FieldReportEquipment[];
  personnel: FieldReportPersonnel[];
  photos: PhotoCapture[];
  voiceNotes: VoiceInput[];
  
  // AI-enhanced content
  aiEnhancements?: {
    executiveSummary?: string;
    technicalNarrative?: string;
    ownerUpdate?: string;
    suggestedFlags?: {
      scheduleImpact: boolean;
      safetyIncident: boolean;
      ownerNotification: boolean;
      budgetImpact: boolean;
      weatherDelay: boolean;
    };
    suggestedTags?: string[];
    suggestedFollowups?: string[];
  };
}

export type FieldReportStatus = 
  | 'draft' 
  | 'in-progress' 
  | 'pending-review' 
  | 'submitted' 
  | 'ai-processing' 
  | 'completed';

export interface FieldReportGeneralInfo {
  projectName: string;
  location: string;
  reportType: 'daily' | 'weekly' | 'incident' | 'inspection';
  shift: 'morning' | 'day' | 'night' | 'weekend';
  startTime?: Date;
  endTime?: Date;
  generalNotes: string;
}

export interface FieldReportWeather {
  temperature: number;
  temperatureUnit: 'F' | 'C';
  conditions: string[];
  precipitation: number; // in inches/mm
  windSpeed: number;
  windSpeedUnit: 'mph' | 'kph';
  humidity: number; // percentage
  impactDescription?: string;
  delayedWork?: boolean;
}

export interface FieldReportWorkItem {
  id: string;
  description: string;
  location: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  progress: number; // 0-100%
  trades: Trade[];
  equipment?: Equipment[];
  materials?: Material[];
  quantity?: number;
  unit?: string;
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  photos?: string[]; // IDs of associated photos
  voiceNotes?: string[]; // IDs of associated voice notes
  issuedBy?: string;
  approvedBy?: string;
}

export interface FieldReportSafetyItem {
  id: string;
  type: SafetyObservationType;
  description: string;
  location: string;
  severity: SafetySeverity;
  status: 'open' | 'addressed' | 'closed';
  dateTime: Date;
  reportedBy: string;
  involvedPersonnel?: string[];
  correctiveAction?: string;
  photos?: string[]; // IDs of associated photos
  voiceNotes?: string[]; // IDs of associated voice notes
  requiresFollowup: boolean;
  followupDate?: Date;
}

export interface FieldReportIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  category: 'design' | 'construction' | 'material' | 'equipment' | 'personnel' | 'weather' | 'other';
  createdDate: Date;
  reportedBy: string;
  assignedTo?: string;
  dueDate?: Date;
  resolution?: string;
  photos?: string[]; // IDs of associated photos
  voiceNotes?: string[]; // IDs of associated voice notes
  impact?: {
    schedule: boolean;
    budget: boolean;
    quality: boolean;
    safety: boolean;
  };
}

export interface FieldReportMaterial {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: 'delivered' | 'installed' | 'damaged' | 'missing' | 'surplus';
  location: string;
  supplier?: string;
  deliveryDate?: Date;
  notes?: string;
  photos?: string[]; // IDs of associated photos
}

export interface FieldReportEquipment {
  id: string;
  name: string;
  type: string;
  status: 'operational' | 'maintenance' | 'breakdown' | 'idle';
  location: string;
  hoursUsed?: number;
  operator?: string;
  notes?: string;
  photos?: string[]; // IDs of associated photos
}

export interface FieldReportPersonnel {
  id: string;
  trade: Trade;
  count: number;
  hours: number;
  location: string;
  company?: string;
  supervisor?: string;
  notes?: string;
}

/**
 * Wizard Step Types
 */
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  isRequired: boolean;
  validationErrors?: string[];
}

export interface FieldReportWizardState {
  currentStepIndex: number;
  steps: WizardStep[];
  report: FieldReport;
  isProcessing: boolean;
  isSubmitting: boolean;
  errors: string[];
  activeVoiceCapture: boolean;
  activePhotoCapture: boolean;
}

/**
 * AI Processing Types
 */
export interface AIProcessingRequest {
  fieldReport: FieldReport;
  processingOptions: {
    enhanceExecutiveSummary: boolean;
    enhanceTechnicalNarrative: boolean;
    enhanceOwnerUpdate: boolean;
    suggestFlags: boolean;
    suggestTags: boolean;
    suggestFollowups: boolean;
    enhancePhotoCaptions: boolean;
    confidenceThreshold: number; // 0-1
  };
}

export interface AIProcessingResponse {
  enhancedReport: FieldReport;
  processingMetadata: {
    processingTime: number; // in ms
    modelUsed: string;
    confidenceScore: number; // 0-1
    tokensUsed: number;
  };
}
