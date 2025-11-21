import { 
  UnifiedDailyIntelligence, 
  Activity, 
  RFI, 
  Issue, 
  Weather, 
  Permit,
  WorkItem,
  Safety,
  Trade,
  Equipment,
  Material,
  Photo,
  Markup,
  ModelView,
  Inspection,
  SafetyMetric
} from '../types';

/**
 * Mock Data for PlexifyAEC MVP
 * Realistic construction project reports for the executive feed
 */

// Helper function to create dates relative to today
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Mock Activities
const mockActivities: Record<string, Activity[]> = {
  hospital: [
    {
      id: 'act-h-001',
      name: 'Structural Steel Erection - North Wing',
      startDate: daysAgo(10),
      endDate: daysFromNow(5),
      percentComplete: 65,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-h-000'],
      successors: ['act-h-002'],
      resources: ['crew-steel-01', 'crane-01'],
      notes: 'Working double shifts to maintain schedule'
    },
    {
      id: 'act-h-002',
      name: 'Concrete Decking - Level 3',
      startDate: daysFromNow(6),
      endDate: daysFromNow(12),
      percentComplete: 0,
      status: 'not-started',
      critical: true,
      predecessors: ['act-h-001'],
      successors: ['act-h-003'],
      resources: ['crew-concrete-01', 'pump-01'],
      notes: 'Requires inspection before starting'
    },
    {
      id: 'act-h-003',
      name: 'MEP Rough-in - Level 2',
      startDate: daysAgo(5),
      endDate: daysFromNow(2),
      percentComplete: 80,
      status: 'in-progress',
      critical: false,
      predecessors: ['act-h-000'],
      successors: ['act-h-004'],
      resources: ['crew-mep-01', 'crew-mep-02'],
      notes: 'Ahead of schedule, coordinating with medical equipment vendor'
    }
  ],
  office: [
    {
      id: 'act-o-001',
      name: 'Curtain Wall Installation - South Elevation',
      startDate: daysAgo(15),
      endDate: daysAgo(1),
      percentComplete: 95,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-o-000'],
      successors: ['act-o-002'],
      resources: ['crew-glazing-01', 'crane-02'],
      notes: 'Final panels being installed today'
    },
    {
      id: 'act-o-002',
      name: 'Interior Framing - Floors 10-15',
      startDate: daysAgo(7),
      endDate: daysFromNow(7),
      percentComplete: 50,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-o-001'],
      successors: ['act-o-003'],
      resources: ['crew-framing-01', 'crew-framing-02'],
      notes: 'Material delivery delayed, may impact schedule'
    }
  ],
  residential: [
    {
      id: 'act-r-001',
      name: 'Foundation Waterproofing',
      startDate: daysAgo(3),
      endDate: daysAgo(1),
      percentComplete: 100,
      status: 'completed',
      critical: true,
      predecessors: ['act-r-000'],
      successors: ['act-r-002'],
      resources: ['crew-waterproofing-01'],
      notes: 'Completed on schedule with no issues'
    },
    {
      id: 'act-r-002',
      name: 'Underground Utilities',
      startDate: daysAgo(1),
      endDate: daysFromNow(3),
      percentComplete: 25,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-r-001'],
      successors: ['act-r-003'],
      resources: ['crew-utilities-01', 'excavator-01'],
      notes: 'Encountered unexpected rock, bringing in additional equipment'
    }
  ],
  bridge: [
    {
      id: 'act-b-001',
      name: 'Pier Construction - P3',
      startDate: daysAgo(20),
      endDate: daysAgo(5),
      percentComplete: 100,
      status: 'completed',
      critical: true,
      predecessors: ['act-b-000'],
      successors: ['act-b-002'],
      resources: ['crew-concrete-02', 'crane-03'],
      notes: 'Completed and passed inspection'
    },
    {
      id: 'act-b-002',
      name: 'Girder Placement - Span 2',
      startDate: daysAgo(4),
      endDate: daysFromNow(1),
      percentComplete: 75,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-b-001'],
      successors: ['act-b-003'],
      resources: ['crew-steel-02', 'crane-04'],
      notes: 'Weather delay yesterday, working extended hours today'
    }
  ],
  mixeduse: [
    {
      id: 'act-m-001',
      name: 'Elevator Installation - Tower A',
      startDate: daysAgo(10),
      endDate: daysFromNow(10),
      percentComplete: 40,
      status: 'in-progress',
      critical: false,
      predecessors: ['act-m-000'],
      successors: ['act-m-002'],
      resources: ['vendor-elevator-01'],
      notes: 'Vendor reports equipment delivery delay'
    },
    {
      id: 'act-m-002',
      name: 'Retail Space Fit-out - Level 1',
      startDate: daysAgo(5),
      endDate: daysFromNow(15),
      percentComplete: 20,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-m-000'],
      successors: [],
      resources: ['crew-finishes-01', 'crew-mep-03'],
      notes: 'Coordinating with tenant requirements'
    }
  ],
  school: [
    {
      id: 'act-s-001',
      name: 'Roof Replacement - Main Building',
      startDate: daysAgo(7),
      endDate: daysFromNow(3),
      percentComplete: 60,
      status: 'in-progress',
      critical: true,
      predecessors: ['act-s-000'],
      successors: ['act-s-002'],
      resources: ['crew-roofing-01'],
      notes: 'Working weekends to complete before school year'
    },
    {
      id: 'act-s-002',
      name: 'HVAC Upgrades - Gymnasium',
      startDate: daysAgo(14),
      endDate: daysAgo(2),
      percentComplete: 95,
      status: 'in-progress',
      critical: false,
      predecessors: ['act-s-000'],
      successors: [],
      resources: ['crew-hvac-01'],
      notes: 'Final testing in progress'
    }
  ]
};

