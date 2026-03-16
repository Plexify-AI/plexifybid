/**
 * Task 2: Generate prioritized review queue CSV for Ken's manual review.
 * Reads ken_SOLO_tier1_CLASSIFIED.csv, filters Warm+Tagged contacts,
 * assigns P0-P3 priority, writes ken_SOLO_review_queue.csv.
 *
 * Usage: node scripts/linkedingraph/generate-review-queue.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

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

const raw = readFileSync(inputPath, 'utf-8');
const parsed = parseCSV(raw);
const headers = parsed[0];
const dataRows = parsed.slice(1);

const col = {};
for (let i = 0; i < headers.length; i++) {
  col[headers[i]] = i;
}

// Filter: (Warm=Y or Warm=Maybe) AND Vertical not empty
const candidates = dataRows.filter(row => {
  const warm = (row[col['Warm']] || '').trim();
  const vertical = (row[col['Vertical']] || '').trim();
  return (warm === 'Y' || warm === 'Maybe') && vertical !== '';
});

// Build output rows with priority
const outputRows = candidates.map(row => {
  const warm = (row[col['Warm']] || '').trim();
  const msgCount = parseMessageCount(row[col['Notes']]);
  const priority = assignPriority(warm, msgCount);

  return {
    priority,
    firstName: (row[col['First Name']] || '').trim(),
    lastName: (row[col['Last Name']] || '').trim(),
    company: (row[col['Company']] || '').trim(),
    position: (row[col['Position']] || '').trim(),
    vertical: (row[col['Vertical']] || '').trim(),
    warm,
    msgCount,
    url: (row[col['URL']] || '').trim(),
    kenOverride: '',
  };
});

// Sort: Priority ASC (P0 first), then Message Count DESC
const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
outputRows.sort((a, b) => {
  const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (pDiff !== 0) return pDiff;
  return b.msgCount - a.msgCount;
});

// Write CSV
const outHeaders = ['Priority', 'First Name', 'Last Name', 'Company', 'Position', 'Vertical', 'Warm', 'Message Count', 'URL', 'Ken_Override'];
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
console.log(`Total contacts in queue: ${outputRows.length}`);
console.log();
console.log('Priority breakdown:');
console.log(`  P0 (Immediate — Warm + ≥10 msgs):  ${tierCounts.P0}`);
console.log(`  P1 (High — Warm + <10 msgs):        ${tierCounts.P1}`);
console.log(`  P2 (Review — Maybe + ≥5 msgs):      ${tierCounts.P2}`);
console.log(`  P3 (Backlog — Maybe + <5 msgs):      ${tierCounts.P3}`);
console.log();
console.log(`Output: ${outputPath}`);
console.log();
console.log('Next: Open in Excel/Sheets, fill Ken_Override column (Y/N/Skip), then run import.');
