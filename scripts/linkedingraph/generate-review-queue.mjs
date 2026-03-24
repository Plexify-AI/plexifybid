/**
 * Task 2: Generate prioritized review queue CSV for Ken's manual review.
 * Reads ken_SOLO_tier1_CLASSIFIED.csv, filters Warm+Tagged contacts,
 * assigns P0-P3 priority, writes ken_SOLO_review_queue.csv.
 *
 * If data/linkedingraph_warmth_signals.json exists, uses composite warmth
 * scores (0-100) for P0-P3 thresholds. Otherwise falls back to
 * message-count-only logic (Recipe v0.2.0 behavior).
 *
 * Usage:
 *   node scripts/linkedingraph/generate-review-queue.mjs [options]
 *
 * Options:
 *   --p0-threshold <n>  Minimum composite warmth for P0 (default: 65)
 *   --p1-threshold <n>  Minimum composite warmth for P1 (default: 45)
 *   --p2-threshold <n>  Minimum composite warmth for P2 (default: 20)
 *   --help              Show this help message
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const WARMTH_FILE = join(DATA_DIR, 'linkedingraph_warmth_signals.json');

// ── CLI argument parsing ──
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`Usage: node scripts/linkedingraph/generate-review-queue.mjs [options]

Options:
  --p0-threshold <n>  Minimum composite warmth for P0 / Immediate (default: 65)
  --p1-threshold <n>  Minimum composite warmth for P1 / High (default: 45)
  --p2-threshold <n>  Minimum composite warmth for P2 / Review (default: 20)
  --help              Show this help message

P3 captures all remaining contacts with warmth > 0.`);
  process.exit(0);
}

function getArgInt(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return defaultVal;
  const val = parseInt(args[idx + 1], 10);
  if (isNaN(val) || val < 0 || val > 100) {
    console.error(`ERROR: ${flag} must be an integer 0-100, got "${args[idx + 1]}"`);
    process.exit(1);
  }
  return val;
}

const P0_THRESHOLD = getArgInt('--p0-threshold', 65);
const P1_THRESHOLD = getArgInt('--p1-threshold', 45);
const P2_THRESHOLD = getArgInt('--p2-threshold', 20);

// ── CSV parser ──
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len || text[i] === '\n' || text[i] === '\r') return '';
    if (text[i] === '"') {
      i++;
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      return field;
    } else {
      let field = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i++;
      }
      return field;
    }
  }

  while (i < len) {
    const row = [];
    while (true) {
      row.push(parseField());
      if (i < len && text[i] === ',') { i++; continue; }
      break;
    }
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

function parseMessageCount(notes) {
  if (!notes || notes.trim() === '') return 0;
  const match = notes.match(/^(\d+)\s+msgs?\b/);
  return match ? parseInt(match[1], 10) : 0;
}

function assignPriority(warm, msgCount) {
  if (warm === 'Y' && msgCount >= 10) return 'P0';
  if (warm === 'Y') return 'P1';
  if (warm === 'Maybe' && msgCount >= 5) return 'P2';
  return 'P3';
}

function assignPriorityComposite(composite) {
  if (composite >= P0_THRESHOLD) return 'P0';
  if (composite >= P1_THRESHOLD) return 'P1';
  if (composite >= P2_THRESHOLD) return 'P2';
  return 'P3';
}

function normalizeLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let n = url.trim();
  if (!n) return null;
  n = n.replace(/^https?:\/\//, '');
  n = n.replace(/^www\./, '');
  n = n.replace(/\/$/, '');
  return n.toLowerCase();
}

function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── Main ──
const inputPath = join(DATA_DIR, 'ken_SOLO_tier1_CLASSIFIED.csv');
const outputPath = join(DATA_DIR, 'ken_SOLO_review_queue.csv');

// Load warmth signals if available
let warmthSignals = null;
let useComposite = false;
if (existsSync(WARMTH_FILE)) {
  try {
    warmthSignals = JSON.parse(readFileSync(WARMTH_FILE, 'utf-8'));
    useComposite = true;
    console.log(`Warmth signals loaded: ${Object.keys(warmthSignals.contacts || {}).length} contacts`);
    console.log(`Using composite warmth scoring (P0=${P0_THRESHOLD}+, P1=${P1_THRESHOLD}+, P2=${P2_THRESHOLD}+, P3=1+)\n`);
  } catch (err) {
    console.log(`WARNING: Could not parse warmth signals file: ${err.message}`);
    console.log('Falling back to message-count-only scoring\n');
  }
} else {
  console.log('No warmth signals file found — using message-count-only scoring (v0.2.0)\n');
}

const raw = readFileSync(inputPath, 'utf-8');
const parsed = parseCSV(raw);
const headers = parsed[0];
const dataRows = parsed.slice(1);

const col = {};
for (let i = 0; i < headers.length; i++) {
  col[headers[i]] = i;
}

// Filter and build output rows
const outputRows = [];

for (const row of dataRows) {
  const vertical = (row[col['Vertical']] || '').trim();
  if (vertical === '') continue; // Must have a vertical

  const url = (row[col['URL']] || '').trim();
  const warm = (row[col['Warm']] || '').trim();
  const msgCount = parseMessageCount(row[col['Notes']]);
  const normUrl = normalizeLinkedInUrl(url);

  let priority;
  let warmthScore = 0;

  if (useComposite && normUrl && warmthSignals.contacts[url]) {
    // Composite warmth path
    const wData = warmthSignals.contacts[url];
    warmthScore = wData.warmth_composite;
    priority = assignPriorityComposite(warmthScore);

    // Must have some signal to enter queue
    if (warmthScore === 0) continue;
  } else {
    // Fallback: original message-count-only logic
    if (warm !== 'Y' && warm !== 'Maybe') continue;
    priority = assignPriority(warm, msgCount);
    warmthScore = warm === 'Y' ? 60 : 30; // Approximate for backward compat
  }

  outputRows.push({
    priority,
    firstName: (row[col['First Name']] || '').trim(),
    lastName: (row[col['Last Name']] || '').trim(),
    company: (row[col['Company']] || '').trim(),
    position: (row[col['Position']] || '').trim(),
    vertical,
    warm,
    warmthScore,
    msgCount,
    url,
    kenOverride: '',
  });
}

// Sort: Priority ASC (P0 first), then Warmth Score DESC, then Message Count DESC
const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
outputRows.sort((a, b) => {
  const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (pDiff !== 0) return pDiff;
  const wDiff = b.warmthScore - a.warmthScore;
  if (wDiff !== 0) return wDiff;
  return b.msgCount - a.msgCount;
});

// Write CSV (added Warmth Score column)
const outHeaders = ['Priority', 'First Name', 'Last Name', 'Company', 'Position', 'Vertical', 'Warm', 'Warmth Score', 'Message Count', 'URL', 'Ken_Override'];
const csvLines = [outHeaders.map(escapeCSV).join(',')];
for (const r of outputRows) {
  csvLines.push([
    r.priority,
    escapeCSV(r.firstName),
    escapeCSV(r.lastName),
    escapeCSV(r.company),
    escapeCSV(r.position),
    escapeCSV(r.vertical),
    r.warm,
    r.warmthScore,
    r.msgCount,
    r.url,
    '',
  ].join(','));
}

writeFileSync(outputPath, csvLines.join('\n') + '\n');

// Summary
const tierCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
for (const r of outputRows) {
  tierCounts[r.priority]++;
}

console.log('=== Review Queue Generated ===\n');
console.log(`Scoring mode: ${useComposite ? 'Composite Warmth (7 dimensions)' : 'Message Count Only (v0.2.0)'}`);
console.log(`Total contacts in queue: ${outputRows.length}`);
console.log();
console.log('Priority breakdown:');
if (useComposite) {
  console.log(`  P0 (Immediate — warmth ${P0_THRESHOLD}-100): ${tierCounts.P0}`);
  console.log(`  P1 (High — warmth ${P1_THRESHOLD}-${P0_THRESHOLD - 1}):       ${tierCounts.P1}`);
  console.log(`  P2 (Review — warmth ${P2_THRESHOLD}-${P1_THRESHOLD - 1}):      ${tierCounts.P2}`);
  console.log(`  P3 (Backlog — warmth 1-${P2_THRESHOLD - 1}):      ${tierCounts.P3}`);
} else {
  console.log(`  P0 (Immediate — Warm + ≥10 msgs):  ${tierCounts.P0}`);
  console.log(`  P1 (High — Warm + <10 msgs):        ${tierCounts.P1}`);
  console.log(`  P2 (Review — Maybe + ≥5 msgs):      ${tierCounts.P2}`);
  console.log(`  P3 (Backlog — Maybe + <5 msgs):      ${tierCounts.P3}`);
}
console.log();
console.log(`Output: ${outputPath}`);
console.log();
console.log('Next: Open in Excel/Sheets, fill Ken_Override column (Y/N/Skip), then run import.');
