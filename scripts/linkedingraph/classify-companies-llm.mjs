/**
 * Step 0b: LLM Batch Classification using Claude Haiku.
 * Reads linkedingraph_untagged.csv, classifies companies into AEC verticals
 * in batches of 50, saves results to linkedingraph_llm_results.json.
 *
 * Resume-safe: tracks progress in linkedingraph_llm_progress.json.
 *
 * Usage: node scripts/linkedingraph/classify-companies-llm.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');

// Load env
dotenv.config({ path: join(ROOT, '.env.local') });

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in .env.local');
  process.exit(1);
}

const client = new Anthropic({ apiKey: API_KEY });

const BATCH_SIZE = 50;
const MODEL = 'claude-haiku-4-5-20251001';
const INPUT_FILE = join(DATA_DIR, 'linkedingraph_untagged.csv');
const PROGRESS_FILE = join(DATA_DIR, 'linkedingraph_llm_progress.json');
const RESULTS_FILE = join(DATA_DIR, 'linkedingraph_llm_results.json');

const SYSTEM_PROMPT = `You are an AEC industry classifier. Given a list of companies with their employee's position title, classify each into exactly one AEC vertical. If a company clearly spans two verticals, use pipe notation (e.g., "GC | Developer").

Verticals:
- GC (General Contractor): Construction companies, builders, CM firms
- AEC Tech: Software, technology, SaaS for construction/architecture/engineering
- Developer: Real estate developers, property owners, investors, REITs
- MEP/Engineering: Mechanical, electrical, plumbing, structural, civil engineering firms
- BID/EcoDev: Business Improvement Districts, economic development, chambers of commerce, government agencies
- Architecture/Design: Architecture firms, interior design, landscape architecture
- Unknown: Cannot determine from company name and position alone`;

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

// ── Retry with exponential backoff ──
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function classifyBatch(companies, retryCount = 0) {
  const userMsg = `Classify these companies. Return ONLY a JSON array of objects with "company" and "vertical" keys. No explanation.\n\n${JSON.stringify(companies)}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });

    const text = response.content[0].text.trim();
    // Extract JSON array from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const result = JSON.parse(jsonStr);
    if (!Array.isArray(result)) throw new Error('Response is not an array');
    return { success: true, data: result, usage: response.usage };
  } catch (err) {
    if (retryCount < 3) {
      const backoff = Math.min(1000 * Math.pow(2, retryCount), 30000);
      const reason = err.status === 429 ? 'rate limit' : err.message?.substring(0, 60);
      console.log(`  Retry ${retryCount + 1}/3 (${reason}), waiting ${backoff}ms...`);
      await sleep(backoff);
      return classifyBatch(companies, retryCount + 1);
    }
    return { success: false, error: err.message };
  }
}

// ── Main ──
async function main() {
  console.log('=== LLM Batch Classification ===\n');

  const raw = readFileSync(INPUT_FILE, 'utf-8');
  const parsed = parseCSV(raw);
  const headers = parsed[0];
  const dataRows = parsed.slice(1);

  const companyIdx = headers.indexOf('Company');
  const positionIdx = headers.indexOf('Position');
  if (companyIdx === -1 || positionIdx === -1) {
    console.error('ERROR: Company or Position column not found');
    process.exit(1);
  }

  // Build company list for classification
  const companies = dataRows.map(row => ({
    company: (row[companyIdx] || '').trim(),
    position: (row[positionIdx] || '').trim(),
  }));

  const totalBatches = Math.ceil(companies.length / BATCH_SIZE);
  console.log(`Total companies: ${companies.length}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Total batches: ${totalBatches}\n`);

  // Load progress if exists
  let progress = { completed_batches: 0, total_batches: totalBatches, classifications: [] };
  if (existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
      console.log(`Resuming from batch ${progress.completed_batches + 1}/${totalBatches}\n`);
    } catch {
      console.log('Progress file corrupted, starting fresh\n');
    }
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let batchNum = progress.completed_batches; batchNum < totalBatches; batchNum++) {
    const start = batchNum * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, companies.length);
    const batch = companies.slice(start, end);

    const result = await classifyBatch(batch);

    if (result.success) {
      progress.classifications.push(...result.data);
      progress.completed_batches = batchNum + 1;

      if (result.usage) {
        totalInputTokens += result.usage.input_tokens;
        totalOutputTokens += result.usage.output_tokens;
      }

      // Save progress after each batch
      writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

      console.log(`Batch ${batchNum + 1}/${totalBatches} complete — ${progress.classifications.length} classified so far`);
    } else {
      console.error(`Batch ${batchNum + 1}/${totalBatches} FAILED: ${result.error}`);
      console.log('Skipping batch, will leave those companies unclassified');
      progress.completed_batches = batchNum + 1;
      writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    }

    // Small delay between batches to avoid rate limits
    if (batchNum < totalBatches - 1) {
      await sleep(500);
    }
  }

  // Save final results
  writeFileSync(RESULTS_FILE, JSON.stringify(progress.classifications, null, 2));

  // Print summary
  const verticalCounts = {};
  for (const c of progress.classifications) {
    const v = c.vertical || 'Unknown';
    verticalCounts[v] = (verticalCounts[v] || 0) + 1;
  }

  console.log('\n=== Classification Summary ===');
  console.log(`Total classified: ${progress.classifications.length}`);
  console.log(`\nVertical distribution:`);
  const sorted = Object.entries(verticalCounts).sort((a, b) => b[1] - a[1]);
  for (const [vertical, count] of sorted) {
    console.log(`  ${vertical}: ${count}`);
  }
  console.log(`\nToken usage: ${totalInputTokens} input + ${totalOutputTokens} output`);
  const estimatedCost = (totalInputTokens * 0.25 / 1_000_000) + (totalOutputTokens * 1.25 / 1_000_000);
  console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);
  console.log(`\nResults saved to: ${RESULTS_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
