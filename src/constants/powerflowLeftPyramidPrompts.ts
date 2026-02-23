/**
 * Powerflow Left Pyramid — Capsule Button Prompts
 *
 * 6 levels mapped to Maslow needs × Bloom cognitive levels × sales stages.
 * Each entry contains the user-facing prompt text that pre-populates Ask Plexi.
 * System prompts for each level are stored server-side in server/constants/powerflowPrompts.js.
 *
 * Level 1 uses {{template_variables}} that are interpolated with live pipeline data.
 * Levels 2-6 send their userPrompt as-is — Claude queries live data via tools at inference time.
 */

import type { PowerflowPrompt } from '../types/powerflowPrompts';

export const POWERFLOW_LEFT_PROMPTS: PowerflowPrompt[] = [
  {
    level: 1,
    label: '1. Coffee & Wi-Fi first!!',
    maslow: 'Physiological',
    bloom: 'Remember',
    salesStage: 'Day Start / Zero Context',
    userPrompt:
      'Good morning. You have {{activeOpportunityCount}} active opportunities in your pipeline. ' +
      '{{topOpportunityName}} is showing a warmth score of {{topWarmthScore}}% — my hottest lead right now.\n\n' +
      'Before anything else: What is the ONE thing I most want to move forward today? Tell me the deal name or ' +
      'contact and I will build my morning game plan around it.\n\n' +
      "If you're not sure, I can scan my pipeline and pick my best move. Just say 'Show me my best move.'",
    emptyPipelineFallback:
      "Good morning. I don't have any opportunities loaded yet — let's fix that right now.\n\n" +
      "Tell me about one deal or prospect I'm working on today. Give me a company name, a contact, or even just " +
      "an industry I'm targeting, and help me build my pipeline from there.\n\n" +
      "If you'd rather you suggest where to start, just say 'Help me find my first prospect.'",
  },
  {
    level: 2,
    label: '2. Without data and leads, nothing else starts.',
    maslow: 'Safety',
    bloom: 'Understand',
    salesStage: 'Pipeline Audit / 1-2 Touches',
    userPrompt:
      'Run a pipeline audit on my active opportunities.\n\n' +
      'For each opportunity, tell me:\n' +
      '1. How many touches have been logged\n' +
      '2. The last touch date and method (email, call, site visit)\n' +
      '3. Whether a reply has been received\n' +
      '4. Any missing data that would block progression (no decision-maker contact, no budget signal, no next meeting scheduled)\n\n' +
      'Flag any lead that has gone dark for more than 14 days. For each dark lead, suggest one specific ' +
      're-engagement action I can take today.\n\n' +
      'Show me where my pipeline has holes before I build my day around bad assumptions.',
  },
  {
    level: 3,
    label: '3. Secure the process and trust every lead.',
    maslow: 'Love/Belonging',
    bloom: 'Apply',
    salesStage: 'Relationship Building / 3-5 Touches / Warmth 30-50%',
    userPrompt:
      "I'm in active engagement with prospects in the 30-50% warmth range. These relationships are forming but not yet secured.\n\n" +
      'For each opportunity in this warmth band, generate:\n' +
      "1. A one-sentence 'trust hook' — the most relevant thing I can reference to show I've done my homework on their specific project or situation\n" +
      '2. A recommended next touch: email, call, or in-person — with the specific objective of that touch (not just \'check in\')\n' +
      '3. A one-line subject line for an email if email is the recommended channel\n\n' +
      'Prioritize opportunities where a reply was received in the last 7 days — those signals are hot. Do not ' +
      'recommend generic follow-ups. Every suggestion must be tied to the specific opportunity context.',
  },
  {
    level: 4,
    label: '4. Connect, engage, and build relationships.',
    maslow: 'Esteem',
    bloom: 'Analyze',
    salesStage: 'Buying Signal Detection / 5-8 Touches / Warmth 50-70%',
    userPrompt:
      'Analyze my active pipeline for buying signals.\n\n' +
      'For each opportunity at 50-70% warmth, identify:\n' +
      '1. Which specific interactions constitute a buying signal (email forwards, timeline questions, specific scope mentions, meeting requests)\n' +
      '2. The relationship trajectory — is warmth increasing, plateauing, or starting to cool?\n' +
      '3. Who the real decision-maker is vs. who I have been talking to — are they the same person?\n' +
      '4. The single highest-impact action to advance this opportunity to 70%+ warmth\n\n' +
      'Then give me a ranked list: which 2-3 opportunities deserve my focused attention this week based on ' +
      'signal strength, not just dollar value?',
  },
  {
    level: 5,
    label: '5. Boost efficiency and sales edge.',
    maslow: 'Self-Actualization',
    bloom: 'Evaluate',
    salesStage: 'Strategic Evaluation / Proposal Stage / Warmth 70-90%',
    userPrompt:
      'Evaluate my highest-probability opportunities — those in the 70-90% warmth range with proposals pending or submitted.\n\n' +
      'For each, I need a strategic read:\n' +
      '1. Deal velocity assessment: is this moving toward a close or stalling? What is the evidence?\n' +
      '2. Competitive exposure: based on what I know, am I the frontrunner, a backup, or unknown?\n' +
      '3. Decision-maker status: do I have direct access to the final decision-maker, or am I one layer away?\n' +
      "4. Recommended strategic move: one specific action designed to lock in my position (not 'follow up' — give me something differentiated)\n\n" +
      'Flag any deal that shows stall signals — no response in 7+ days after proposal submission. For stalled ' +
      'deals, generate one re-engagement message I can send today that is direct without being desperate.',
  },
  {
    level: 6,
    label: '6. Peak Performance Transcendence',
    maslow: 'Transcendence',
    bloom: 'Create',
    salesStage: 'Closing Strategy / 90%+ Forecast / Final Negotiations',
    userPrompt:
      'I am in closing mode. The following opportunities are at 90%+ forecast. Build me a closing strategy for each.\n\n' +
      'For each 90%+ opportunity, create:\n' +
      '1. A closing checklist: what must happen before a contract is signed (scope confirmed, proposal accepted, procurement cleared, contract sent, etc.)\n' +
      '2. Anticipated last-minute objections and a one-paragraph response to each\n' +
      '3. A final outreach draft — the message I send to push this deal across the line. Make it direct, specific to the project, and written in my voice as a BD professional — not a generic sales email\n' +
      "4. A recommended close date based on the deal's current momentum and decision-maker timeline\n\n" +
      'Then give me a 30-day view: if all 90%+ deals close on schedule, what does my pipeline look like — and what should I be feeding NOW to replace them?',
  },
];
