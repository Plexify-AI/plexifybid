import type { DialogueTurn } from './elevenLabsService';

export interface PodcastScript {
  title: string;
  description: string;
  dialogue: DialogueTurn[];
  wordCount: number;
}

// ElevenLabs Text-to-Dialogue has a 5k character limit across input text.
// Keep a safety margin so generation succeeds reliably in dev.
const MAX_DIALOGUE_CHARS = 4500;

const PODCAST_SYSTEM_PROMPT = `You are a podcast script writer creating a two-host deep dive discussion about Business Improvement District operations and development opportunities.

PERSONAS:
- CASSIDY (Host): Warm, curious, professional podcast host. Guides the conversation with insightful questions. Uses natural transitions like "That's fascinating..." or "Help me understand..." or "Our listeners might be wondering...". Asks follow-up questions that board members and stakeholders would want answered.

- MARK (Analyst): BID operations and development expert. Provides detailed, authoritative insights while remaining accessible. References specific data and findings from the source documents. Uses phrases like "What the data shows us..." or "One thing that stands out..." or "From an operational perspective...".

DIALOGUE STYLE:
- Natural, conversational flow - not stiff or scripted-sounding
- Include brief reactions: "Right", "Exactly", "That's a great point"
- Use transitional phrases between topics
- Include occasional [thoughtful], [enthusiastic], or [concerned] emotional cues where appropriate
- Vary sentence length for natural rhythm
- Mark should cite specific numbers and facts from the documents
- Cassidy should summarize and clarify complex points for the audience

OUTPUT FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "title": "Episode title",
  "description": "Brief episode description (1-2 sentences)",
  "dialogue": [
    {"speaker": "CASSIDY", "text": "Welcome to District Insights..."},
    {"speaker": "MARK", "text": "Thanks for having me..."}
  ]
}

Do not include any text before or after the JSON. No markdown code blocks.`;

function sanitizeEnvValue(value: string) {
  let v = value.trim();
  const quoteChars = new Set(['"', "'", '`', '“', '”', '‘', '’']);
  while (v.length >= 2 && quoteChars.has(v[0]) && quoteChars.has(v[v.length - 1])) {
    v = v.slice(1, -1).trim();
  }
  if (v.endsWith(';')) v = v.slice(0, -1).trim();
  return v;
}

function getAnthropicApiKey() {
  const raw = process.env.VITE_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!raw) return undefined;
  return sanitizeEnvValue(raw);
}

function getAnthropicModelCandidates() {
  const raw = process.env.VITE_ANTHROPIC_MODEL ?? process.env.ANTHROPIC_MODEL;
  const preferred = raw?.trim() ? sanitizeEnvValue(raw) : undefined;
  const candidates = [
    preferred,
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
  ].filter(Boolean) as string[];
  return [...new Set(candidates)];
}

async function anthropicMessagesCreate(opts: {
  apiKey: string;
  models: string[];
  system: string;
  prompt: string;
}) {
  const { apiKey, models, system, prompt } = opts;
  const [model, ...rest] = models;
  if (!model) throw new Error('No Anthropic model available to try');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404 && text.includes('model') && rest.length > 0) {
      return anthropicMessagesCreate({ apiKey, models: rest, system, prompt });
    }
    throw new Error(`Anthropic error ${response.status}: ${text}`);
  }

  return response.json();
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let json = text.slice(start, end + 1).trim();
  if (json.startsWith('```json')) json = json.slice(7).trim();
  if (json.startsWith('```')) json = json.slice(3).trim();
  if (json.endsWith('```')) json = json.slice(0, -3).trim();

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function generatePodcastScript(context: string, districtName = 'Golden Triangle BID') {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const userPrompt = `Create a SHORT demo podcast episode (about 3-4 minutes) discussing the following Business Improvement District.

IMPORTANT: The output must fit ElevenLabs Text-to-Dialogue limits.
- Keep the TOTAL length of all dialogue "text" fields combined to <= ${MAX_DIALOGUE_CHARS} characters.
- Aim for ~700-900 words maximum.

DISTRICT: ${districtName}

SOURCE DOCUMENTS:
${context}

EPISODE STRUCTURE:
1. Opening (20 sec): Cassidy welcomes listeners and introduces Mark
2. Snapshot (60 sec): Mark gives district background and 2-3 key metrics
3. What matters (90 sec): 2-3 highlights + 1-2 risks
4. Recommendations (40 sec): Mark's top takeaways
5. Closing (20 sec): Cassidy summarizes and thanks Mark

Generate the complete dialogue script now.`;

  const data = await anthropicMessagesCreate({
    apiKey,
    models: getAnthropicModelCandidates(),
    system: PODCAST_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  const parts: Array<{ type: string; text?: string }> = data?.content ?? [];
  const textPart = parts.find((p) => p.type === 'text' && typeof p.text === 'string');
  if (!textPart?.text) throw new Error('No text content in Claude response');

  const parsed = extractJsonObject(textPart.text) as
    | { title?: string; description?: string; dialogue?: DialogueTurn[] }
    | null;
  if (!parsed || !Array.isArray(parsed.dialogue)) {
    throw new Error('Failed to parse podcast script');
  }

  const dialogue = parsed.dialogue.filter(
    (t) =>
      t &&
      (t.speaker === 'CASSIDY' || t.speaker === 'MARK') &&
      typeof t.text === 'string' &&
      t.text.trim().length > 0
  );

  const clampedDialogue: DialogueTurn[] = [];
  let usedChars = 0;
  for (const turn of dialogue) {
    const text = turn.text.trim();
    if (!text) continue;

    if (usedChars + text.length > MAX_DIALOGUE_CHARS) {
      const remaining = MAX_DIALOGUE_CHARS - usedChars;
      if (remaining <= 0) break;
      const clipped = text.slice(0, remaining).trim();
      if (clipped.length > 0) {
        clampedDialogue.push({ ...turn, text: clipped });
      }
      break;
    }

    clampedDialogue.push({ ...turn, text });
    usedChars += text.length;
  }

  const finalDialogue = clampedDialogue.length > 0 ? clampedDialogue : dialogue;

  const wordCount = finalDialogue.reduce(
    (sum, turn) => sum + turn.text.split(/\s+/).filter(Boolean).length,
    0
  );

  return {
    title: parsed.title || `${districtName} Deep Dive`,
    description: parsed.description || `A deep dive discussion of ${districtName}.`,
    dialogue: finalDialogue,
    wordCount,
  } satisfies PodcastScript;
}
