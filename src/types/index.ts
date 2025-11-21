/**
 * PlexifyAEC MVP - Type Definitions
 * Core data model for the construction intelligence platform
 */

// Basic Activity interface (from P6)
export interface Activity {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  percentComplete: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
  critical: boolean;
  predecessors: string[];
  successors: string[];
  resources: string[];
  notes?: string;
}

// RFI interface (from Procore)
export interface RFI {
  id: string;
  number: string;
  title: string;
  description: string;
  status: 'draft' | 'open' | 'answered' | 'closed';
  dateSubmitted: Date;
  dateNeeded: Date;
  dateAnswered?: Date;
  submittedBy: string;
  assignedTo: string;
  response?: string;
  attachments?: string[];
  relatedDrawings?: string[];
  costImpact: boolean;
  scheduleImpact: boolean;
}

// Issue interface (from ACC)
export interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdDate: Date;
  createdBy: string;
  assignedTo: string;
  dueDate?: Date;
  resolution?: string;
  category: string;
  location?: string;
  photos?: string[];
  relatedItems?: string[];
}

// Weather interface
export interface Weather {
  date: Date;
  temperature: {
    high: number;
    low: number;
    unit: 'F' | 'C';
  };
  conditions: string;
  precipitation: number;
  windSpeed: number;
  humidity: number;
  workImpact: 'none' | 'minor' | 'moderate' | 'severe';
}

// Permit interface
export interface Permit {
  id: string;
  type: string;
  number: string;
  description: string;
  issueDate: Date;
  expirationDate: Date;
  status: 'pending' | 'active' | 'expired' | 'revoked';
  issuingAuthority: string;
  restrictions?: string;
  inspectionRequired: boolean;
  lastInspection?: Date;
  nextInspection?: Date;
}

// Work Item interface
export interface WorkItem {
  id: string;
  description: string;
  location: string;
  quantity?: number;
  unit?: string;
  startTime?: Date;
  endTime?: Date;
  status: 'planned' | 'in-progress' | 'completed';
  trades: string[];
  equipment?: string[];
  materials?: string[];
  notes?: string;
  photos?: string[];
}

// Safety Observation interface
export interface Safety {
  id: string;
  type: 'observation' | 'incident' | 'near-miss' | 'violation';
  description: string;
  location: string;
  dateTime: Date;
  reportedBy: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  correctiveAction?: string;
  status: 'reported' | 'investigating' | 'resolved';
  photos?: string[];
  witnesses?: string[];
}

// Trade interface
export interface Trade {
  id: string;
  name: string;
  company: string;
  count: number;
  supervisor?: string;
  workAreas: string[];
  notes?: string;
}

// Equipment interface
export interface Equipment {
  id: string;
  type: string;
  description: string;
  quantity: number;
  status: 'active' | 'idle' | 'breakdown' | 'maintenance';
  location?: string;
  operator?: string;
  hoursUsed?: number;
  notes?: string;
}

// Material interface
export interface Material {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unit: string;
  status: 'ordered' | 'delivered' | 'installed' | 'rejected';
  location?: string;
  supplier?: string;
  deliveryDate?: Date;
  notes?: string;
}

// Photo interface
export interface Photo {
  id: string;
  url: string;
  caption?: string;
  location?: string;
  dateTime: Date;
  takenBy: string;
  tags?: string[];
  category?: string;
}

// Markup interface (from Bluebeam)
export interface Markup {
  id: string;
  drawingId: string;
  type: 'text' | 'cloud' | 'highlight' | 'dimension' | 'other';
  content?: string;
  author: string;
  dateTime: Date;
  status: 'draft' | 'review' | 'approved' | 'rejected';
  coordinates: {
    x: number;
    y: number;
    page: number;
  };
}

// Model View interface (from ACC)
export interface ModelView {
  id: string;
  modelId: string;
  name: string;
  description?: string;
  createdBy: string;
  dateTime: Date;
  viewpoint: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  };
  elements?: string[];
  clipping?: boolean;
}

