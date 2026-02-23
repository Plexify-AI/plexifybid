/**
 * Powerflow Right Pyramid — Encouragement Quotes (Success Logger)
 *
 * 6 levels mapped to Maslow needs x Bloom cognitive levels.
 * Each entry contains the encouragement quote shown when a stage
 * is completed. Displayed inline below the capsule label with
 * a max-height expand animation.
 *
 * Quote text is exact and intentional for BD audience — do not paraphrase.
 */

import type { PowerflowSuccessQuote } from '../types/powerflowPrompts';

export const POWERFLOW_RIGHT_QUOTES: PowerflowSuccessQuote[] = [
  {
    level: 1,
    capsuleLabel: 'Find It',
    bloom: 'Remember',
    maslow: 'Physiological',
    activatedLabel: 'Discovered',
    encouragementQuote:
      "Your next big win isn't missing; it's just waiting to be discovered. Trust your eyes and your data \u2014 the hunt is where the victory begins.",
    quoteAttribution: '\u2014 Plexify Powerflow',
  },
  {
    level: 2,
    capsuleLabel: 'Know It',
    bloom: 'Understand',
    maslow: 'Safety',
    activatedLabel: 'Understood',
    encouragementQuote:
      "Knowledge is the ultimate sales edge. When you truly understand the 'why' behind the 'what,' you don't just pitch \u2014 you provide the solution they've been searching for.",
    quoteAttribution: '\u2014 Plexify Powerflow',
  },
  {
    level: 3,
    capsuleLabel: 'Reach It',
    bloom: 'Apply',
    maslow: 'Love/Belonging',
    activatedLabel: 'In Motion',
    encouragementQuote:
      "Execution is the bridge between a goal and a result. Take that knowledge and put it into motion \u2014 every reach brings you one step closer to the 'Yes'.",
    quoteAttribution: '\u2014 Plexify Powerflow',
  },
  {
    level: 4,
    capsuleLabel: 'See It',
    bloom: 'Analyze',
    maslow: 'Esteem',
    activatedLabel: 'Analyzed',
    encouragementQuote:
      'Vision is seeing the opportunity before it becomes obvious. By analyzing the landscape clearly, you stay three steps ahead of the competition.',
    quoteAttribution: '\u2014 Plexify Powerflow',
  },
  {
    level: 5,
    capsuleLabel: 'Decide It',
    bloom: 'Evaluate',
    maslow: 'Self-Actualization',
    activatedLabel: 'Decided',
    encouragementQuote:
      'Confidence comes from clarity. Trust your evaluation of the situation \u2014 you have the tools and the instinct to make the right move at the right time.',
    quoteAttribution: '\u2014 Plexify Powerflow',
  },
  {
    level: 6,
    capsuleLabel: 'Close It',
    bloom: 'Create',
    maslow: 'Transcendence',
    activatedLabel: 'Closed',
    encouragementQuote:
      "The close isn't just an end; it's the creation of a new partnership. Seal the deal with the pride of knowing you've delivered value and reached the peak.",
    quoteAttribution: '\u2014 Plexify Powerflow',
  },
];
