/**
 * Step 0c: Merge LLM classifications back into the full CSV.
 * Reads ken_SOLO_tier1_FINAL.csv + linkedingraph_llm_results.json,
 * writes ken_SOLO_tier1_CLASSIFIED.csv (original FINAL is never modified).
 *
 * Usage: node scripts/linkedingraph/merge-classifications.mjs
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

function rowsToCSV(headers, rows) {
  const escape = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n') + '\n';
}

// ── Main ──
const inputPath = join(DATA_DIR, 'ken_SOLO_tier1_FINAL.csv');
const resultsPath = join(DATA_DIR, 'linkedingraph_llm_results.json');
const outputPath = join(DATA_DIR, 'ken_SOLO_tier1_CLASSIFIED.csv');

const raw = readFileSync(inputPath, 'utf-8');
const parsed = parseCSV(raw);
const headers = parsed[0];
const dataRows = parsed.slice(1);

const classifications = JSON.parse(readFileSync(resultsPath, 'utf-8'));

// Build lookup: company name (lowercase, trimmed) → vertical
const lookup = new Map();
for (const c of classifications) {
  const key = (c.company || '').trim().toLowerCase();
  if (key && c.vertical && c.vertical !== 'Unknown') {
    lookup.set(key, c.vertical);
  }
}

const companyIdx = headers.indexOf('Company');
const verticalIdx = headers.indexOf('Vertical');

let updated = 0;
let unknowns = 0;
let unmatched = 0;
const unknownFromLLM = classifications.filter(c => c.vertical === 'Unknown').length;

for (const row of dataRows) {
  const currentVertical = (row[verticalIdx] || '').trim();
  if (currentVertical !== '') continue; // Don't overwrite existing tags

  const company = (row[companyIdx] || '').trim().toLowerCase();
  const llmVertical = lookup.get(company);

  if (llmVertical) {
    row[verticalIdx] = llmVertical;
    updated++;
  }
  // If not found in lookup, leave empty (either LLM said Unknown or company didn't match)
}

// Count remaining empty verticals
const stillEmpty = dataRows.filter(row => (row[verticalIdx] || '').trim() === '').length;

writeFileSync(outputPath, rowsToCSV(headers, dataRows));

// Compute new vertical distribution
const verticalCounts = {};
for (const row of dataRows) {
  const v = (row[verticalIdx] || '').trim() || '(empty)';
  verticalCounts[v] = (verticalCounts[v] || 0) + 1;
}

console.log('=== Merge Report ===\n');
console.log(`Rows matched and updated: ${updated}`);
console.log(`LLM returned "Unknown": ${unknownFromLLM} (left empty in CSV)`);
console.log(`Still untagged after merge: ${stillEmpty}`);
console.log(`\nNew vertical distribution:`);
const sorted = Object.entries(verticalCounts).sort((a, b) => b[1] - a[1]);
for (const [vertical, count] of sorted) {
  const pct = ((count / dataRows.length) * 100).toFixed(1);
  console.log(`  ${vertical}: ${count} (${pct}%)`);
}
console.log(`\nTotal rows: ${dataRows.length}`);
console.log(`Output: ${outputPath}`);
console.log(`\nOriginal file NOT modified: ${inputPath}`);