// Mock RFIs
const mockRFIs: Record<string, RFI[]> = {
  hospital: [
    {
      id: 'rfi-h-001',
      number: 'RFI-H-042',
      title: 'Structural Steel Connection Detail',
      description: 'Need clarification on connection detail at column H-12 where beam transitions to transfer girder.',
      status: 'open',
      dateSubmitted: daysAgo(3),
      dateNeeded: daysFromNow(1),
      submittedBy: 'John Smith',
      assignedTo: 'Sarah Johnson',
      costImpact: false,
      scheduleImpact: true,
      attachments: ['drawing-s-201.pdf', 'photo-steel-connection.jpg']
    },
    {
      id: 'rfi-h-002',
      number: 'RFI-H-043',
      title: 'Medical Gas Piping Conflict',
      description: 'Identified conflict between medical gas piping and structural beam at Operating Room 3.',
      status: 'answered',
      dateSubmitted: daysAgo(5),
      dateNeeded: daysAgo(2),
      dateAnswered: daysAgo(1),
      submittedBy: 'Mike Williams',
      assignedTo: 'Dr. Emily Chen',
      response: 'Relocate medical gas piping below beam per sketch SK-MG-01.',
      costImpact: true,
      scheduleImpact: false,
      attachments: ['drawing-m-301.pdf', 'sketch-sk-mg-01.pdf']
    }
  ],
  office: [
    {
      id: 'rfi-o-001',
      number: 'RFI-O-078',
      title: 'Curtain Wall Anchor Detail',
      description: 'Request for additional detail on curtain wall anchoring at floor 12 where floor slab steps back.',
      status: 'open',
      dateSubmitted: daysAgo(2),
      dateNeeded: daysFromNow(2),
      submittedBy: 'Carlos Rodriguez',
      assignedTo: 'Lisa Park',
      costImpact: false,
      scheduleImpact: true,
      attachments: ['drawing-a-412.pdf']
    }
  ],
  residential: [
    {
      id: 'rfi-r-001',
      number: 'RFI-R-023',
      title: 'Foundation Waterproofing at Elevator Pit',
      description: 'Need clarification on waterproofing detail at elevator pit where sheet piling remains in place.',
      status: 'answered',
      dateSubmitted: daysAgo(6),
      dateNeeded: daysAgo(3),
      dateAnswered: daysAgo(4),
      submittedBy: 'Dave Wilson',
      assignedTo: 'Tom Baker',
      response: 'Apply waterproofing as shown in detail 5/S-003 with additional bentonite water-stop at sheet pile interface.',
      costImpact: true,
      scheduleImpact: false,
      attachments: ['drawing-s-003.pdf', 'spec-section-071000.pdf']
    }
  ],
  bridge: [
    {
      id: 'rfi-b-001',
      number: 'RFI-B-015',
      title: 'Bearing Pad Material Substitution',
      description: 'Propose alternative bearing pad material due to long lead time on specified product.',
      status: 'open',
      dateSubmitted: daysAgo(1),
      dateNeeded: daysFromNow(3),
      submittedBy: 'Frank Miller',
      assignedTo: 'State DOT Engineer',
      costImpact: false,
      scheduleImpact: true,
      attachments: ['spec-section-051200.pdf', 'alternate-product-data.pdf']
    }
  ],
  mixeduse: [
    {
      id: 'rfi-m-001',
      number: 'RFI-M-056',
      title: 'Retail Storefront Modification',
      description: 'Tenant requesting modification to storefront entrance configuration.',
      status: 'answered',
      dateSubmitted: daysAgo(7),
      dateNeeded: daysAgo(2),
      dateAnswered: daysAgo(3),
      submittedBy: 'Retail Tenant Rep',
      assignedTo: 'Jessica Wong',
      response: 'Modification approved with conditions noted on sketch SK-A-12.',
      costImpact: true,
      scheduleImpact: false,
      attachments: ['sketch-sk-a-12.pdf', 'tenant-request-form.pdf']
    }
  ],
  school: [
    {
      id: 'rfi-s-001',
      number: 'RFI-S-031',
      title: 'Existing Roof Deck Condition',
      description: 'Discovered deteriorated roof deck at science wing that requires replacement.',
      status: 'open',
      dateSubmitted: daysAgo(2),
      dateNeeded: daysFromNow(1),
      submittedBy: 'Roofing Foreman',
      assignedTo: 'District Facilities Manager',
      costImpact: true,
      scheduleImpact: true,
      attachments: ['photo-roof-deck-1.jpg', 'photo-roof-deck-2.jpg']
    }
  ]
};

// Mock Issues
const mockIssues: Record<string, Issue[]> = {
  hospital: [
    {
      id: 'issue-h-001',
      title: 'Missing Sleeves for Medical Equipment',
      description: 'Identified missing sleeves for medical equipment anchoring in Radiology department.',
      status: 'open',
      priority: 'high',
      createdDate: daysAgo(2),
      createdBy: 'MEP Coordinator',
      assignedTo: 'Project Engineer',
      dueDate: daysFromNow(3),
      category: 'coordination',
      location: 'Level 2 - Radiology',
      photos: ['photo-missing-sleeve-1.jpg']
    }
  ],
  office: [
    {
      id: 'issue-o-001',
      title: 'Curtain Wall Panel Damage',
      description: 'Three curtain wall panels damaged during delivery. Need to reorder and expedite.',
      status: 'in-progress',
      priority: 'high',
      createdDate: daysAgo(3),
      createdBy: 'Glazing Superintendent',
      assignedTo: 'Project Manager',
      dueDate: daysFromNow(7),
      resolution: 'Replacement panels ordered with expedited delivery',
      category: 'material',
      location: 'South Elevation - Floor 14',
      photos: ['photo-damaged-panel-1.jpg', 'photo-damaged-panel-2.jpg']
    }
  ],
  residential: [
    {
      id: 'issue-r-001',
      title: 'Underground Utility Conflict',
      description: 'Storm sewer line conflicts with existing utility not shown on as-builts.',
      status: 'open',
      priority: 'critical',
      createdDate: daysAgo(1),
      createdBy: 'Site Superintendent',
      assignedTo: 'Civil Engineer',
      dueDate: daysFromNow(1),
      category: 'site',
      location: 'Northwest corner of site',
      photos: ['photo-utility-conflict.jpg']
    }
  ],
  bridge: [
    {
      id: 'issue-b-001',
      title: 'Concrete Test Failure',
      description: 'Concrete cylinder break test failed to meet 28-day strength requirement.',
      status: 'in-progress',
      priority: 'critical',
      createdDate: daysAgo(4),
      createdBy: 'Quality Control Manager',
      assignedTo: 'Structural Engineer',
      dueDate: daysAgo(1),
      resolution: 'Additional testing in progress, core samples being taken',
      category: 'quality',
      location: 'Pier 3 - Footing',
      photos: ['photo-concrete-test.jpg']
    }
  ],
  mixeduse: [
    {
      id: 'issue-m-001',
      title: 'Elevator Delivery Delay',
      description: 'Vendor notified of 3-week delay in elevator equipment delivery.',
      status: 'open',
      priority: 'high',
      createdDate: daysAgo(2),
      createdBy: 'Project Manager',
      assignedTo: 'Procurement Manager',
      dueDate: daysFromNow(5),
      category: 'procurement',
      location: 'Tower A - Elevator Shaft',
      relatedItems: ['submittal-elevator-001']
    }
  ],
  school: [
    {
      id: 'issue-s-001',
      title: 'Additional Asbestos Discovered',
      description: 'Asbestos-containing material discovered in ceiling space not identified in survey.',
      status: 'in-progress',
      priority: 'critical',
      createdDate: daysAgo(3),
      createdBy: 'Abatement Contractor',
      assignedTo: 'Environmental Consultant',
      dueDate: daysAgo(1),
      resolution: 'Abatement plan being developed, additional testing in progress',
      category: 'environmental',
      location: 'Main Building - 2nd Floor Corridor',
      photos: ['photo-asbestos-1.jpg', 'photo-asbestos-2.jpg']
    }
  ]
};

// Mock Weather
const mockWeather: Record<string, Weather> = {
  hospital: {
    date: new Date(),
    temperature: {
      high: 85,
      low: 68,
      unit: 'F'
    },
    conditions: 'Partly Cloudy',
    precipitation: 0,
    windSpeed: 8,
    humidity: 65,
    workImpact: 'none'
  },
  office: {
    date: new Date(),
    temperature: {
      high: 92,
      low: 75,
      unit: 'F'
    },
    conditions: 'Clear',
    precipitation: 0,
    windSpeed: 12,
    humidity: 70,
    workImpact: 'minor'
  },
  residential: {
    date: new Date(),
    temperature: {
      high: 78,
      low: 62,
      unit: 'F'
    },
    conditions: 'Overcast',
    precipitation: 0.1,
    windSpeed: 5,
    humidity: 80,
    workImpact: 'minor'
  },
  bridge: {
    date: new Date(),
    temperature: {
      high: 88,
      low: 72,
      unit: 'F'
    },
    conditions: 'Thunderstorms',
    precipitation: 1.2,
    windSpeed: 18,
    humidity: 85,
    workImpact: 'severe'
  },
  mixeduse: {
    date: new Date(),
    temperature: {
      high: 82,
      low: 65,
      unit: 'F'
    },
    conditions: 'Clear',
    precipitation: 0,
    windSpeed: 7,
    humidity: 60,
    workImpact: 'none'
  },
  school: {
    date: new Date(),
    temperature: {
      high: 80,
      low: 64,
      unit: 'F'
    },
    conditions: 'Light Rain',
    precipitation: 0.3,
    windSpeed: 10,
    humidity: 75,
    workImpact: 'moderate'
  }
};

