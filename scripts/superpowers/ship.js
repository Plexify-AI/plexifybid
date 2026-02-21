#!/usr/bin/env node
/**
 * /plexi-ship [session]
 *
 * Generates handoff doc template, commit message, Railway deploy checklist.
 * Usage: node scripts/superpowers/ship.js 12
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const [, , session] = process.argv;

if (!session) {
  console.log('Usage: node scripts/superpowers/ship.js <session_number>');
  process.exit(1);
}

// Read package.json for version
let version = 'unknown';
try {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  version = pkg.version;
} catch {}

const date = new Date().toISOString().slice(0, 10);

console.log(`
================================================================================
PLEXIFYSOLO SESSION ${session} SHIP CHECKLIST
Generated: ${date}
================================================================================

1. COMMIT
   git add -A
   git commit -m "feat(session${session}): <describe what was built>"
   git push origin main

2. PRE-DEPLOY VERIFICATION
   [ ] npm run build — no errors
   [ ] All new tables have RLS enabled
   [ ] No secrets in committed code
   [ ] .env.local not committed

3. RAILWAY DEPLOY
   Railway auto-deploys from main. Monitor at:
   https://railway.app/dashboard

   Check deploy logs for:
   [ ] Docker build succeeds
   [ ] Server starts on correct PORT
   [ ] /api/health returns 200

4. POST-DEPLOY VERIFICATION
   [ ] https://solo.plexifyai.com/api/health
   [ ] Sandbox URL loads for each tenant
   [ ] Ask Plexi responds correctly
   [ ] No console errors

5. HANDOFF DOC
   Create: docs/HANDOFF_SESSION${session}_COMPLETE.md
   Include:
   - Session summary
   - New tables/schema changes
   - Sandbox tokens table
   - Known issues
   - Deferred items
   - Next session paste block

6. UPDATE
   [ ] docs/SPRINT_STATUS.md
   [ ] CLAUDE.md (if directory structure changed)

================================================================================
Version: ${version}
================================================================================
`);
