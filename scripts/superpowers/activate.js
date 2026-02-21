#!/usr/bin/env node
/**
 * /plexi-activate [domain]
 *
 * Loads domain vocabulary + persona into context.
 * Domains: aec, event, broadcast, consumer-tech, internal-dev
 * Usage: node scripts/superpowers/activate.js event
 */

const DOMAINS = {
  aec: {
    label: 'AEC (Architecture, Engineering, Construction)',
    vocab: { prospects: 'prospects', pipeline: 'pipeline', deal: 'deal', outreach: 'outreach' },
    persona: 'Construction BD professional. Speaks in project phases, GC relationships, and procurement.',
  },
  event: {
    label: 'Event Production & Sponsorship',
    vocab: { prospects: 'sponsors', pipeline: 'event portfolio', deal: 'partnership', outreach: 'sponsor outreach' },
    persona: 'Events BD director. Speaks in sponsorship value, event production, and board-level reporting.',
  },
  broadcast: {
    label: 'Broadcast Production',
    vocab: { prospects: 'prospects', pipeline: 'pipeline', deal: 'deal', outreach: 'outreach' },
    persona: 'Broadcast production VP. Speaks in OB trucks, remote production, sports rights, and streaming.',
  },
  'consumer-tech': {
    label: 'Consumer Technology / Retail',
    vocab: { prospects: 'prospects', pipeline: 'pipeline', deal: 'deal', outreach: 'outreach' },
    persona: 'Solo founder selling creative hardware. Consultative approach, product pairing expertise.',
  },
  'internal-dev': {
    label: 'Internal Development',
    vocab: { prospects: 'prospects', pipeline: 'pipeline', deal: 'deal', outreach: 'outreach' },
    persona: 'Platform builder. Speaks in agents, features, sprints, and pilot feedback.',
  },
};

const [, , domain] = process.argv;

if (!domain || !DOMAINS[domain]) {
  console.log('Usage: node scripts/superpowers/activate.js <domain>');
  console.log(`Domains: ${Object.keys(DOMAINS).join(', ')}`);
  process.exit(1);
}

const config = DOMAINS[domain];
console.log(`\nActivated domain: ${config.label}`);
console.log(`Persona: ${config.persona}`);
console.log(`Vocab skin:`, JSON.stringify(config.vocab, null, 2));
console.log(`\nDomain context loaded. Use this config when building tenant-specific features.`);