// Mock Permits
const mockPermits: Record<string, Permit[]> = {
  hospital: [
    {
      id: 'permit-h-001',
      type: 'Building Permit',
      number: 'BP-2025-1234',
      description: 'Main Hospital Building',
      issueDate: daysAgo(120),
      expirationDate: daysFromNow(245),
      status: 'active',
      issuingAuthority: 'City Building Department',
      inspectionRequired: true,
      lastInspection: daysAgo(15),
      nextInspection: daysFromNow(15)
    },
    {
      id: 'permit-h-002',
      type: 'Electrical Permit',
      number: 'EP-2025-5678',
      description: 'Hospital Electrical Systems',
      issueDate: daysAgo(110),
      expirationDate: daysFromNow(255),
      status: 'active',
      issuingAuthority: 'City Electrical Inspector',
      inspectionRequired: true,
      lastInspection: daysAgo(10),
      nextInspection: daysFromNow(20)
    }
  ],
  office: [
    {
      id: 'permit-o-001',
      type: 'Building Permit',
      number: 'BP-2025-2345',
      description: 'Office Tower',
      issueDate: daysAgo(180),
      expirationDate: daysFromNow(185),
      status: 'active',
      issuingAuthority: 'City Building Department',
      inspectionRequired: true,
      lastInspection: daysAgo(30),
      nextInspection: daysFromNow(30)
    }
  ],
  residential: [
    {
      id: 'permit-r-001',
      type: 'Building Permit',
      number: 'BP-2025-3456',
      description: 'Residential Tower',
      issueDate: daysAgo(60),
      expirationDate: daysFromNow(305),
      status: 'active',
      issuingAuthority: 'City Building Department',
      inspectionRequired: true,
      lastInspection: daysAgo(5),
      nextInspection: daysFromNow(25)
    }
  ],
  bridge: [
    {
      id: 'permit-b-001',
      type: 'Construction Permit',
      number: 'DOT-2025-7890',
      description: 'Bridge Construction',
      issueDate: daysAgo(200),
      expirationDate: daysFromNow(165),
      status: 'active',
      issuingAuthority: 'State Department of Transportation',
      restrictions: 'No work during peak traffic hours (6-9am, 4-7pm)',
      inspectionRequired: true,
      lastInspection: daysAgo(7),
      nextInspection: daysFromNow(7)
    }
  ],
  mixeduse: [
    {
      id: 'permit-m-001',
      type: 'Building Permit',
      number: 'BP-2025-4567',
      description: 'Mixed-Use Development',
      issueDate: daysAgo(150),
      expirationDate: daysFromNow(215),
      status: 'active',
      issuingAuthority: 'City Building Department',
      inspectionRequired: true,
      lastInspection: daysAgo(20),
      nextInspection: daysFromNow(10)
    }
  ],
  school: [
    {
      id: 'permit-s-001',
      type: 'Renovation Permit',
      number: 'BP-2025-5678',
      description: 'School Renovation',
      issueDate: daysAgo(45),
      expirationDate: daysFromNow(45),
      status: 'active',
      issuingAuthority: 'City Building Department',
      restrictions: 'Work hours limited to 7am-7pm on weekdays, 9am-5pm on weekends',
      inspectionRequired: true,
      lastInspection: daysAgo(10),
      nextInspection: daysFromNow(5)
    }
  ]
};

// Mock Work Items
const mockWorkItems: Record<string, WorkItem[]> = {
  hospital: [
    {
      id: 'work-h-001',
      description: 'Structural steel erection at North Wing',
      location: 'North Wing - Column Lines 3-7',
      quantity: 15,
      unit: 'tons',
      startTime: new Date(new Date().setHours(7, 0, 0, 0)),
      endTime: new Date(new Date().setHours(15, 30, 0, 0)),
      status: 'completed',
      trades: ['Ironworkers', 'Crane Operators'],
      equipment: ['200-ton crawler crane', 'Man lifts (2)'],
      materials: ['A992 steel beams', 'A325 bolts'],
      notes: 'Completed erection of columns and beams at gridlines 3-7/A-C. All connections torqued and inspected.',
      photos: ['steel-erection-1.jpg', 'steel-erection-2.jpg']
    },
    {
      id: 'work-h-002',
      description: 'MEP rough-in at Level 2',
      location: 'Level 2 - East Wing',
      status: 'in-progress',
      trades: ['Electricians', 'Plumbers', 'Sheet Metal Workers'],
      notes: 'Continued overhead MEP rough-in. Completed main ductwork runs and started electrical conduit installation.',
      photos: ['mep-rough-in-1.jpg']
    }
  ],
  office: [
    {
      id: 'work-o-001',
      description: 'Curtain wall installation',
      location: 'South Elevation - Floors 12-14',
      quantity: 24,
      unit: 'panels',
      startTime: new Date(new Date().setHours(7, 0, 0, 0)),
      endTime: new Date(new Date().setHours(17, 0, 0, 0)),
      status: 'completed',
      trades: ['Glaziers', 'Crane Operators'],
      equipment: ['Tower crane', 'Material hoist'],
      materials: ['Curtain wall panels', 'Gaskets', 'Sealant'],
      notes: 'Installed 24 panels at floors 12-14. Three panels damaged during delivery, replacements ordered.',
      photos: ['curtain-wall-1.jpg', 'curtain-wall-2.jpg']
    }
  ],
  residential: [
    {
      id: 'work-r-001',
      description: 'Underground utility installation',
      location: 'Northwest corner of site',
      quantity: 120,
      unit: 'linear feet',
      startTime: new Date(new Date().setHours(7, 0, 0, 0)),
      endTime: new Date(new Date().setHours(16, 0, 0, 0)),
      status: 'in-progress',
      trades: ['Pipefitters', 'Laborers', 'Equipment Operators'],
      equipment: ['Excavator', 'Loader', 'Compactor'],
      materials: ['12" PVC pipe', 'Gravel', 'Concrete'],
      notes: 'Installed 120 LF of storm sewer. Encountered unmarked utility line, work stopped to identify and resolve conflict.',
      photos: ['utility-1.jpg', 'utility-conflict-1.jpg']
    }
  ],
  bridge: [
    {
      id: 'work-b-001',
      description: 'Girder placement at Span 2',
      location: 'Span 2 between Piers 2-3',
      quantity: 3,
      unit: 'girders',
      startTime: new Date(new Date().setHours(6, 0, 0, 0)),
      endTime: new Date(new Date().setHours(14, 0, 0, 0)),
      status: 'in-progress',
      trades: ['Ironworkers', 'Crane Operators'],
      equipment: ['300-ton crawler crane', 'Man lifts (2)'],
      materials: ['Precast concrete girders'],
      notes: 'Placed 3 of 5 girders at Span 2. Work stopped due to thunderstorm at 2pm.',
      photos: ['girder-placement-1.jpg', 'girder-placement-2.jpg']
    }
  ],
  mixeduse: [
    {
      id: 'work-m-001',
      description: 'Retail space framing',
      location: 'Level 1 - Retail Units 101-103',
      quantity: 450,
      unit: 'linear feet',
      startTime: new Date(new Date().setHours(7, 0, 0, 0)),
      endTime: new Date(new Date().setHours(15, 30, 0, 0)),
      status: 'completed',
      trades: ['Carpenters'],
      equipment: ['Material lift'],
      materials: ['Metal studs', 'Track', 'Screws'],
      notes: 'Completed interior framing at retail units 101-103. Ready for MEP rough-in.',
      photos: ['retail-framing-1.jpg', 'retail-framing-2.jpg']
    }
  ],
  school: [
    {
      id: 'work-s-001',
      description: 'Roof replacement',
      location: 'Main Building - North Section',
      quantity: 5000,
      unit: 'square feet',
      startTime: new Date(new Date().setHours(7, 0, 0, 0)),
      endTime: new Date(new Date().setHours(16, 0, 0, 0)),
      status: 'in-progress',
      trades: ['Roofers', 'Carpenters'],
      equipment: ['Material lift', 'Hot tar kettle'],
      materials: ['Modified bitumen membrane', 'Insulation board', 'Flashing'],
      notes: 'Removed existing roof and installed new insulation on 5,000 SF. Discovered deteriorated deck requiring replacement in some areas.',
      photos: ['roof-1.jpg', 'roof-deck-damage-1.jpg']
    }
  ]
};

