/**
 * PlexifySOLO — Board Report Agents (production route)
 *
 * POST /api/agents/:agentId
 * Handles: board-brief, assessment-trends, ozrf-section
 *
 * Reads demo source documents from public/demo-data/ and generates
 * structured output via Anthropic Claude API.
 *
 * In Vite dev mode, this is handled by src/server/agentsApi.ts middleware.
 * This file is the production equivalent for server/index.mjs.
 */

import { resolve } from 'path';
import { readFile, readdir } from 'fs/promises';

// ---------------------------------------------------------------------------
// Demo sources
// ---------------------------------------------------------------------------

const DEMO_SOURCES = [
  { id: 'gt-annual-2024', label: 'Golden Triangle BID Annual Report 2024', filename: 'Golden_Triangle_BID_Annual_Report_2024.txt' },
  { id: 'q3-assessment-collections', label: 'Q3 Assessment Collection Summary', filename: 'Q3_Assessment_Collection_Summary.txt' },
  { id: 'board-minutes-oct-2024', label: 'Board Meeting Minutes (Oct 2024)', filename: 'Board_Meeting_Minutes_October_2024.txt' },
];

const VALID_AGENTS = ['board-brief', 'assessment-trends', 'ozrf-section'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAnthropicApiKey() {
  const raw = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  return raw?.trim() || null;
}

function getModelCandidates() {
  return [
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
  ];
}

async function callAnthropic({ apiKey, models, maxTokens, temperature, prompt }) {
  const [model, ...rest] = models;
  if (!model) throw new Error('No Anthropic model available');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 && text.includes('model') && rest.length > 0) {
      return callAnthropic({ apiKey, models: rest, maxTokens, temperature, prompt });
    }
    throw new Error(`Anthropic error ${response.status}: ${text}`);
  }

  return response;
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { return null; }
}

async function loadDemoSources(sourceIds) {
  const selected = sourceIds?.length
    ? DEMO_SOURCES.filter(s => sourceIds.includes(s.id))
    : DEMO_SOURCES;

  const docsDir = resolve(process.cwd(), 'dist', 'demo-data');
  // Fallback to public/ if dist/ doesn't have it
  const docsDir2 = resolve(process.cwd(), 'public', 'demo-data');

  const docs = await Promise.all(
    selected.map(async (s) => {
      let text;
      try {
        text = await readFile(resolve(docsDir, s.filename), 'utf-8');
      } catch {
        text = await readFile(resolve(docsDir2, s.filename), 'utf-8');
      }
      return { ...s, text };
    })
  );

  return docs;
}

// ---------------------------------------------------------------------------
// Board Brief generator
// ---------------------------------------------------------------------------

async function generateBoardBrief({ projectId, sources, instructions }) {
  const apiKey = getAnthropicApiKey();
  const sourcesUsed = sources.map(s => ({ id: s.id, label: s.label }));

  // Demo fallback if no valid API key
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return {
      agentId: 'board-brief',
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      projectId,
      sourcesUsed,
      output: {
        title: 'Board Brief (Demo)',
        districtName: 'Golden Triangle BID',
        reportingPeriod: 'FY 2024',
        executiveSummary: [
          'Assessment collections remained strong and supported core programs.',
          'Priority initiatives include streetscape maintenance, safety coordination, and wayfinding planning.',
        ],
        keyMetrics: [
          { label: 'Assessments billed', value: '$2.44M' },
          { label: 'Assessments collected', value: '$2.30M' },
          { label: 'Collection rate', value: '94.2%' },
        ],
        highlights: [
          'Continued streetscape improvements (sidewalk repairs, tree wells, litter abatement).',
          'Wayfinding signage program planning advanced.',
        ],
        risks: ['Delinquency follow-up may impact cashflow if not improved.'],
        recommendations: [
          'Increase delinquency follow-up cadence and board-level reporting.',
          'Finalize wayfinding signage timeline and procurement plan.',
        ],
      },
    };
  }

  const context = sources
    .map((s, i) => {
      const trimmed = s.text.trim();
      const snippet = trimmed.length > 2500 ? `${trimmed.slice(0, 2500)}\n…` : trimmed;
      return `[Source ${i + 1}] ${s.label}\n${snippet}`;
    })
    .join('\n\n');

  const schema = {
    agentId: 'board-brief', schemaVersion: '1.0', generatedAt: 'ISO_TIMESTAMP', projectId,
    sourcesUsed: [{ id: 'string', label: 'string' }],
    output: {
      title: 'string', districtName: 'string', reportingPeriod: 'string',
      executiveSummary: ['string'], keyMetrics: [{ label: 'string', value: 'string' }],
      highlights: ['string'], risks: ['string'], recommendations: ['string'],
    },
  };

  const prompt = `You are a BID operations analyst. Create a concise Board Brief using ONLY the provided sources.\n\n${context}\n\nInstructions (optional): ${instructions ?? 'None'}\n\nReturn ONLY valid JSON (no markdown) matching this schema exactly:\n${JSON.stringify(schema, null, 2)}\n\nNotes:\n- Use short bullets.\n- Use exact figures from sources where available.\n- If a field cannot be supported by sources, use an empty array for that field.`;

  const response = await callAnthropic({
    apiKey,
    models: getModelCandidates(),
    maxTokens: 1200,
    temperature: 0.2,
    prompt,
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';
  const parsed = extractJsonObject(text);
  if (!parsed) throw new Error('Failed to parse structured JSON from model output');
  return parsed;
}

// ---------------------------------------------------------------------------
// Express handler
// ---------------------------------------------------------------------------

export async function handleAgentRequest(req, res) {
  try {
    const agentId = req.params.agentId;

    if (!VALID_AGENTS.includes(agentId)) {
      return res.status(404).json({ error: `Unknown agent: ${agentId}` });
    }

    const { projectId, documentIds, sourceIds, instructions } = req.body || {};
    const sources = await loadDemoSources(sourceIds || documentIds);

    let result;
    if (agentId === 'board-brief') {
      result = await generateBoardBrief({
        projectId: projectId || 'golden-triangle',
        sources,
        instructions,
      });
    } else {
      // For assessment-trends and ozrf-section, return demo data for now
      // (full Claude generation can be ported later if needed)
      result = {
        agentId,
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        projectId: projectId || 'golden-triangle',
        sourcesUsed: sources.map(s => ({ id: s.id, label: s.label })),
        output: { title: `${agentId} (Demo)`, note: 'Demo output — full generation coming soon.' },
      };
    }

    return res.json(result);
  } catch (err) {
    console.error('[agents] Error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
}
