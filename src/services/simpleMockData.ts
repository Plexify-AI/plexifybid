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
  Photo
} from '../types';

/**
 * Simplified Mock Data for PlexifyAEC MVP
 * Focused on Executive Feed Demo
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

// Simplified mock data for executive feed demo
export const mockDailyReports: UnifiedDailyIntelligence[] = [
  // Golden Triangle DC BID - In progress
  {
    id: 'report-golden-triangle-001',
    projectId: 'project-golden-triangle',
    projectName: 'Golden Triangle DC BID',
    projectPhase: 'Market Street District • February 2025',
    reportDate: new Date(),
    
    superintendent: {
      name: 'Sarah Chen',
      id: 'super-gt-001',
      contact: 'sarah.chen@construction.com'
    },
    
    context: {
      scheduledActivities: [
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
        }
      ],
      activeRFIs: [
        // Intentionally empty for this BID demo card
      ],
      openIssues: [],
      weatherForecast: {
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
      permitStatus: []
    },
    
    fieldReport: {
      workCompleted: [
        {
          id: 'work-gt-001',
          description: 'Executed $68.5M construction contract and mobilized project teams',
          location: '456 Market Street (Market Street District)',
          quantity: 1,
          unit: 'contract',
          startTime: new Date(new Date().setHours(7, 0, 0, 0)),
          endTime: new Date(new Date().setHours(15, 30, 0, 0)),
          status: 'completed',
          trades: ['Development', 'Construction Management'],
          equipment: [],
          materials: [],
          notes: 'Major commercial development underway at 456 Market Street. Six-story office building (85,000 SF) with a 120-space parking garage. Project commenced February 2025 with substantial completion targeted for June 2027.',
          photos: []
        }
      ],
      issuesEncountered: [],
      safetyObservations: [
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
      manpower: {
        planned: 35,
        actual: 32,
        trades: [
          {
            id: 'trade-h-001',
            name: 'Ironworkers',
            company: 'Steel Erectors Inc.',
            count: 12,
            supervisor: 'Mike Johnson',
            workAreas: ['North Wing - Levels 2-3']
          }
        ]
      },
      equipment: [],
      materials: [],
      weatherActual: 'Partly cloudy, 85°F, light breeze'
    },
    
    narratives: {
      technical: 'Project mobilization and preconstruction coordination are underway for 456 Market Street (Market Street District). The $68.5M contract has been executed and the project team is sequencing early packages to maintain the February 2025 start. Current scope includes a six-story office building (85,000 SF) and a 120-space parking garage, with substantial completion targeted for June 2027.',

      executive:
        'Major commercial development underway at 456 Market Street with $68.5M construction contract. Six-story office building with 85,000 SF and 120-space parking garage in progress. Project commenced February 2025 with substantial completion targeted for June 2027.',

      owner: 'Project kickoff is complete and execution is underway at 456 Market Street. The $68.5M contract supports a six-story, 85,000 SF office building and a 120-space parking garage. The schedule remains aligned to a February 2025 start with substantial completion targeted for June 2027.',

      public: 'A major commercial development is underway at 456 Market Street. Work has begun on a new six-story office building and structured parking, with completion targeted for 2027.'
    },
    
    media: {
      photos: [],
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: [],
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
  
  // Office Building Project - Schedule and Budget Impact
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
      scheduledActivities: [
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
      activeRFIs: [],
      openIssues: [
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
      weatherForecast: {
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
      permitStatus: []
    },
    
    fieldReport: {
      workCompleted: [],
      issuesEncountered: [],
      safetyObservations: [
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
      manpower: {
        planned: 45,
        actual: 42,
        trades: []
      },
      equipment: [],
      materials: [],
      weatherActual: 'Clear and hot, 92°F, moderate wind'
    },
    
    narratives: {
      technical: 'Interior framing crews continued work on floors 10-15, completing approximately 50% of the layout and top track installation. Material delivery for metal studs was delayed by one day, which may impact the framing completion if not received tomorrow. The critical path for the interior work currently runs through the framing completion, followed by MEP rough-in, so this delay requires close monitoring.',
      
      executive: 'Interior framing on floors 10-15 has reached 50% completion but is at risk due to material delivery delays. This is on the critical path and could impact MEP rough-in if not resolved quickly. The project remains within budget, but schedule concerns have emerged that require immediate attention to prevent impacts to the tenant fit-out sequence.',
      
      owner: 'Interior work is progressing on the upper floors, with framing underway to create the open, flexible office environments specified in the design. We\'re closely managing a material delivery issue to minimize any impact to the schedule.',
      
      public: 'Inside, work continues on creating the modern, flexible office environments that will house several major employers moving to our downtown. The project continues to provide significant employment for the local construction workforce, with over 200 workers on site daily.'
    },
    
    media: {
      photos: [],
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: [],
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
  
  // Bridge Project - Weather Delay and Safety Incident
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
      scheduledActivities: [
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
      activeRFIs: [],
      openIssues: [
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
      weatherForecast: {
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
      permitStatus: []
    },
    
    fieldReport: {
      workCompleted: [
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
      issuesEncountered: [],
      safetyObservations: [
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
      manpower: {
        planned: 15,
        actual: 15,
        trades: []
      },
      equipment: [],
      materials: [],
      weatherActual: 'Thunderstorms in afternoon, 88°F, heavy rain and lightning'
    },
    
    narratives: {
      technical: 'Girder placement operations continued at Span 2 today between Piers 2 and 3. Three of the five planned precast concrete girders were successfully placed and temporarily secured. Work was suspended at approximately 2:00 PM due to approaching thunderstorms with lightning in the area. The remaining two girders will be placed tomorrow, weather permitting.',
      
      executive: 'Girder placement at Span 2 is 60% complete with three of five girders placed today. Work was stopped due to severe weather at 2:00 PM, creating a potential half-day delay to the critical path if weather doesn\'t clear by tomorrow. The concrete strength issue at Pier 3 footing remains under investigation with core samples taken today and results expected in 48 hours.',
      
      owner: 'Progress continues on the bridge superstructure, with three of the five main concrete girders now in place at Span 2. Work was temporarily paused this afternoon due to thunderstorms in the area, as safety remains our highest priority. We\'re continuing to investigate the concrete test results at one of the piers, with additional testing underway.',
      
      public: 'Construction of the new bridge reached a visible milestone today as the massive concrete girders that will support the roadway were placed at the second span. The construction team prioritized safety by pausing work during today\'s thunderstorms and will resume when weather conditions improve.'
    },
    
    media: {
      photos: [
        {
          id: 'photo-b-001',
          url: '/assets/mock-photos/bridge-girder-1.jpg',
          caption: 'Girder placement at Span 2',
          location: 'Span 2',
          dateTime: new Date(new Date().setHours(9, 45, 0, 0)),
          takenBy: 'Steve Jackson',
          tags: ['girder', 'structural', 'progress'],
          category: 'progress'
        }
      ],
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: [],
      safety: []
    },
    
    flags: {
      scheduleImpact: true,
      safetyIncident: true,
      ownerNotification: true,
      budgetImpact: false,
      weatherDelay: true
    },
    
    aiContext: {
      relatedDocuments: ['spec-section-034100.pdf', 'spec-section-033000.pdf'],
      relatedDrawings: ['S-301.pdf', 'S-501.pdf'],
      modelReferences: ['model-bridge-structural', 'model-bridge-foundation'],
      scheduleActivities: ['act-b-001', 'act-b-002']
    }
  },
  
  // School Project - Environmental Issue
  {
    id: 'report-school-001',
    projectId: 'project-school',
    projectName: 'Washington High School Renovation',
    projectPhase: 'Roof Replacement / HVAC Upgrades',
    reportDate: new Date(),
    
    superintendent: {
      name: 'Carlos Mendez',
      id: 'super-006',
      contact: 'carlos.mendez@construction.com'
    },
    
    context: {
      scheduledActivities: [
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
        }
      ],
      activeRFIs: [],
      openIssues: [
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
      ],
      weatherForecast: {
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
      },
      permitStatus: []
    },
    
    fieldReport: {
      workCompleted: [
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
      ],
      issuesEncountered: [],
      safetyObservations: [
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
      ],
      manpower: {
        planned: 22,
        actual: 22,
        trades: []
      },
      equipment: [],
      materials: [],
      weatherActual: 'Light rain in morning, 80°F, overcast'
    },
    
    narratives: {
      technical: 'The abatement contractor discovered additional asbestos-containing material in the ceiling space of the 2nd floor corridor that was not identified in the original hazardous materials survey. Work in this area was immediately stopped, and proper containment protocols were implemented. Air monitoring was conducted, and samples were collected for testing. The environmental consultant was notified and visited the site to assess the situation and develop an abatement plan for this additional material.',
      
      executive: 'A critical environmental issue emerged today with the discovery of additional asbestos in the 2nd floor corridor ceiling that wasn\'t identified in the original survey. Work in this area has been stopped, and proper containment protocols implemented. This will require an updated abatement plan and will impact the renovation schedule for this area. Roof replacement is 60% complete but has encountered an issue with 800 SF of deteriorated deck requiring replacement.',
      
      owner: 'Our environmental team has identified some additional asbestos-containing material in a ceiling space that wasn\'t detected in the original building survey. We\'ve implemented all proper safety protocols immediately, and our environmental consultant is developing a plan to address this material safely and in compliance with all regulations. This situation is being managed with student and staff safety as the absolute priority.',
      
      public: 'Improvements continue at the school, with work progressing on multiple upgrades that will enhance the learning environment. All work is being conducted with strict adherence to safety protocols, particularly for environmental considerations, to ensure the well-being of future building occupants and the construction team.'
    },
    
    media: {
      photos: [
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
      ],
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: [],
      safety: []
    },
    
    flags: {
      scheduleImpact: true,
      safetyIncident: true,
      ownerNotification: true,
      budgetImpact: true,
      weatherDelay: true
    },
    
    aiContext: {
      relatedDocuments: ['spec-section-075000.pdf', 'spec-section-230000.pdf', 'asbestos-survey.pdf'],
      relatedDrawings: ['A-101.pdf', 'M-101.pdf'],
      modelReferences: ['model-school-architectural', 'model-school-mep'],
      scheduleActivities: ['act-s-001', 'act-s-002']
    }
  },
  
  // Mixed-Use Project - Elevator Delay
  {
    id: 'report-mixeduse-001',
    projectId: 'project-mixeduse',
    projectName: 'City Center Development',
    projectPhase: 'Interior Fit-out / Vertical Transportation',
    reportDate: new Date(),
    
    superintendent: {
      name: 'Lisa Wong',
      id: 'super-005',
      contact: 'lisa.wong@construction.com'
    },
    
    context: {
      scheduledActivities: [
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
        }
      ],
      activeRFIs: [],
      openIssues: [
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
      weatherForecast: {
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
      permitStatus: []
    },
    
    fieldReport: {
      workCompleted: [
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
      issuesEncountered: [],
      safetyObservations: [],
      manpower: {
        planned: 25,
        actual: 23,
        trades: []
      },
      equipment: [],
      materials: [],
      weatherActual: 'Clear, 82°F, light breeze'
    },
    
    narratives: {
      technical: 'The elevator contractor notified the project team of a 3-week delay in the delivery of elevator equipment for Tower A due to manufacturing issues at their factory. This delay affects the elevator installation scheduled to start next week and will impact the overall completion of the vertical transportation system. The critical path currently runs through the elevator installation and testing, so this delay directly impacts the project completion date.',
      
      executive: 'A critical issue has emerged with the elevator vendor reporting a 3-week delay in equipment delivery for Tower A. This directly impacts the project critical path and will delay the overall completion date unless mitigation measures are implemented. The project team is evaluating acceleration options for subsequent activities. Retail space framing on Level 1 is now 100% complete for units 101-103, ready for MEP rough-in to begin tomorrow.',
      
      owner: 'We\'ve encountered a challenge with the elevator equipment delivery, with the manufacturer reporting a three-week delay due to production issues. Our team is working on a recovery plan to minimize the impact on the overall project schedule and is evaluating all options to maintain the target opening date. The retail spaces on Level 1 are taking shape, with all interior walls now framed for the first three retail units.',
      
      public: 'Construction continues on the mixed-use development that will bring new retail, office, and residential options to the neighborhood. The ground floor retail spaces are now being framed, creating the individual shops and restaurants that will activate the street level.'
    },
    
    media: {
      photos: [
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
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: [],
      safety: []
    },
    
    flags: {
      scheduleImpact: true,
      safetyIncident: false,
      ownerNotification: true,
      budgetImpact: false,
      weatherDelay: false
    },
    
    aiContext: {
      relatedDocuments: ['spec-section-092900.pdf', 'spec-section-142100.pdf'],
      relatedDrawings: ['A-101.pdf', 'ID-201.pdf'],
      modelReferences: ['model-mixeduse-architectural', 'model-mixeduse-mep'],
      scheduleActivities: ['act-m-001', 'act-m-002']
    }
  }
];

export default {
  mockDailyReports
};