// Mock Safety Observations
const mockSafetyObservations: Record<string, Safety[]> = {
  hospital: [
    {
      id: 'safety-h-001',
      type: 'observation',
      description: 'Workers properly using fall protection during steel erection',
      location: 'North Wing - Level 3',
      dateTime: new Date(new Date().setHours(10, 15, 0, 0)),
      reportedBy: 'Safety Manager',
      severity: 'low',
      status: 'reported'
    }
  ],
  office: [
    {
      id: 'safety-o-001',
      type: 'near-miss',
      description: 'Material fell from material hoist but no one was in area',
      location: 'South Elevation - Material Hoist',
      dateTime: new Date(new Date().setHours(13, 45, 0, 0)),
      reportedBy: 'Site Superintendent',
      severity: 'high',
      correctiveAction: 'Reviewed material securing procedures with crew, added additional netting',
      status: 'resolved',
      photos: ['near-miss-1.jpg']
    }
  ],
  residential: [
    {
      id: 'safety-r-001',
      type: 'observation',
      description: 'Proper trench protection in place for utility installation',
      location: 'Northwest corner of site',
      dateTime: new Date(new Date().setHours(9, 30, 0, 0)),
      reportedBy: 'Project Engineer',
      severity: 'low',
      status: 'reported'
    }
  ],
  bridge: [
    {
      id: 'safety-b-001',
      type: 'incident',
      description: 'Worker slipped on wet surface, minor ankle sprain',
      location: 'Pier 3 access platform',
      dateTime: new Date(new Date().setHours(11, 20, 0, 0)),
      reportedBy: 'Foreman',
      severity: 'medium',
      correctiveAction: 'Applied additional non-slip surfacing to access platforms, reviewed wet weather procedures',
      status: 'investigating',
      photos: ['incident-1.jpg'],
      witnesses: ['John Smith', 'Maria Garcia']
    }
  ],
  mixeduse: [
    {
      id: 'safety-m-001',
      type: 'violation',
      description: 'Subcontractor working without proper PPE (missing eye protection)',
      location: 'Level 1 - Retail Space',
      dateTime: new Date(new Date().setHours(14, 10, 0, 0)),
      reportedBy: 'Safety Inspector',
      severity: 'medium',
      correctiveAction: 'Worker provided with proper PPE, subcontractor supervisor notified, toolbox talk scheduled',
      status: 'resolved',
      photos: ['violation-1.jpg']
    }
  ],
  school: [
    {
      id: 'safety-s-001',
      type: 'incident',
      description: 'Worker exposed to asbestos material, proper protocols followed immediately',
      location: 'Main Building - 2nd Floor Corridor',
      dateTime: new Date(new Date().setHours(9, 45, 0, 0)),
      reportedBy: 'Abatement Supervisor',
      severity: 'high',
      correctiveAction: 'Work stopped, area contained, worker decontaminated, additional testing ordered',
      status: 'investigating',
      photos: ['asbestos-incident-1.jpg', 'containment-1.jpg']
    }
  ]
};

// Mock Trades
const mockTrades: Record<string, Trade[]> = {
  hospital: [
    {
      id: 'trade-h-001',
      name: 'Ironworkers',
      company: 'Steel Erectors Inc.',
      count: 12,
      supervisor: 'Mike Johnson',
      workAreas: ['North Wing - Levels 2-3']
    },
    {
      id: 'trade-h-002',
      name: 'Electricians',
      company: 'Power Systems LLC',
      count: 8,
      supervisor: 'Sarah Williams',
      workAreas: ['East Wing - Level 2', 'Central Core - Level 1']
    },
    {
      id: 'trade-h-003',
      name: 'Plumbers',
      company: 'Advanced Mechanical Inc.',
      count: 6,
      supervisor: 'Tom Garcia',
      workAreas: ['East Wing - Level 2']
    },
    {
      id: 'trade-h-004',
      name: 'Sheet Metal Workers',
      company: 'Advanced Mechanical Inc.',
      count: 4,
      supervisor: 'Tom Garcia',
      workAreas: ['East Wing - Level 2']
    }
  ],
  office: [
    {
      id: 'trade-o-001',
      name: 'Glaziers',
      company: 'Metropolitan Glass Inc.',
      count: 8,
      supervisor: 'Robert Chen',
      workAreas: ['South Elevation - Floors 12-14']
    },
    {
      id: 'trade-o-002',
      name: 'Carpenters',
      company: 'Precision Interiors LLC',
      count: 12,
      supervisor: 'David Wilson',
      workAreas: ['Floors 10-15 - Interior Framing']
    }
  ],
  residential: [
    {
      id: 'trade-r-001',
      name: 'Pipefitters',
      company: 'Urban Utilities Inc.',
      count: 6,
      supervisor: 'Frank Miller',
      workAreas: ['Site - Underground Utilities']
    },
    {
      id: 'trade-r-002',
      name: 'Laborers',
      company: 'City Construction Services',
      count: 8,
      supervisor: 'James Thompson',
      workAreas: ['Site - Underground Utilities', 'Site - Grading']
    },
    {
      id: 'trade-r-003',
      name: 'Equipment Operators',
      company: 'City Construction Services',
      count: 3,
      supervisor: 'James Thompson',
      workAreas: ['Site - Underground Utilities', 'Site - Grading']
    }
  ],
  bridge: [
    {
      id: 'trade-b-001',
      name: 'Ironworkers',
      company: 'Bridge Specialists Inc.',
      count: 10,
      supervisor: 'Steve Jackson',
      workAreas: ['Span 2 - Girder Placement']
    },
    {
      id: 'trade-b-002',
      name: 'Crane Operators',
      company: 'Heavy Lift Services',
      count: 2,
      supervisor: 'Mark Rodriguez',
      workAreas: ['Span 2 - Girder Placement']
    }
  ],
  mixeduse: [
    {
      id: 'trade-m-001',
      name: 'Carpenters',
      company: 'Urban Interiors Inc.',
      count: 8,
      supervisor: 'Lisa Wong',
      workAreas: ['Level 1 - Retail Units 101-103']
    }
  ],
  school: [
    {
      id: 'trade-s-001',
      name: 'Roofers',
      company: 'Top Notch Roofing Inc.',
      count: 12,
      supervisor: 'Carlos Mendez',
      workAreas: ['Main Building - Roof']
    },
    {
      id: 'trade-s-002',
      name: 'Carpenters',
      company: 'School Builders LLC',
      count: 4,
      supervisor: 'Alex Johnson',
      workAreas: ['Main Building - Roof']
    },
    {
      id: 'trade-s-003',
      name: 'Abatement Workers',
      company: 'Safe Environmental Inc.',
      count: 6,
      supervisor: 'Maria Rodriguez',
      workAreas: ['Main Building - 2nd Floor']
    }
  ]
};

