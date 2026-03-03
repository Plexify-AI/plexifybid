#!/usr/bin/env node
/**
 * /plexi-test [suite]
 *
 * Run test suites for PlexifyAEC.
 *
 * Usage:
 *   node scripts/superpowers/test.js warmth    — Warmth engine unit tests (vitest)
 *   node scripts/superpowers/test.js rls       — RLS tenant isolation tests (node, requires running server)
 *   node scripts/superpowers/test.js gateway   — LLM Gateway tests (vitest)
 *   node scripts/superpowers/test.js all       — Run all vitest suites
 *   node scripts/superpowers/test.js           — Show available suites
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const SUITES = {
  warmth: {
    description: 'Warmth engine unit tests',
    runner: 'vitest',
    command: 'npx vitest run server/tests/warmth/',
  },
  rls: {
    description: 'RLS tenant isolation leak test (requires running server)',
    runner: 'node',
    command: 'node server/tests/rls-leak-test.mjs',
  },
  gateway: {
    description: 'LLM Gateway unit tests',
    runner: 'vitest',
    command: 'npx vitest run server/tests/gateway/',
  },
  all: {
    description: 'All vitest suites',
    runner: 'vitest',
    command: 'npx vitest run',
  },
};

const suite = process.argv[2];

if (!suite || !SUITES[suite]) {
  console.log('');
  console.log('  /plexi-test — PlexifyAEC Test Runner');
  console.log('');
  console.log('  Available suites:');
  for (const [name, config] of Object.entries(SUITES)) {
    console.log(`    ${name.padEnd(10)} ${config.description}`);
  }
  console.log('');
  console.log('  Usage: node scripts/superpowers/test.js <suite>');
  console.log('');
  process.exit(suite ? 1 : 0);
}

const config = SUITES[suite];

console.log('');
console.log(`  Running: ${config.description}`);
console.log(`  Command: ${config.command}`);
console.log('');

try {
  execSync(config.command, { cwd: ROOT, stdio: 'inherit' });
} catch (err) {
  process.exit(err.status || 1);
}
