#!/usr/bin/env node
/**
 * Seed Mel Wallace's Voice DNA profile for Hexagon/Multivista tenant.
 *
 * Usage: node scripts/seed-mel-voicedna.mjs
 *
 * Requires .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Archives any existing active profile before inserting (unique constraint).
 * Safe to re-run — archives previous, inserts fresh.
 *
 * Calibration source: "researched" — derived from LinkedIn articles, BIM For All
 * podcast, and public speaking style. Not yet validated against actual writing samples.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MEL_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const profileData = {
  meta: {
    schemaVersion: '1.0',
    analyzedAt: new Date().toISOString(),
    sampleCount: 0,
    confidenceScore: 0.65,
  },
  persona: {
    summary:
      'Direct, mission-oriented sales leader who speaks as a peer to construction executives. ' +
      'Former Marine background drives clear, decisive communication focused on ROI and operational outcomes.',
    archetype: 'Construction Sales Veteran',
    traits: [
      'Direct, mission-oriented communication',
      'Former Marine — clear, decisive language',
      'ROI-focused over feature-focused',
      'Positions as peer and advisor, never as vendor',
      'Uses construction and military metaphors naturally',
      'References industry trends (BIM, reality capture, digital twins)',
    ],
  },
  voiceDimensions: {
    formality: { score: 6, notes: 'Professional but not stiff — conversational with executives' },
    warmth: { score: 6, notes: 'Friendly but business-focused — not overly casual' },
    directness: { score: 9, notes: 'Marine background — gets to the point fast, no hedging' },
    technicalDepth: { score: 8, notes: 'Deep construction tech knowledge — BIM, reality capture, digital twins' },
    enthusiasm: { score: 6, notes: 'Confident conviction, not cheerleader energy' },
    confidence: { score: 9, notes: 'Decisive language, strong recommendations, no hedging' },
    humor: { score: 3, notes: 'Occasional dry wit, never jokes in formal contexts' },
  },
  vocabulary: {
    preferredTerms: [
      'reality capture',
      'documentation compliance',
      'site visibility',
      'project intelligence',
      'field-to-office',
      'preconstruction',
      'digital twin',
      'construction documentation',
      'as-built verification',
      'visual record',
    ],
    avoidedTerms: [
      'delve',
      'leverage',
      'seamless',
      'transformative',
      'synergy',
      'paradigm',
      'holistic',
      'cutting-edge',
      'game-changer',
      'circle back',
    ],
    signaturePhrases: [
      'Here\'s the bottom line',
      'From a field perspective',
      'The ROI speaks for itself',
      'Let me cut to it',
    ],
    jargonPolicy: 'Use construction industry terms naturally — assume the reader is a peer. Avoid generic business buzzwords.',
  },
  sentenceStructure: {
    averageLength: 12,
    voice: 'active',
    useContractions: true,
    perspective: 'first',
    useFragments: true,
  },
  voiceContrasts: {
    weAre: [
      'Direct and action-oriented',
      'ROI-focused with real numbers',
      'Peer-to-peer, construction professional to construction professional',
      'Short paragraphs, punchy sentences',
    ],
    weAreNot: [
      'Verbose or academic',
      'Feature-first marketers',
      'Vendor-pitch salespeople',
      'Hedging or indecisive',
    ],
  },
  toneAdaptations: {
    general: 'Direct, professional, construction-industry language. Short sentences. Active voice. Lead with outcomes.',
    email: {
      greeting: "Direct first name, never 'Dear'",
      signOff: 'Best, Mel',
      lengthPreference: 'short',
      ctaStyle: 'Single clear ask, never multiple options',
    },
    'outreach-cold': {
      approach: 'Lead with industry insight or shared connection',
      positioning: 'Peer-to-peer, never vendor pitch',
      hook: "Reference a specific project, trend, or pain point they'd recognize",
    },
    'outreach-warm': {
      approach: 'Reference shared history or mutual connection',
      positioning: 'Continue an existing relationship',
      hook: 'Build on previous conversation or meeting',
    },
    proposal: 'Data-driven, ROI-centered. Open with the business case, not the technology. Include specific dollar figures and timeline.',
    social: 'Industry thought leadership tone. Share insights from the field, not product pitches. Short-form, punchy.',
    'meeting-brief': {
      format: 'Mission-oriented, bullet-heavy, action items up front',
      focus: "What do I need to know, what's my play, what's the ask",
    },
    'board-brief': {
      format: 'Executive summary first, data-backed, risk-aware',
      focus: 'ROI, competitive position, timeline, decision points',
    },
  },
  examples: {
    onBrand: [
      'Marcus, quick note — Turner\'s Houston portfolio has 12 sites running without consistent documentation. That\'s a compliance gap waiting to become a change order. Worth 15 minutes to show you how we close it.',
      'The reality capture ROI on a 40-site rollout pays for itself in reduced rework alone. We\'re seeing 3-4% savings on total project cost.',
      'Here\'s the bottom line: your field teams are spending 6 hours a week on documentation that should take 30 minutes.',
    ],
    offBrand: [
      'Dear Mr. Webb, I hope this email finds you well. I wanted to reach out to discuss how our transformative solution could leverage your existing workflows...',
      'We offer a holistic, cutting-edge platform that seamlessly integrates with your current tech stack to deliver a paradigm shift in construction documentation.',
      'Perhaps we could circle back on this at some point? I think there might be some synergies worth exploring if you have a moment.',
    ],
  },
  antiPatterns: [
    'Multiple CTAs in one email — always single clear ask',
    'Feature-first language — always lead with business outcome',
    "'Dear [Name]' greeting — always direct first name",
    'Marketing buzzwords — speak like a construction professional',
    'Passive voice — always active and direct',
    'Long paragraphs — keep it punchy, 2-3 sentences per paragraph max',
    "Hedging language ('maybe', 'perhaps', 'I think') — be decisive",
  ],
  calibration: {
    calibration_source: 'researched',
    calibration_notes:
      "Derived from LinkedIn articles, BIM For All podcast appearances, and public speaking style. " +
      "Not yet validated against actual writing samples from Mel. Profile should be refined after " +
      "collecting 5+ sent emails and 3+ LinkedIn posts from Mel's actual communication. " +
      "Upgrade path: researched -> sample_validated -> continuously_tuned.",
    last_calibrated: '2026-04-06',
    samples_analyzed: 0,
    refinement_ready: false,
  },
};

async function seed() {
  console.log('Seeding Voice DNA profile for Mel Wallace...\n');

  // Verify tenant exists
  const { data: tenant } = await sb
    .from('tenants')
    .select('id, name, company')
    .eq('id', MEL_TENANT_ID)
    .single();

  if (!tenant) {
    console.error('Mel tenant not found at', MEL_TENANT_ID);
    process.exit(1);
  }
  console.log(`  Tenant: ${tenant.name} — ${tenant.company}`);

  // Archive any existing active profile
  const { data: existing } = await sb
    .from('voice_dna_profiles')
    .select('id, profile_name')
    .eq('tenant_id', MEL_TENANT_ID)
    .eq('status', 'active');

  if (existing && existing.length > 0) {
    for (const p of existing) {
      await sb
        .from('voice_dna_profiles')
        .update({ status: 'archived' })
        .eq('id', p.id);
      console.log(`  Archived existing profile: ${p.profile_name} (${p.id})`);
    }
  }

  // Insert new active profile
  const { data: profile, error } = await sb
    .from('voice_dna_profiles')
    .insert({
      tenant_id: MEL_TENANT_ID,
      profile_name: 'Mel Wallace — Construction Sales Veteran',
      owner_name: 'Mel Wallace',
      status: 'active',
      profile_data: profileData,
      confidence_score: 0.65,
      version: 1,
    })
    .select('id, profile_name, status')
    .single();

  if (error) {
    console.error('Insert failed:', error);
    process.exit(1);
  }

  console.log(`\n  ✅ Profile created: ${profile.profile_name}`);
  console.log(`     ID: ${profile.id}`);
  console.log(`     Status: ${profile.status}`);
  console.log(`     Calibration: researched (not yet sample-validated)`);

  // Verify calibration metadata
  const { data: verify } = await sb
    .from('voice_dna_profiles')
    .select('profile_data->calibration')
    .eq('id', profile.id)
    .single();

  console.log(`     Calibration source: ${verify?.calibration?.calibration_source || 'stored'}`);
  console.log(`     Samples analyzed: ${verify?.calibration?.samples_analyzed || 0}`);
  console.log(`     Refinement ready: ${verify?.calibration?.refinement_ready || false}`);

  console.log('\nDone. Voice DNA is now active for Mel\'s tenant.');
  console.log('Test: Open Mel\'s sandbox → Deal Room → Generate Board Brief');
}

seed();