// Mock Equipment
const mockEquipment: Record<string, Equipment[]> = {
  hospital: [
    {
      id: 'equip-h-001',
      type: 'Crane',
      description: '200-ton crawler crane',
      quantity: 1,
      status: 'active',
      location: 'North Wing',
      operator: 'John Smith',
      hoursUsed: 8
    },
    {
      id: 'equip-h-002',
      type: 'Man Lift',
      description: '60\' articulating boom lift',
      quantity: 2,
      status: 'active',
      location: 'North Wing',
      hoursUsed: 16
    }
  ],
  office: [
    {
      id: 'equip-o-001',
      type: 'Tower Crane',
      description: 'Liebherr tower crane',
      quantity: 1,
      status: 'active',
      location: 'Central Tower',
      operator: 'Mike Johnson',
      hoursUsed: 10
    },
    {
      id: 'equip-o-002',
      type: 'Material Hoist',
      description: 'Construction hoist',
      quantity: 1,
      status: 'active',
      location: 'South Elevation',
      hoursUsed: 10
    }
  ],
  residential: [
    {
      id: 'equip-r-001',
      type: 'Excavator',
      description: 'CAT 320 excavator',
      quantity: 1,
      status: 'active',
      location: 'Northwest corner',
      operator: 'Dave Wilson',
      hoursUsed: 8
    },
    {
      id: 'equip-r-002',
      type: 'Loader',
      description: 'CAT 950 loader',
      quantity: 1,
      status: 'active',
      location: 'Site',
      operator: 'Carlos Rodriguez',
      hoursUsed: 6
    },
    {
      id: 'equip-r-003',
      type: 'Compactor',
      description: 'Vibratory plate compactor',
      quantity: 2,
      status: 'active',
      location: 'Northwest corner',
      hoursUsed: 8
    }
  ],
  bridge: [
    {
      id: 'equip-b-001',
      type: 'Crane',
      description: '300-ton crawler crane',
      quantity: 1,
      status: 'active',
      location: 'Span 2',
      operator: 'Frank Miller',
      hoursUsed: 8
    },
    {
      id: 'equip-b-002',
      type: 'Man Lift',
      description: '80\' boom lift',
      quantity: 2,
      status: 'active',
      location: 'Span 2',
      hoursUsed: 16
    }
  ],
  mixeduse: [
    {
      id: 'equip-m-001',
      type: 'Material Lift',
      description: 'Genie material lift',
      quantity: 1,
      status: 'active',
      location: 'Level 1 - Retail',
      hoursUsed: 8
    }
  ],
  school: [
    {
      id: 'equip-s-001',
      type: 'Material Lift',
      description: 'Roofing material lift',
      quantity: 1,
      status: 'active',
      location: 'Main Building - Roof',
      hoursUsed: 8
    },
    {
      id: 'equip-s-002',
      type: 'Hot Tar Kettle',
      description: 'Roofing tar kettle',
      quantity: 1,
      status: 'active',
      location: 'Main Building - Roof',
      hoursUsed: 8
    }
  ]
};

// Mock Materials
const mockMaterials: Record<string, Material[]> = {
  hospital: [
    {
      id: 'mat-h-001',
      type: 'Structural Steel',
      description: 'A992 steel beams',
      quantity: 15,
      unit: 'tons',
      status: 'installed',
      location: 'North Wing - Level 3',
      supplier: 'Steel Supply Inc.',
      deliveryDate: daysAgo(2)
    },
    {
      id: 'mat-h-002',
      type: 'Fasteners',
      description: 'A325 high-strength bolts',
      quantity: 500,
      unit: 'each',
      status: 'installed',
      location: 'North Wing - Level 3',
      supplier: 'Construction Fasteners LLC',
      deliveryDate: daysAgo(5)
    }
  ],
  office: [
    {
      id: 'mat-o-001',
      type: 'Curtain Wall',
      description: 'Curtain wall panels',
      quantity: 24,
      unit: 'panels',
      status: 'installed',
      location: 'South Elevation - Floors 12-14',
      supplier: 'Architectural Glass Inc.',
      deliveryDate: daysAgo(1)
    },
    {
      id: 'mat-o-002',
      type: 'Sealant',
      description: 'Silicone sealant',
      quantity: 24,
      unit: 'tubes',
      status: 'installed',
      location: 'South Elevation - Floors 12-14',
      supplier: 'Construction Supply Co.',
      deliveryDate: daysAgo(3)
    }
  ],
  residential: [
    {
      id: 'mat-r-001',
      type: 'Pipe',
      description: '12" PVC storm sewer pipe',
      quantity: 120,
      unit: 'linear feet',
      status: 'installed',
      location: 'Northwest corner',
      supplier: 'Urban Utilities Supply',
      deliveryDate: daysAgo(3)
    },
    {
      id: 'mat-r-002',
      type: 'Aggregate',
      description: '3/4" crushed stone',
      quantity: 20,
      unit: 'cubic yards',
      status: 'installed',
      location: 'Northwest corner',
      supplier: 'City Aggregates Inc.',
      deliveryDate: daysAgo(3)
    }
  ],
  bridge: [
    {
      id: 'mat-b-001',
      type: 'Precast Concrete',
      description: 'Precast concrete girders',
      quantity: 3,
      unit: 'each',
      status: 'installed',
      location: 'Span 2',
      supplier: 'Precast Structures Inc.',
      deliveryDate: daysAgo(1)
    }
  ],
  mixeduse: [
    {
      id: 'mat-m-001',
      type: 'Metal Framing',
      description: '3-5/8" metal studs',
      quantity: 450,
      unit: 'linear feet',
      status: 'installed',
      location: 'Level 1 - Retail Units 101-103',
      supplier: 'Building Products Inc.',
      deliveryDate: daysAgo(2)
    },
    {
      id: 'mat-m-002',
      type: 'Metal Framing',
      description: 'Track',
      quantity: 200,
      unit: 'linear feet',
      status: 'installed',
      location: 'Level 1 - Retail Units 101-103',
      supplier: 'Building Products Inc.',
      deliveryDate: daysAgo(2)
    }
  ],
  school: [
    {
      id: 'mat-s-001',
      type: 'Roofing',
      description: 'Modified bitumen membrane',
      quantity: 50,
      unit: 'rolls',
      status: 'in-progress',
      location: 'Main Building - Roof',
      supplier: 'Roofing Supply Co.',
      deliveryDate: daysAgo(3)
    },
    {
      id: 'mat-s-002',
      type: 'Insulation',
      description: '2" polyiso insulation board',
      quantity: 250,
      unit: 'sheets',
      status: 'in-progress',
      location: 'Main Building - Roof',
      supplier: 'Roofing Supply Co.',
      deliveryDate: daysAgo(3)
    }
  ]
};