// Inspection interface
export interface Inspection {
  id: string;
  type: string;
  description: string;
  requiredDate: Date;
  scheduledDate?: Date;
  completedDate?: Date;
  inspector?: string;
  status: 'scheduled' | 'passed' | 'failed' | 'pending';
  result?: string;
  notes?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
}

// Safety Metric interface
export interface SafetyMetric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  date: Date;
  target?: number;
  status: 'below-target' | 'at-target' | 'above-target';
  trend: 'improving' | 'steady' | 'declining';
  notes?: string;
}

// Project Context interface
export interface ProjectContext {
  projectId: string;
  userId: string;
  role: string;
  permissions: string[];
  preferences?: Record<string, any>;
}

// Meeting Context interface
export interface MeetingContext {
  meetingId: string;
  title: string;
  date: Date;
  attendees: string[];
  agenda: string[];
  projectId: string;
}

// Query Context interface
export interface QueryContext {
  projectId?: string;
  userId: string;
  role: string;
  filters?: Record<string, any>;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

// Field Input interface
export interface FieldInput {
  projectId: string;
  reportDate: Date;
  superintendent: {
    name: string;
    id: string;
  };
  weatherActual: string;
  manpower: {
    planned: number;
    actual: number;
    trades: {
      name: string;
      count: number;
    }[];
  };
  workCompleted: string;
  issuesEncountered: string;
  safetyObservations: string;
  equipment: {
    type: string;
    count: number;
  }[];
  materials: {
    type: string;
    quantity: number;
    unit: string;
  }[];
  photos?: {
    url: string;
    caption: string;
  }[];
}

// Executive User interface
export interface ExecutiveUser {
  id: string;
  name: string;
  role: string;
  email: string;
  projects: string[];
  preferences?: Record<string, any>;
  lastLogin?: Date;
}

// Main Unified Daily Intelligence interface
export interface UnifiedDailyIntelligence {
  // Core Identity
  id: string;
  projectId: string;
  projectName: string;
  projectPhase: string; // from P6
  reportDate: Date;
  
  // Field Captured Data
  superintendent: {
    name: string;
    id: string;
    contact: string;
  };
  
  // Integrated Context (pulled from systems)
  context: {
    scheduledActivities: Activity[]; // from P6
    activeRFIs: RFI[]; // from Procore
    openIssues: Issue[]; // from ACC
    weatherForecast: Weather; // from API
    permitStatus: Permit[]; // from Procore
  };
  
  // Human Intelligence (field input)
  fieldReport: {
    workCompleted: WorkItem[];
    issuesEncountered: Issue[];
    safetyObservations: Safety[];
    manpower: {
      planned: number;
      actual: number;
      trades: Trade[];
    };
    equipment: Equipment[];
    materials: Material[];
    weatherActual: string;
  };
  
  // AI-Enhanced Narratives
  narratives: {
    technical: string; // for engineers
    executive: string; // for executives
    owner: string; // for owners
    public: string; // for community feeds
  };
  
  // Integrated Media
  media: {
    photos: Photo[];
    markups: Markup[]; // from Bluebeam
    modelViews: ModelView[]; // from ACC
  };
  
  // Compliance & Quality
  compliance: {
    inspections: Inspection[];
    permits: Permit[];
    safety: SafetyMetric[];
  };
  
  // Intelligence Flags
  flags: {
    scheduleImpact: boolean;
    safetyIncident: boolean;
    ownerNotification: boolean;
    budgetImpact: boolean;
    weatherDelay: boolean;
  };
  
  // Interrogation Context
  aiContext: {
    relatedDocuments: string[]; // SharePoint doc IDs
    relatedDrawings: string[]; // Bluebeam drawing IDs
    modelReferences: string[]; // ACC model elements
    scheduleActivities: string[]; // P6 activity IDs
  };
}
