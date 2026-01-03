import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fs from 'fs/promises';
import { loadSelectedDocuments } from './pdfService';
import {
  type BoardBriefEnvelope,
  type AssessmentTrendsEnvelope,
  type OZRFSectionEnvelope,
  type NotebookBDAgentId,
  type StructuredOutputSourceRef,
  type StructuredCitation,
} from '../types/structuredOutputs';

type AgentsApiRequestBody = {
  projectId?: string;
  documentIds?: string[];
  sourceIds?: string[];
  instructions?: string;
};

const DEMO_SOURCES: Array<{
  id: string;
  label: string;
  filename: string;
}> = [
  {
    id: 'gt-annual-2024',
    label: 'Golden Triangle BID Annual Report 2024',
    filename: 'Golden_Triangle_BID_Annual_Report_2024.txt',
  },
  {
    id: 'q3-assessment-collections',
    label: 'Q3 Assessment Collection Summary',
    filename: 'Q3_Assessment_Collection_Summary.txt',
  },
  {
    id: 'board-minutes-oct-2024',
    label: 'Board Meeting Minutes (Oct 2024)',
    filename: 'Board_Meeting_Minutes_October_2024.txt',
  },
];

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function getAnthropicApiKeyInfo():
  | {
      key: string;
      source: 'VITE_ANTHROPIC_API_KEY' | 'ANTHROPIC_API_KEY' | 'ANTHROPIC_APIKEY';
      startsWithSkAnt: boolean;
      length: number;
    }
  | undefined {
  const sources: Array<{
    source: 'VITE_ANTHROPIC_API_KEY' | 'ANTHROPIC_API_KEY' | 'ANTHROPIC_APIKEY';
    value?: string;
  }> = [
    { source: 'VITE_ANTHROPIC_API_KEY', value: process.env.VITE_ANTHROPIC_API_KEY },
    { source: 'ANTHROPIC_API_KEY', value: process.env.ANTHROPIC_API_KEY },
    { source: 'ANTHROPIC_APIKEY', value: process.env.ANTHROPIC_APIKEY },
  ];

  for (const { source, value } of sources) {
    if (!value) continue;
    const key = value.trim().replace(/^['"]|['"]$/g, '');
    return {
      key,
      source,
      startsWithSkAnt: key.startsWith('sk-ant-'),
      length: key.length,
    };
  }

  return undefined;
}

function getAnthropicApiKey() {
  return getAnthropicApiKeyInfo()?.key;
}

function getAnthropicModelCandidates() {
  const raw =
    process.env.VITE_ANTHROPIC_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    process.env.ANTHROPIC_MODEL_ID;

  const preferred = raw?.trim() ? raw.trim().replace(/^['"]|['"]$/g, '') : undefined;

  // Try preferred first (if provided), then fall back through commonly-available models.
  // (Different Anthropic accounts have different model access.)
  const candidates = [
    preferred,
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ].filter(Boolean) as string[];

  // De-dupe preserving order.
  return [...new Set(candidates)];
}

async function anthropicMessagesCreate(opts: {
  apiKey: string;
  models: string[];
  maxTokens: number;
  temperature: number;
  prompt: string;
}) {
  const { apiKey, models, maxTokens, temperature, prompt } = opts;

  const [model, ...rest] = models;
  if (!model) {
    throw new Error('No Anthropic model available to try');
  }

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

    if (response.status === 401) {
      const info = getAnthropicApiKeyInfo();
      const err: any = new Error(
        `Anthropic authentication failed (invalid x-api-key). ` +
          `Loaded key from ${info?.source ?? 'unknown'} (length=${info?.length ?? 0}, startsWithSkAnt=${info?.startsWithSkAnt ?? false}). ` +
          `Verify .env.local contains a valid sk-ant-* key and restart the dev server.`
      );
      err.statusCode = 401;
      throw err;
    }

    // If the model isn't available to the account, try the next fallback.
    if (response.status === 404 && text.includes('model') && rest.length > 0) {
      return anthropicMessagesCreate({
        apiKey,
        models: rest,
        maxTokens,
        temperature,
        prompt,
      });
    }

    throw new Error(`Anthropic error ${response.status}: ${text}`);
  }

  return response;
}

async function listAvailablePdfs(districtSlug: string) {
  try {
    const dir = path.resolve(process.cwd(), 'public', 'real-docs', districtSlug);
    const entries = await fs.readdir(dir);
    return entries.filter((e) => e.toLowerCase().endsWith('.pdf')).slice(0, 25);
  } catch {
    return [];
  }
}

async function loadSelectedSourceTexts(sourceIds?: string[]) {
  const selected =
    sourceIds && sourceIds.length > 0
      ? DEMO_SOURCES.filter((s) => sourceIds.includes(s.id))
      : DEMO_SOURCES;

  const docsDir = path.resolve(process.cwd(), 'public', 'demo-data');
  const docs = await Promise.all(
    selected.map(async (s) => {
      const fullPath = path.join(docsDir, s.filename);
      const text = await fs.readFile(fullPath, 'utf-8');
      return { ...s, text };
    })
  );

  return docs;
}

async function loadSelectedSourcesForRequest(body: AgentsApiRequestBody) {
  const districtSlug = body.projectId ?? 'golden-triangle';

  if (body.documentIds) {
    if (body.documentIds.length === 0) {
      const err = new Error(
        'No documents selected. Please select at least one document from the Sources panel.'
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const { documents, missing } = await loadSelectedDocuments(
      districtSlug,
      body.documentIds
    );

    if (documents.length === 0) {
      const details = missing.length
        ? ` Missing: ${missing.map((m) => `${m.displayName} (${m.filename})`).join(', ')}`
        : '';

      const available = await listAvailablePdfs(districtSlug);
      const availableText = available.length
        ? ` Available PDFs: ${available.join(', ')}`
        : ' No PDFs found in the district folder.';

      const err = new Error(
        `Could not load selected PDFs. Verify the filenames in index.json match files in public/real-docs/${districtSlug}/.${details}${availableText}`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    // Proceed with what we could load; missing files will be silently ignored.
    return documents.map((d) => ({ id: d.id, label: d.displayName, text: d.text }));
  }

  // Backwards compatible: demo-data sources.
  return loadSelectedSourceTexts(body.sourceIds);
}

async function generateBoardBriefWithClaude({
  projectId,
  sources,
  instructions,
}: {
  projectId: string;
  sources: Array<{ id: string; label: string; text: string }>;
  instructions?: string;
}): Promise<BoardBriefEnvelope> {
  const apiKey = getAnthropicApiKey();

  const sourcesUsed: StructuredOutputSourceRef[] = sources.map((s) => ({
    id: s.id,
    label: s.label,
  }));

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
    .map((s, idx) => {
      const trimmed = s.text.trim();
      const snippet = trimmed.length > 2500 ? `${trimmed.slice(0, 2500)}\n…` : trimmed;
      return `[Source ${idx + 1}] ${s.label}\n${snippet}`;
    })
    .join('\n\n');

  const schema = {
    agentId: 'board-brief',
    schemaVersion: '1.0',
    generatedAt: 'ISO_TIMESTAMP',
    projectId: projectId,
    sourcesUsed: [{ id: 'string', label: 'string' }],
    output: {
      title: 'string',
      districtName: 'string',
      reportingPeriod: 'string',
      executiveSummary: ['string'],
      keyMetrics: [{ label: 'string', value: 'string' }],
      highlights: ['string'],
      risks: ['string'],
      recommendations: ['string'],
    },
  };

  const prompt = `You are a BID operations analyst. Create a concise Board Brief using ONLY the provided sources.\n\n${context}\n\nInstructions (optional): ${instructions ?? 'None'}\n\nReturn ONLY valid JSON (no markdown) matching this schema exactly:\n${JSON.stringify(schema, null, 2)}\n\nNotes:\n- Use short bullets.\n- Use exact figures from sources where available.\n- If a field cannot be supported by sources, use an empty array for that field.`;

  const response = await anthropicMessagesCreate({
    apiKey,
    models: getAnthropicModelCandidates(),
    maxTokens: 1200,
    temperature: 0.2,
    prompt,
  });

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? '';
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Failed to parse structured JSON from model output');
  }

  return parsed as BoardBriefEnvelope;
}

async function generateAssessmentTrendsWithClaude({
  projectId,
  sources,
  instructions,
}: {
  projectId: string;
  sources: Array<{ id: string; label: string; text: string }>;
  instructions?: string;
}): Promise<AssessmentTrendsEnvelope> {
  const apiKey = getAnthropicApiKey();

  const sourcesUsed: StructuredOutputSourceRef[] = sources.map((s) => ({
    id: s.id,
    label: s.label,
  }));

  const today = new Date().toISOString().slice(0, 10);

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    const demoCitation: StructuredCitation = {
      number: 1,
      sourceId: sourcesUsed[0]?.id ?? 'q3-assessment-collections',
      sourceName: sourcesUsed[0]?.label ?? 'Q3 Assessment Collection Summary',
      quote: 'Demo citation (API key not configured).',
    };

    return {
      agentId: 'assessment-trends',
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      projectId,
      sourcesUsed,
      output: {
        title: 'Assessment Trends Analysis (Demo)',
        metadata: {
          period: 'Q3 2024',
          preparedDate: today,
        },
        sections: {
          collectionSummary: {
            rows: [
              {
                propertyType: 'Commercial',
                billed: '$1.2M',
                collected: '$1.15M',
                rate: '96%',
                citation: demoCitation,
              },
              {
                propertyType: 'Retail',
                billed: '$800K',
                collected: '$728K',
                rate: '91%',
                citation: demoCitation,
              },
              {
                propertyType: 'Residential',
                billed: '$440K',
                collected: '$387K',
                rate: '88%',
                citation: demoCitation,
              },
            ],
            total: {
              billed: '$2.44M',
              collected: '$2.27M',
              rate: '93%',
              citation: demoCitation,
            },
          },
          delinquencyAging: [
            { bucket: '30 days', amount: '$45,000', propertyCount: 12, citation: demoCitation },
            { bucket: '60 days', amount: '$23,000', propertyCount: 5, citation: demoCitation },
            { bucket: '90+ days', amount: '$12,000', propertyCount: 3, citation: demoCitation },
          ],
          topDelinquent: [
            { address: '123 Main St', amount: '$8,500', daysOverdue: 120, citation: demoCitation },
            { address: '456 Oak Ave', amount: '$4,200', daysOverdue: 95, citation: demoCitation },
            { address: '789 Pine Rd', amount: '$3,800', daysOverdue: 90, citation: demoCitation },
          ],
          recommendations: [
            { content: 'Increase follow-up cadence for 60+ day accounts.' },
            { content: 'Add weekly delinquency aging snapshot to board reporting.' },
          ],
        },
      },
    };
  }

  const context = sources
    .map((s, idx) => {
      const trimmed = s.text.trim();
      const snippet = trimmed.length > 3000 ? `${trimmed.slice(0, 3000)}\n…` : trimmed;
      return `[Source ${idx + 1}] ${s.label}\n${snippet}`;
    })
    .join('\n\n');

  const schema = {
    agentId: 'assessment-trends',
    schemaVersion: '1.0',
    generatedAt: 'ISO_TIMESTAMP',
    projectId: projectId,
    sourcesUsed: [{ id: 'string', label: 'string' }],
    output: {
      title: 'string',
      metadata: {
        period: 'string',
        preparedDate: 'YYYY-MM-DD',
      },
      sections: {
        collectionSummary: {
          rows: [
            {
              propertyType: 'string',
              billed: 'string',
              collected: 'string',
              rate: 'string',
              citation: {
                number: 1,
                sourceId: 'string',
                sourceName: 'string',
                quote: 'string',
              },
            },
          ],
          total: {
            billed: 'string',
            collected: 'string',
            rate: 'string',
            citation: {
              number: 1,
              sourceId: 'string',
              sourceName: 'string',
              quote: 'string',
            },
          },
        },
        delinquencyAging: [
          {
            bucket: 'string',
            amount: 'string',
            propertyCount: 0,
            citation: {
              number: 1,
              sourceId: 'string',
              sourceName: 'string',
              quote: 'string',
            },
          },
        ],
        topDelinquent: [
          {
            address: 'string',
            amount: 'string',
            daysOverdue: 0,
            citation: {
              number: 1,
              sourceId: 'string',
              sourceName: 'string',
              quote: 'string',
            },
          },
        ],
        recommendations: [{ content: 'string' }],
      },
    },
  };

  const prompt = `You are a BID finance analyst. Extract assessment collection trends using ONLY the provided sources.\n\n${context}\n\nInstructions (optional): ${instructions ?? 'None'}\n\nReturn ONLY valid JSON (no markdown) matching this schema exactly:\n${JSON.stringify(schema, null, 2)}\n\nNotes:\n- Fill the collection summary table with the best available breakdown from sources.\n- Provide delinquency aging buckets and top delinquents if available; otherwise use empty arrays.\n- Each numeric/table claim should include a citation when possible.`;

  const response = await anthropicMessagesCreate({
    apiKey,
    models: getAnthropicModelCandidates(),
    maxTokens: 1600,
    temperature: 0.2,
    prompt,
  });

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? '';
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Failed to parse structured JSON from model output');
  }

  return parsed as AssessmentTrendsEnvelope;
}

async function generateOZRFSectionWithClaude({
  projectId,
  sources,
  instructions,
}: {
  projectId: string;
  sources: Array<{ id: string; label: string; text: string }>;
  instructions?: string;
}): Promise<OZRFSectionEnvelope> {
  const apiKey = getAnthropicApiKey();

  const sourcesUsed: StructuredOutputSourceRef[] = sources.map((s) => ({
    id: s.id,
    label: s.label,
  }));

  const today = new Date().toISOString().slice(0, 10);

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    const demoCitation: StructuredCitation = {
      number: 1,
      sourceId: sourcesUsed[0]?.id ?? 'gt-annual-2024',
      sourceName: sourcesUsed[0]?.label ?? 'Golden Triangle BID Annual Report 2024',
      quote: 'Demo citation (API key not configured).',
    };

    return {
      agentId: 'ozrf-section',
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      projectId,
      sourcesUsed,
      output: {
        title: 'OZRF Compliance Section (Demo)',
        metadata: {
          reportingPeriod: 'Q3 2024',
          preparedDate: today,
        },
        sections: {
          communityImpact: {
            jobsCreated: { value: 45, citation: demoCitation },
            jobsRetained: { value: 120, citation: demoCitation },
            localHiringRate: { value: '78%', citation: demoCitation },
          },
          investmentFacilitation: {
            totalInvestment: { value: '$12.5M', citation: demoCitation },
            qofInvestments: { value: 3, citation: demoCitation },
            businessRelocations: { value: 2, citation: demoCitation },
          },
          environmentalSocial: [
            { metric: 'Brownfield Remediation', value: '2 acres', citation: demoCitation },
            { metric: 'Affordable Housing Units', value: '15 planned', citation: demoCitation },
            { metric: 'Community Programs', value: '4 active initiatives', citation: demoCitation },
          ],
          disclosureStatement:
            'This section prepared in accordance with OZRF guidelines. Data sourced from district records and verified against original documentation.',
        },
      },
    };
  }

  const context = sources
    .map((s, idx) => {
      const trimmed = s.text.trim();
      const snippet = trimmed.length > 3000 ? `${trimmed.slice(0, 3000)}\n…` : trimmed;
      return `[Source ${idx + 1}] ${s.label}\n${snippet}`;
    })
    .join('\n\n');

  const schema = {
    agentId: 'ozrf-section',
    schemaVersion: '1.0',
    generatedAt: 'ISO_TIMESTAMP',
    projectId: projectId,
    sourcesUsed: [{ id: 'string', label: 'string' }],
    output: {
      title: 'string',
      metadata: {
        reportingPeriod: 'string',
        preparedDate: 'YYYY-MM-DD',
      },
      sections: {
        communityImpact: {
          jobsCreated: {
            value: 0,
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
          jobsRetained: {
            value: 0,
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
          localHiringRate: {
            value: 'string',
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
        },
        investmentFacilitation: {
          totalInvestment: {
            value: 'string',
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
          qofInvestments: {
            value: 0,
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
          businessRelocations: {
            value: 0,
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
        },
        environmentalSocial: [
          {
            metric: 'string',
            value: 'string',
            citation: { number: 1, sourceId: 'string', sourceName: 'string', quote: 'string' },
          },
        ],
        disclosureStatement: 'string',
      },
    },
  };

  const prompt = `You are an OZ reporting compliance analyst. Draft an OZRF compliance section using ONLY the provided sources.\n\n${context}\n\nInstructions (optional): ${instructions ?? 'None'}\n\nReturn ONLY valid JSON (no markdown) matching this schema exactly:\n${JSON.stringify(schema, null, 2)}\n\nNotes:\n- Only include metrics that can be supported by sources; otherwise use conservative placeholders with empty citations omitted.\n- Keep disclosureStatement short and compliance-oriented.`;

  const response = await anthropicMessagesCreate({
    apiKey,
    models: getAnthropicModelCandidates(),
    maxTokens: 1600,
    temperature: 0.2,
    prompt,
  });

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? '';
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Failed to parse structured JSON from model output');
  }

  return parsed as OZRFSectionEnvelope;
}

async function handleAgentRequest({
  agentId,
  projectId,
  sources,
  instructions,
}: {
  agentId: NotebookBDAgentId;
  projectId: string;
  sources: Array<{ id: string; label: string; text: string }>;
  instructions?: string;
}) {
  if (agentId === 'board-brief') {
    return generateBoardBriefWithClaude({
      projectId,
      sources,
      instructions,
    });
  }

  if (agentId === 'assessment-trends') {
    return generateAssessmentTrendsWithClaude({
      projectId,
      sources,
      instructions,
    });
  }

  if (agentId === 'ozrf-section') {
    return generateOZRFSectionWithClaude({
      projectId,
      sources,
      instructions,
    });
  }

  throw new Error(`Unhandled agentId: ${agentId}`);
}

export function notebookBDAgentsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    try {
      const url = req.url || '';
      if (!url.startsWith('/api/agents/')) return next();

      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }

      const agentId = decodeURIComponent(url.replace('/api/agents/', '').split('?')[0]);
      if (!['board-brief', 'assessment-trends', 'ozrf-section'].includes(agentId)) {
        return sendJson(res, 404, { error: 'Unknown agent' });
      }

      const body = await readJson<AgentsApiRequestBody>(req);

      const sources = await loadSelectedSourcesForRequest(body);

      const result = await handleAgentRequest({
        agentId: agentId as NotebookBDAgentId,
        projectId: body.projectId ?? 'golden-triangle',
        sources,
        instructions: body.instructions,
      });
      return sendJson(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = (err as any)?.statusCode;
      return sendJson(res, typeof statusCode === 'number' ? statusCode : 500, { error: message });
    }
  };
}