// Mock Photos
const mockPhotos: Record<string, Photo[]> = {
  hospital: [
    {
      id: 'photo-h-001',
      url: '/assets/mock-photos/hospital-steel-1.jpg',
      caption: 'North Wing steel erection at column line 5',
      location: 'North Wing - Level 3',
      dateTime: new Date(new Date().setHours(10, 30, 0, 0)),
      takenBy: 'John Smith',
      tags: ['structural', 'steel', 'progress'],
      category: 'progress'
    },
    {
      id: 'photo-h-002',
      url: '/assets/mock-photos/hospital-mep-1.jpg',
      caption: 'MEP coordination at Level 2 corridor',
      location: 'East Wing - Level 2',
      dateTime: new Date(new Date().setHours(14, 15, 0, 0)),
      takenBy: 'Sarah Williams',
      tags: ['MEP', 'coordination', 'progress'],
      category: 'progress'
    }
  ],
  office: [
    {
      id: 'photo-o-001',
      url: '/assets/mock-photos/office-curtainwall-1.jpg',
      caption: 'Curtain wall installation at South Elevation',
      location: 'South Elevation - Floor 13',
      dateTime: new Date(new Date().setHours(11, 45, 0, 0)),
      takenBy: 'Robert Chen',
      tags: ['curtain wall', 'exterior', 'progress'],
      category: 'progress'
    },
    {
      id: 'photo-o-002',
      url: '/assets/mock-photos/office-damage-1.jpg',
      caption: 'Damaged curtain wall panel from delivery',
      location: 'Staging Area',
      dateTime: new Date(new Date().setHours(9, 20, 0, 0)),
      takenBy: 'Robert Chen',
      tags: ['curtain wall', 'damage', 'issue'],
      category: 'issue'
    }
  ],
  residential: [
    {
      id: 'photo-r-001',
      url: '/assets/mock-photos/residential-utility-1.jpg',
      caption: 'Storm sewer installation at northwest corner',
      location: 'Northwest corner',
      dateTime: new Date(new Date().setHours(10, 10, 0, 0)),
      takenBy: 'Dave Wilson',
      tags: ['underground', 'utilities', 'progress'],
      category: 'progress'
    },
    {
      id: 'photo-r-002',
      url: '/assets/mock-photos/residential-conflict-1.jpg',
      caption: 'Utility conflict with unmarked line',
      location: 'Northwest corner',
      dateTime: new Date(new Date().setHours(11, 30, 0, 0)),
      takenBy: 'Dave Wilson',
      tags: ['underground', 'utilities', 'conflict', 'issue'],
      category: 'issue'
    }
  ],
  bridge: [
    {
      id: 'photo-b-001',
      url: '/assets/mock-photos/bridge-girder-1.jpg',
      caption: 'Girder placement at Span 2',
      location: 'Span 2',
      dateTime: new Date(new Date().setHours(9, 45, 0, 0)),
      takenBy: 'Steve Jackson',
      tags: ['girder', 'structural', 'progress'],
      category: 'progress'
    },
    {
      id: 'photo-b-002',
      url: '/assets/mock-photos/bridge-weather-1.jpg',
      caption: 'Work stopped due to thunderstorm',
      location: 'Site Overview',
      dateTime: new Date(new Date().setHours(14, 10, 0, 0)),
      takenBy: 'Steve Jackson',
      tags: ['weather', 'delay', 'safety'],
      category: 'issue'
    }
  ],
  mixeduse: [
    {
      id: 'photo-m-001',
      url: '/assets/mock-photos/mixeduse-framing-1.jpg',
      caption: 'Retail space framing at Unit 102',
      location: 'Level 1 - Retail Unit 102',
      dateTime: new Date(new Date().setHours(11, 20, 0, 0)),
      takenBy: 'Lisa Wong',
      tags: ['framing', 'interior', 'progress'],
      category: 'progress'
    }
  ],
  school: [
    {
      id: 'photo-s-001',
      url: '/assets/mock-photos/school-roof-1.jpg',
      caption: 'Roof replacement at north section',
      location: 'Main Building - Roof',
      dateTime: new Date(new Date().setHours(10, 30, 0, 0)),
      takenBy: 'Carlos Mendez',
      tags: ['roofing', 'progress'],
      category: 'progress'
    },
    {
      id: 'photo-s-002',
      url: '/assets/mock-photos/school-asbestos-1.jpg',
      caption: 'Asbestos containing material discovered in ceiling',
      location: 'Main Building - 2nd Floor Corridor',
      dateTime: new Date(new Date().setHours(9, 50, 0, 0)),
      takenBy: 'Maria Rodriguez',
      tags: ['asbestos', 'environmental', 'issue', 'safety'],
      category: 'issue'
    }
  ]
};

