// Standalone artifact for Ken's project knowledge — NOT a repo component.
// Drop-in replacement / merge candidate for the existing PlexifyFeatureGuide
// in Claude project knowledge. Sprint E adds three cards at the end of the
// FEATURES array: Strategy Skills, Home Activity Feed, Factual Auditor.
//
// Brand colors used:
//   Deep Louvre Navy   #0D1B3E
//   Royal Purple       #6B2FD9
//   Signal Teal        #10B981
//   Warm Amber         #F59E0B
//   Electric Violet    #8B5CF6

import React, { useState } from 'react';

const FEATURES = [
  // ... existing FeatureGuide cards live here in your project-knowledge copy.
  // Sprint E additions follow:

  {
    icon: '🎯',
    title: 'Strategy Skills',
    subtitle: '7 senior-consultant moves on demand',
    color: '#6B2FD9',
    steps: [
      'Open any Deal Room → Strategy tab',
      'Pick a skill: Go/No-Go, Fee Strategy, Competitor Teardown, Acquisition Playbook, Growth Plan, BID/OZ Opportunity Brief, or Stakeholder Entry Map',
      'Input pre-fills from prospect context; adjust as needed',
      'Output renders with citations and a factual audit pass/fail',
    ],
  },

  {
    icon: '📡',
    title: 'Home Activity Feed',
    subtitle: 'See autonomous work as it happens',
    color: '#10B981',
    steps: [
      'Open Home → Activity section',
      'Watch Pipeline Analyst rescore your pipeline nightly',
      'Scan any market on demand — results stream in via Research Scanner',
      'Create a Deal Room and War Room Prep runs automatically, producing a document checklist',
    ],
  },

  {
    icon: '🛡️',
    title: 'Factual Auditor',
    subtitle: 'Never hallucinate a past project',
    color: '#F59E0B',
    steps: [
      'Generate any artifact (Board Brief, SOQ section, OZ opportunity brief)',
      'Click Export',
      'Auditor checks every citable claim against your data, OZ tract database, and BID boundaries',
      'Blocked claims surface with evidence; override requires documented reason',
    ],
  },
];

const PlexifyFeatureGuide = () => {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div style={{ background: '#0D1B3E', color: 'white', minHeight: '100vh', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>PlexifySOLO — Feature Guide</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {FEATURES.map((f, i) => (
          <button
            key={i}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{
              textAlign: 'left',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${f.color}40`,
              borderRadius: 8,
              padding: 14,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 20 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, marginTop: 6, color: f.color }}>{f.title}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{f.subtitle}</div>
            {openIdx === i && (
              <ol style={{ marginTop: 10, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                {f.steps.map((s, j) => <li key={j} style={{ marginBottom: 4 }}>{s}</li>)}
              </ol>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlexifyFeatureGuide;
