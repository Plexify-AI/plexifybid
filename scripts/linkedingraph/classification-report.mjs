/**
 * Task 1: Post-Classification Report.
 * Reads ken_SOLO_tier1_CLASSIFIED.csv and generates a comprehensive report.
 *
 * Usage: node scripts/linkedingraph/classification-report.mjs
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

// Parse message count from Notes field
// Format: "8 msgs (2 sent, 6 received), last: Oct 2025"
function parseMessageCount(notes) {
  if (!notes || notes.trim() === '') return 0;
  const match = notes.match(/^(\d+)\s+msgs?\b/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Main ──
const inputPath = join(DATA_DIR, 'ken_SOLO_tier1_CLASSIFIED.csv');
const outputPath = join(DATA_DIR, 'linkedingraph_classification_report.txt');

const raw = readFileSync(inputPath, 'utf-8');
const parsed = parseCSV(raw);
const headers = parsed[0];
const dataRows = parsed.slice(1);

const col = {};
for (let i = 0; i < headers.length; i++) {
  col[headers[i]] = i;
}

const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };

log('╔══════════════════════════════════════════════════════════════╗');
log('║       LinkedInGraph Agent — Classification Report           ║');
log('║       PlexifyAEC BD Operating System                        ║');
log('╚══════════════════════════════════════════════════════════════╝');
log();
log(`Generated: ${new Date().toISOString().split('T')[0]}`);
log(`Source: ken_SOLO_tier1_CLASSIFIED.csv`);
log();

// ── Total contacts ──
log(`Total Tier 1 Contacts: ${dataRows.length}`);
log();

// ── Vertical distribution ──
log('── Vertical Distribution ──');
const verticalCounts = {};
for (const row of dataRows) {
  const v = (row[col['Vertical']] || '').trim() || '(untagged)';
  verticalCounts[v] = (verticalCounts[v] || 0) + 1;
}
const sortedVerts = Object.entries(verticalCounts).sort((a, b) => b[1] - a[1]);
const maxLabel = Math.max(...sortedVerts.map(([v]) => v.length));
for (const [vertical, count] of sortedVerts) {
  const pct = ((count / dataRows.length) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / dataRows.length * 40));
  log(`  ${vertical.padEnd(maxLabel + 2)} ${String(count).padStart(5)}  (${pct.padStart(5)}%)  ${bar}`);
}
log();

// ── Warm status breakdown per vertical ──
log('── Warm Status by Vertical ──');
const warmByVertical = {};
for (const row of dataRows) {
  const v = (row[col['Vertical']] || '').trim() || '(untagged)';
  const w = (row[col['Warm']] || '').trim() || '(none)';
  if (!warmByVertical[v]) warmByVertical[v] = {};
  warmByVertical[v][w] = (warmByVertical[v][w] || 0) + 1;
}

log(`  ${'Vertical'.padEnd(25)} ${'Y'.padStart(6)} ${'Maybe'.padStart(7)} ${'(none)'.padStart(8)} ${'Total'.padStart(7)}`);
log(`  ${'-'.repeat(25)} ${'-'.repeat(6)} ${'-'.repeat(7)} ${'-'.repeat(8)} ${'-'.repeat(7)}`);
for (const [vertical] of sortedVerts) {
  const counts = warmByVertical[vertical] || {};
  const y = counts['Y'] || 0;
  const maybe = counts['Maybe'] || 0;
  const none = counts['(none)'] || 0;
  const total = y + maybe + none;
  log(`  ${vertical.padEnd(25)} ${String(y).padStart(6)} ${String(maybe).padStart(7)} ${String(none).padStart(8)} ${String(total).padStart(7)}`);
}
log();

// ── Gold List (Warm=Y AND Vertical not empty) ──
log('── Gold List: Top 25 (Warm + Tagged) ──');
const goldList = dataRows
  .filter(row => {
    const warm = (row[col['Warm']] || '').trim();
    const vertical = (row[col['Vertical']] || '').trim();
    return warm === 'Y' && vertical !== '';
  })
  .map(row => ({
    name: `${(row[col['First Name']] || '').trim()} ${(row[col['Last Name']] || '').trim()}`,
    company: (row[col['Company']] || '').trim(),
    position: (row[col['Position']] || '').trim(),
    vertical: (row[col['Vertical']] || '').trim(),
    msgCount: parseMessageCount(row[col['Notes']]),
  }))
  .sort((a, b) => b.msgCount - a.msgCount);

log(`Total Gold List contacts: ${goldList.length}`);
log();
log(`  ${'#'.padStart(3)} ${'Name'.padEnd(28)} ${'Company'.padEnd(28)} ${'Vertical'.padEnd(20)} ${'Msgs'.padStart(5)}`);
log(`  ${'-'.repeat(3)} ${'-'.repeat(28)} ${'-'.repeat(28)} ${'-'.repeat(20)} ${'-'.repeat(5)}`);
for (let i = 0; i < Math.min(25, goldList.length); i++) {
  const g = goldList[i];
  log(`  ${String(i + 1).padStart(3)} ${g.name.substring(0, 27).padEnd(28)} ${g.company.substring(0, 27).padEnd(28)} ${g.vertical.padEnd(20)} ${String(g.msgCount).padStart(5)}`);
}
log();

// ── Coverage delta ──
log('── Coverage Delta ──');
const tagged = dataRows.filter(row => (row[col['Vertical']] || '').trim() !== '').length;
const untagged = dataRows.length - tagged;
log(`  Before LLM classification: 915 tagged (28.5%)`);
log(`  After LLM classification:  ${tagged} tagged (${((tagged / dataRows.length) * 100).toFixed(1)}%)`);
log(`  Improvement: +${tagged - 915} contacts classified`);
log(`  Remaining untagged: ${untagged}`);
log();

// ── Priority tier preview ──
log('── Priority Tier Preview ──');
const withWarm = dataRows.filter(row => {
  const warm = (row[col['Warm']] || '').trim();
  const vertical = (row[col['Vertical']] || '').trim();
  return (warm === 'Y' || warm === 'Maybe') && vertical !== '';
});
const p0 = withWarm.filter(row => {
  const warm = (row[col['Warm']] || '').trim();
  return warm === 'Y' && parseMessageCount(row[col['Notes']]) >= 10;
});
const p1 = withWarm.filter(row => {
  const warm = (row[col['Warm']] || '').trim();
  return warm === 'Y' && parseMessageCount(row[col['Notes']]) < 10;
});
const p2 = withWarm.filter(row => {
  const warm = (row[col['Warm']] || '').trim();
  return warm === 'Maybe' && parseMessageCount(row[col['Notes']]) >= 5;
});
const p3 = withWarm.filter(row => {
  const warm = (row[col['Warm']] || '').trim();
  return warm === 'Maybe' && parseMessageCount(row[col['Notes']]) < 5;
});
log(`  P0 (Immediate):  ${p0.length} contacts`);
log(`  P1 (High):       ${p1.length} contacts`);
log(`  P2 (Review):     ${p2.length} contacts`);
log(`  P3 (Backlog):    ${p3.length} contacts`);
log(`  Total in queue:  ${withWarm.length} contacts`);
log();

log('═'.repeat(62));

writeFileSync(outputPath, lines.join('\n') + '\n');
console.log(`\nReport saved to: ${outputPath}`);