// Mock Narratives
const mockNarratives: Record<string, Record<string, string>> = {
  hospital: {
    technical: `Today the structural steel erection continued at the North Wing between column lines 3-7/A-C. A total of 15 tons of A992 steel was erected, including 8 columns and 12 beams. All connections were made with A325 high-strength bolts and torqued to specification. The steel erection is approximately 65% complete for the North Wing and remains on the critical path. The erection sequence was modified to accommodate the tower crane's reach limitations at the northeast corner.

MEP rough-in continued at Level 2 of the East Wing. The mechanical contractor completed the main supply and return ductwork runs in the central corridor and began branch ductwork to the individual rooms. The electrical contractor installed approximately 800 linear feet of conduit and began pulling wire in previously installed conduits. The plumbing contractor continued installation of medical gas piping and encountered a conflict with a structural beam at Operating Room 3, which has been documented in RFI-H-043 and was resolved today.

Quality control inspections were performed on the completed steel connections, and all passed visual inspection. The third-party testing agency performed ultrasonic testing on 10% of the complete penetration welds with no deficiencies noted.`,
    
    executive: `North Wing structural steel erection progressed well today with 65% completion, keeping this critical path activity on schedule. The team is working double shifts to maintain the timeline.

MEP rough-in at Level 2 is 80% complete and ahead of schedule. A conflict between medical gas piping and a structural beam was quickly resolved through the RFI process with minimal impact.

All quality inspections passed with no deficiencies noted. The project remains on schedule for the targeted completion date with no significant budget impacts identified today.`,
    
    owner: `The North Wing structural steel frame is taking shape nicely, with 65% of the steel now in place. This critical milestone remains on schedule, and the building's form is now clearly visible from the campus main entrance.

The mechanical, electrical, and plumbing systems installation is progressing well on Level 2, with special attention being paid to the complex medical gas systems required for the operating rooms. Our team quickly resolved a minor coordination issue today without any schedule impact.

Quality remains a top priority, with all inspections passing successfully today. We're maintaining our commitment to delivering this state-of-the-art medical facility on time and to the highest standards.`,
    
    public: `Construction continues to progress well on the new hospital wing. This week, the community can see the building's steel frame taking shape as crews work diligently to complete this important milestone.

Inside the existing portions of the building, work is underway on the mechanical, electrical, and plumbing systems that will support the advanced medical technology planned for this facility.

The project remains on schedule, with completion anticipated as planned. The construction team continues to minimize disruption to hospital operations and surrounding neighborhoods.`
  },
  office: {
    technical: `Curtain wall installation continued on the South Elevation at floors 12-14 today. The installation crew placed and secured 24 panels, completing the 13th floor and starting on the 14th floor. Three panels were identified as damaged upon delivery (panels S14-05, S14-06, and S14-07), with minor corner damage that prevents proper gasket sealing. Replacement panels have been ordered with expedited production and are expected in 10 days.

The interior framing crews continued work on floors 10-15, completing approximately 50% of the layout and top track installation. Material delivery for metal studs was delayed by one day, which may impact the framing completion if not received tomorrow. The critical path for the interior work currently runs through the framing completion, followed by MEP rough-in, so this delay requires close monitoring.

Pressure testing of the completed domestic water risers was conducted today on floors 1-10, with all tests passing. The fire protection contractor completed installation of the main standpipe in the north stairwell and began branch piping on floor 15.`,
    
    executive: `Curtain wall installation is 95% complete on the South Elevation, with 24 panels installed today. Three damaged panels were identified and replacements ordered with expedited delivery, creating a potential 10-day impact to the complete weathertight milestone if mitigation measures aren't implemented.

Interior framing on floors 10-15 has reached 50% completion but is at risk due to material delivery delays. This is on the critical path and could impact MEP rough-in if not resolved quickly.

The project remains within budget, but schedule concerns have emerged that require immediate attention to prevent impacts to the tenant fit-out sequence.`,
    
    owner: `The building's exterior is rapidly nearing completion, with the distinctive glass curtain wall now installed up to the 14th floor on the South Elevation. The reflective glass is creating the elegant, modern appearance we envisioned in the design.

We're closely managing a minor issue with three damaged glass panels, and replacements have been expedited to minimize any impact to the schedule. Interior work is progressing on the upper floors, with framing underway to create the open, flexible office environments specified in the design.

All building systems tested today met or exceeded specifications, reflecting our commitment to delivering a high-performance building.`,
    
    public: `The new downtown office tower continues to transform the skyline as the distinctive glass exterior nears completion. The reflective blue glass curtain wall, which will be a signature element of the building, is now visible on most of the tower.

Inside, work continues on creating the modern, flexible office environments that will house several major employers moving to our downtown. The project continues to provide significant employment for the local construction workforce, with over 200 workers on site daily.`
  },
  residential: {
    technical: `Underground utility installation continued at the northwest corner of the site today. Crews installed 120 linear feet of 12" PVC storm sewer pipe at the specified elevations and grades. Proper bedding with 3/4" crushed stone was placed and compacted before pipe installation. All joints were properly connected and sealed.

During excavation, an unmarked utility line was encountered that conflicts with the designed storm sewer alignment. The line appears to be an abandoned electrical conduit not shown on any as-built drawings provided. Work was stopped in this area, and the civil engineer was notified to provide direction. This conflict affects approximately 50 linear feet of the designed storm sewer run and may require a redesign of this portion.

Foundation waterproofing was completed on the west wall of the elevator pit, with the specified two coats of fluid-applied membrane and protection board installed. The waterproofing was extended up the sheet piling interface as directed in the response to RFI-R-023.`,
    
    executive: `Underground utility work progressed with 120 LF of storm sewer installed, but an unmarked utility line was discovered that conflicts with the designed alignment. This issue affects the critical path for site utilities and may require redesign for approximately 50 LF of storm sewer.

Foundation waterproofing was completed at the elevator pit following the resolution of the previous RFI regarding the sheet pile interface.

The unmarked utility conflict presents a schedule risk that could impact the foundation backfill sequence if not resolved quickly. A redesign may also have cost implications that are being evaluated.`,
    
    owner: `The site utility work is making good progress, with storm sewer installation continuing on the northwest portion of the property. Our team encountered an unexpected abandoned utility line that wasn't shown on any of the historical site drawings. We've paused work in that specific area while our engineers develop a solution, but work continues in other areas to maintain overall progress.

The foundation waterproofing for the elevator pit has been completed successfully, ensuring that this critical below-grade element will remain dry throughout the building's life. This quality focus on waterproofing is essential to prevent future maintenance issues in the underground portions of the building.`,
    
    public: `Site work continues on the new residential development, with crews installing the underground infrastructure that will serve the future community. This important but less visible work creates the foundation for sustainable stormwater management and other essential services.

The project team continues to work carefully to coordinate with existing utilities in this established neighborhood, ensuring minimal disruption to surrounding properties. Foundation elements for the main tower are now taking shape, with completion of below-ground waterproofing systems.`
  },
  bridge: {
    technical: `Girder placement operations continued at Span 2 today between Piers 2 and 3. Three of the five planned precast concrete girders were successfully placed and temporarily secured. Each girder (measuring 120' long and weighing approximately 85 tons) was lifted using the 300-ton crawler crane positioned on the temporary work platform adjacent to Pier 2. The girders were aligned within tolerance and temporarily braced per the approved erection plan.

Work was suspended at approximately 2:00 PM due to approaching thunderstorms with lightning in the area. The remaining two girders will be placed tomorrow, weather permitting. The current weather forecast indicates clearing conditions overnight with favorable conditions expected tomorrow.

The concrete test results for the Pier 3 footing continue to be investigated. Core samples were taken today from the locations specified by the structural engineer, and samples were delivered to the testing laboratory for analysis. Results are expected within 48 hours. Temporary bracing has been installed at Pier 3 as a precautionary measure until the investigation is complete.`,
    
    executive: `Girder placement at Span 2 is 60% complete with three of five girders placed today. Work was stopped due to severe weather at 2:00 PM, creating a potential half-day delay to the critical path if weather doesn't clear by tomorrow.

The concrete strength issue at Pier 3 footing remains under investigation with core samples taken today and results expected in 48 hours. Temporary bracing has been installed as a precautionary measure.

The weather delay combined with the ongoing concrete investigation presents moderate schedule risk to the overall project timeline. The contingency plan involves weekend work if necessary to recover the schedule.`,
    
    owner: `Progress continues on the bridge superstructure, with three of the five main concrete girders now in place at Span 2. These massive structural elements (each 120 feet long) form the backbone of the bridge and represent a significant milestone in the project.

Work was temporarily paused this afternoon due to thunderstorms in the area, as safety remains our highest priority. The team expects to complete the remaining girder placements tomorrow, weather permitting.

We're continuing to investigate the concrete test results at one of the piers, with additional testing underway. Appropriate precautionary measures have been implemented, and we'll have more definitive information within two days. This careful approach ensures the long-term durability and safety of this important infrastructure.`,
    
    public: `Construction of the new bridge reached a visible milestone today as the massive concrete girders that will support the roadway were placed at the second span. These impressive structural elements, each weighing as much as 30 elephants, were carefully positioned using specialized equipment.

The construction team prioritized safety by pausing work during today's thunderstorms and will resume when weather conditions improve. The project continues to make progress toward providing this important new connection for the community's transportation network.`
  },
  mixeduse: {
    technical: `Interior framing was completed today at retail units 101-103 on Level 1. Approximately 450 linear feet of metal stud framing was installed, including all partition walls, soffits, and backing for future fixtures as specified in the retail tenant criteria. All framing was installed according to the approved shop drawings with studs at 16" on center and proper bracing at all door openings and corners.

The elevator contractor notified the project team of a 3-week delay in the delivery of elevator equipment for Tower A due to manufacturing issues at their factory. This delay affects the elevator installation scheduled to start next week and will impact the overall completion of the vertical transportation system. The critical path currently runs through the elevator installation and testing, so this delay directly impacts the project completion date.

The retail space MEP coordination meeting was held today with all subcontractors to review the BIM model and resolve conflicts before rough-in begins. Several minor clashes were identified and resolved during the meeting, with updated coordination drawings to be issued tomorrow.`,
    
    executive: `Retail space framing on Level 1 is now 100% complete for units 101-103, ready for MEP rough-in to begin tomorrow.

A critical issue has emerged with the elevator vendor reporting a 3-week delay in equipment delivery for Tower A. This directly impacts the project critical path and will delay the overall completion date unless mitigation measures are implemented. The project team is evaluating acceleration options for subsequent activities.

MEP coordination for retail spaces is proceeding well with all conflicts resolved during today's meeting, which should allow for efficient rough-in work.`,
    
    owner: `The retail spaces on Level 1 are taking shape, with all interior walls now framed for the first three retail units. These spaces are being prepared according to the criteria established with the retail leasing team to ensure they meet tenant expectations.

We've encountered a challenge with the elevator equipment delivery, with the manufacturer reporting a three-week delay due to production issues. Our team is working on a recovery plan to minimize the impact on the overall project schedule and is evaluating all options to maintain the target opening date.

The coordination between mechanical, electrical, and plumbing systems in the retail areas is proceeding smoothly, ensuring these spaces will be both functional and adaptable for future tenant needs.`,
    
    public: `Construction continues on the mixed-use development that will bring new retail, office, and residential options to the neighborhood. The ground floor retail spaces are now being framed, creating the individual shops and restaurants that will activate the street level.

The project continues to advance on multiple fronts simultaneously, with work progressing on both the interior spaces and building systems. When complete, this development will create a vibrant new destination with diverse amenities for residents and visitors alike.`
  },
  school: {
    technical: `Roof replacement work continued on the north section of the Main Building today. Approximately 5,000 square feet of existing roofing was removed, revealing areas of deteriorated wood deck that require replacement. Approximately 800 square feet of deck was identified as requiring replacement, primarily in areas adjacent to roof drains and HVAC curbs where previous water intrusion had occurred. The structural engineer was on site to inspect the conditions and provided direction for the deck replacement method.

The abatement contractor discovered additional asbestos-containing material in the ceiling space of the 2nd floor corridor that was not identified in the original hazardous materials survey. Work in this area was immediately stopped, and proper containment protocols were implemented. Air monitoring was conducted, and samples were collected for testing. The environmental consultant was notified and visited the site to assess the situation and develop an abatement plan for this additional material.

HVAC upgrades in the gymnasium are 95% complete, with final testing and balancing in progress. All new ductwork has been installed and insulated, and the new rooftop units are operational. Testing and balancing is expected to be completed tomorrow.`,
    
    executive: `Roof replacement is 60% complete but has encountered an issue with 800 SF of deteriorated deck requiring replacement, which was not included in the original scope. This additional work will increase costs and may extend the roof replacement timeline.

A critical environmental issue emerged today with the discovery of additional asbestos in the 2nd floor corridor ceiling that wasn't identified in the original survey. Work in this area has been stopped, and proper containment protocols implemented. This will require an updated abatement plan and will impact the renovation schedule for this area.

HVAC upgrades in the gymnasium are 95% complete and on track to finish tomorrow, which is a positive milestone for the project.`,
    
    owner: `The roof replacement on the Main Building continues to progress, with crews having completed removal of the old roofing on the north section. During this process, we discovered some deteriorated roof decking that will need replacement before the new roofing can be installed. While this is an additional scope item, addressing it now will ensure the long-term performance of the new roof system.

Our environmental team has identified some additional asbestos-containing material in a ceiling space that wasn't detected in the original building survey. We've implemented all proper safety protocols immediately, and our environmental consultant is developing a plan to address this material safely and in compliance with all regulations. This situation is being managed with student and staff safety as the absolute priority.

On a positive note, the gymnasium HVAC upgrades are nearly complete, with final testing underway. This will provide greatly improved comfort and air quality for students when they return.`,
    
    public: `Improvements continue at the school, with work progressing on multiple upgrades that will enhance the learning environment. The roof replacement project is advancing, ensuring the building will be weather-tight and protected for years to come.

Inside the building, the new heating and cooling system for the gymnasium is nearly complete, which will provide better comfort for students during physical education classes and school events.

All work is being conducted with strict adherence to safety protocols, particularly for environmental considerations, to ensure the well-being of future building occupants and the construction team.`
  }
};

