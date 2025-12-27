import { v4 as uuidv4 } from 'uuid';
import type { Citation, Message, SourceMaterial } from 'plexify-shared-ui';

export interface NotebookBDSourceDoc {
  material: SourceMaterial;
  text: string;
}

const DEMO_SOURCES: Array<{ id: string; label: string; path: string }> = [
  {
    id: 'gt-annual-2024',
    label: 'Golden Triangle BID Annual Report 2024',
    path: '/demo-data/Golden_Triangle_BID_Annual_Report_2024.txt',
  },
  {
    id: 'q3-assessment-collections',
    label: 'Q3 Assessment Collection Summary',
    path: '/demo-data/Q3_Assessment_Collection_Summary.txt',
  },
  {
    id: 'board-minutes-oct-2024',
    label: 'Board Meeting Minutes (Oct 2024)',
    path: '/demo-data/Board_Meeting_Minutes_October_2024.txt',
  },
];

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 3);

const scoreText = (queryTokens: string[], text: string) => {
  if (queryTokens.length === 0) return 0;
  const textTokens = new Set(tokenize(text));
  let hits = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) hits += 1;
  }
  return hits / queryTokens.length;
};

const pickBestQuote = (query: string, docs: NotebookBDSourceDoc[]) => {
  const queryTokens = tokenize(query);

  const citations: Citation[] = [];

  for (const doc of docs) {
    const chunks = doc.text
      .split(/\n\s*\n/g)
      .map((c) => c.trim())
      .filter(Boolean);

    let bestChunk = chunks[0] || doc.text;
    let bestScore = scoreText(queryTokens, bestChunk);

    for (const chunk of chunks) {
      const s = scoreText(queryTokens, chunk);
      if (s > bestScore) {
        bestScore = s;
        bestChunk = chunk;
      }
    }

    if (bestScore > 0) {
      citations.push({
        id: uuidv4(),
        sourceId: doc.material.id,
        sourceLabel: doc.material.label,
        quote: bestChunk.slice(0, 240),
      });
    }
  }

  citations.sort((a, b) => {
    const aLen = a.quote.length;
    const bLen = b.quote.length;
    return bLen - aLen;
  });

  return citations.slice(0, 3);
};

export async function loadNotebookBDSources(): Promise<NotebookBDSourceDoc[]> {
  const docs = await Promise.all(
    DEMO_SOURCES.map(async (source) => {
      const res = await fetch(source.path);
      const text = await res.text();
      const material: SourceMaterial = {
        id: source.id,
        label: source.label,
        type: 'document',
        url: source.path,
        isSelectedForContext: true,
      };

      return { material, text };
    })
  );

  return docs;
}

async function callAnthropic({
  apiKey,
  query,
  citations,
}: {
  apiKey: string;
  query: string;
  citations: Citation[];
}): Promise<string> {
  const context = citations
    .map((c, idx) => `[Source ${idx + 1}] ${c.sourceLabel}\n${c.quote}`)
    .join('\n\n');

  const prompt = `You are a BID research assistant. Answer the user's question using ONLY the provided sources.\n\n${context}\n\nUser question: ${query}\n\nRules:\n- Be concise.\n- When you use a source, cite it using [1], [2], etc.\n- If the sources do not support the answer, say so.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text || 'No response.';
}

export async function notebookbdAnswer({
  query,
  docs,
}: {
  query: string;
  docs: NotebookBDSourceDoc[];
}): Promise<Message> {
  const selectedDocs = docs.filter(
    (d) => d.material.isSelectedForContext !== false
  );

  const citations = pickBestQuote(query, selectedDocs);
  const referencedSources = citations.map((c) => c.sourceLabel);
  const confidence = citations.length === 0 ? 30 : citations.length === 1 ? 65 : 82;

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

  let content = '';
  if (apiKey && apiKey.startsWith('sk-ant-') && citations.length > 0) {
    try {
      content = await callAnthropic({ apiKey, query, citations });
    } catch {
      content = '';
    }
  }

  if (!content) {
    if (citations.length === 0) {
      content = `I don't have enough source material selected to answer that. Try enabling more Source Materials for context.`;
    } else {
      content = `Here’s what I found in your sources:\n\n- ${citations[0].quote} [1]\n\nAsk a follow-up and I can dig deeper across the other documents.`;
    }
  }

  return {
    id: `assistant-${uuidv4()}`,
    role: 'assistant',
    content,
    timestamp: new Date(),
    citations,
    referencedSources,
    confidence,
  };
}
