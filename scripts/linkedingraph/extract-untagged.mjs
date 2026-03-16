/**
 * Step 0a: Extract untagged Tier 1 companies for LLM classification.
 * Reads ken_SOLO_tier1_FINAL.csv, filters rows where Vertical is empty,
 * writes to linkedingraph_untagged.csv.
 *
 * Usage: node scripts/linkedingraph/extract-untagged.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

// ── CSV parser (handles quoted fields with commas) ──
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len || text[i] === '\n' || text[i] === '\r') return '';
    if (text[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      return field;
    } else {
      // Unquoted field
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
      if (i < len && text[i] === ',') {
        i++; // skip comma
        continue;
      }
      break;
    }
    // Skip line ending
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
const outputPath = join(DATA_DIR, 'linkedingraph_untagged.csv');

const raw = readFileSync(inputPath, 'utf-8');
const parsed = parseCSV(raw);
const headers = parsed[0];
const dataRows = parsed.slice(1);

// Find Vertical column index
const verticalIdx = headers.indexOf('Vertical');
if (verticalIdx === -1) {
  console.error('ERROR: "Vertical" column not found. Headers:', headers);
  process.exit(1);
}

// Filter untagged rows (Vertical is empty string)
const untagged = dataRows.filter(row => (row[verticalIdx] || '').trim() === '');

console.log(`Total rows: ${dataRows.length}`);
console.log(`Tagged rows: ${dataRows.length - untagged.length}`);
console.log(`Untagged rows: ${untagged.length}`);

writeFileSync(outputPath, rowsToCSV(headers, untagged));
console.log(`\nExtracted ${untagged.length} untagged companies for LLM classification`);
console.log(`Output: ${outputPath}`);