// Create the mock daily intelligence reports
export const mockDailyReports: UnifiedDailyIntelligence[] = [
  // Hospital Project
  {
    id: 'report-hospital-001',
    projectId: 'project-hospital',
    projectName: 'Memorial Regional Medical Center',
    projectPhase: 'Structural Steel / MEP Rough-in',
    reportDate: new Date(),
    
    superintendent: {
      name: 'John Smith',
      id: 'super-001',
      contact: 'john.smith@construction.com'
    },
    
    context: {
      scheduledActivities: mockActivities.hospital,
      activeRFIs: mockRFIs.hospital,
      openIssues: mockIssues.hospital,
      weatherForecast: mockWeather.hospital,
      permitStatus: mockPermits.hospital
    },
    
    fieldReport: {
      workCompleted: mockWorkItems.hospital,
      issuesEncountered: mockIssues.hospital,
      safetyObservations: mockSafetyObservations.hospital,
      manpower: {
        planned: 35,
        actual: 32,
        trades: mockTrades.hospital
      },
      equipment: mockEquipment.hospital,
      materials: mockMaterials.hospital,
      weatherActual: 'Partly cloudy, 85°F, light breeze'
    },
    
    narratives: mockNarratives.hospital,
    
    media: {
      photos: mockPhotos.hospital,
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: mockPermits.hospital,
      safety: []
    },
    
    flags: {
      scheduleImpact: false,
      safetyIncident: false,
      ownerNotification: false,
      budgetImpact: false,
      weatherDelay: false
    },
    
    aiContext: {
      relatedDocuments: ['spec-section-051200.pdf', 'spec-section-230000.pdf'],
      relatedDrawings: ['S-101.pdf', 'M-201.pdf', 'E-301.pdf'],
      modelReferences: ['model-hospital-structural', 'model-hospital-mep'],
      scheduleActivities: ['act-h-001', 'act-h-003']
    }
  },
  
  // Office Building Project
  {
    id: 'report-office-001',
    projectId: 'project-office',
    projectName: 'Centennial Tower',
    projectPhase: 'Exterior Envelope / Interior Framing',
    reportDate: new Date(),
    
    superintendent: {
      name: 'Robert Chen',
      id: 'super-002',
      contact: 'robert.chen@construction.com'
    },
    
    context: {
      scheduledActivities: mockActivities.office,
      activeRFIs: mockRFIs.office,
      openIssues: mockIssues.office,
      weatherForecast: mockWeather.office,
      permitStatus: mockPermits.office
    },
    
    fieldReport: {
      workCompleted: mockWorkItems.office,
      issuesEncountered: mockIssues.office,
      safetyObservations: mockSafetyObservations.office,
      manpower: {
        planned: 45,
        actual: 42,
        trades: mockTrades.office
      },
      equipment: mockEquipment.office,
      materials: mockMaterials.office,
      weatherActual: 'Clear and hot, 92°F, moderate wind'
    },
    
    narratives: mockNarratives.office,
    
    media: {
      photos: mockPhotos.office,
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: mockPermits.office,
      safety: []
    },
    
    flags: {
      scheduleImpact: true,
      safetyIncident: true,
      ownerNotification: false,
      budgetImpact: true,
      weatherDelay: false
    },
    
    aiContext: {
      relatedDocuments: ['spec-section-084413.pdf', 'spec-section-092216.pdf'],
      relatedDrawings: ['A-401.pdf', 'A-501.pdf'],
      modelReferences: ['model-office-curtainwall', 'model-office-architectural'],
      scheduleActivities: ['act-o-001', 'act-o-002']
    }
  },
  
  // Residential Project
  {
    id: 'report-residential-001',
    projectId: 'project-residential',
    projectName: 'The Parkview Residences',
    projectPhase: 'Foundation / Site Utilities',
    reportDate: new Date(),
    
    superintendent: {
      name: 'Dave Wilson',
      id: 'super-003',
      contact: 'dave.wilson@construction.com'
    },
    
    context: {
      scheduledActivities: mockActivities.residential,
      activeRFIs: mockRFIs.residential,
      openIssues: mockIssues.residential,
      weatherForecast: mockWeather.residential,
      permitStatus: mockPermits.residential
    },
    
    fieldReport: {
      workCompleted: mockWorkItems.residential,
      issuesEncountered: mockIssues.residential,
      safetyObservations: mockSafetyObservations.residential,
      manpower: {
        planned: 20,
        actual: 17,
        trades: mockTrades.residential
      },
      equipment: mockEquipment.residential,
      materials: mockMaterials.residential,
      weatherActual: 'Overcast, 78°F, light drizzle in afternoon'
    },
    
    narratives: mockNarratives.residential,
    
    media: {
      photos: mockPhotos.residential,
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: mockPermits.residential,
      safety: []
    },
    
    flags: {
      scheduleImpact: true,
      safetyIncident: false,
      ownerNotification: true,
      budgetImpact: true,
      weatherDelay: false
    },
    
    aiContext: {
      relatedDocuments: ['spec-section-334100.pdf', 'spec-section-071000.pdf'],
      relatedDrawings: ['C-101.pdf', 'C-501.pdf'],
      modelReferences: ['model-residential-civil', 'model-residential-foundation'],
      scheduleActivities: ['act-r-001', 'act-r-002']
    }
  },
  
  // Bridge Project
  {
    id: 'report-bridge-001',
    projectId: 'project-bridge',
    projectName: 'River Crossing Bridge',
    projectPhase: 'Superstructure',
    reportDate: new Date(),
    
    superintendent: {
      name: 'Steve Jackson',
      id: 'super-004',
      contact: 'steve.jackson@construction.com'
    },
    
    context: {
      scheduledActivities: mockActivities.bridge,
      activeRFIs: mockRFIs.bridge,
      openIssues: mockIssues.bridge,
      weatherForecast: mockWeather.bridge,
      permitStatus: mockPermits.bridge
    },
    
    fieldReport: {
      workCompleted: mockWorkItems.bridge,
      issuesEncountered: mockIssues.bridge,
      safetyObservations: mockSafetyObservations.bridge,
      manpower: {
        planned: 15,
        actual: 15,
        trades: mockTrades.bridge
      },
      equipment: mockEquipment.bridge,
      