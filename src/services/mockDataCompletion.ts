    
    aiContext: {
      relatedDocuments: ['spec-section-034100.pdf', 'spec-section-033000.pdf'],
      relatedDrawings: ['S-301.pdf', 'S-501.pdf'],
      modelReferences: ['model-bridge-structural', 'model-bridge-foundation'],
      scheduleActivities: ['act-b-001', 'act-b-002']
    }
  },
  
  // Mixed-Use Project
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
      scheduledActivities: mockActivities.mixeduse,
      activeRFIs: mockRFIs.mixeduse,
      openIssues: mockIssues.mixeduse,
      weatherForecast: mockWeather.mixeduse,
      permitStatus: mockPermits.mixeduse
    },
    
    fieldReport: {
      workCompleted: mockWorkItems.mixeduse,
      issuesEncountered: mockIssues.mixeduse,
      safetyObservations: mockSafetyObservations.mixeduse,
      manpower: {
        planned: 25,
        actual: 23,
        trades: mockTrades.mixeduse
      },
      equipment: mockEquipment.mixeduse,
      materials: mockMaterials.mixeduse,
      weatherActual: 'Clear, 82°F, light breeze'
    },
    
    narratives: mockNarratives.mixeduse,
    
    media: {
      photos: mockPhotos.mixeduse,
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: mockPermits.mixeduse,
      safety: []
    },
    
    flags: {
      scheduleImpact: true,
      safetyIncident: true,
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
  },
  
  // School Project
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
      scheduledActivities: mockActivities.school,
      activeRFIs: mockRFIs.school,
      openIssues: mockIssues.school,
      weatherForecast: mockWeather.school,
      permitStatus: mockPermits.school
    },
    
    fieldReport: {
      workCompleted: mockWorkItems.school,
      issuesEncountered: mockIssues.school,
      safetyObservations: mockSafetyObservations.school,
      manpower: {
        planned: 22,
        actual: 22,
        trades: mockTrades.school
      },
      equipment: mockEquipment.school,
      materials: mockMaterials.school,
      weatherActual: 'Light rain in morning, 80°F, overcast'
    },
    
    narratives: mockNarratives.school,
    
    media: {
      photos: mockPhotos.school,
      markups: [],
      modelViews: []
    },
    
    compliance: {
      inspections: [],
      permits: mockPermits.school,
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
  }
];

// Export the mock data
export default {
  mockDailyReports,
  mockActivities,
  mockRFIs,
  mockIssues,
  mockWeather,
  mockPermits,
  mockWorkItems,
  mockSafetyObservations,
  mockTrades,
  mockEquipment,
  mockMaterials,
  mockPhotos,
  mockNarratives
};
