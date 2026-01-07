import fs from 'fs/promises';
import path from 'path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export const PODCAST_VOICE_IDS = {
  CASSIDY: '56AoDkrOh6qfVPDXZ7Pt',
  MARK: 'UgBBYS2sOqTuMpoF3BR0',
} as const;

export type DialogueSpeaker = keyof typeof PODCAST_VOICE_IDS;

export interface DialogueTurn {
  speaker: DialogueSpeaker;
  text: string;
}

export interface PodcastResult {
  podcastUrl: string;
  title: string;
  duration: number;
  script: DialogueTurn[];
}

// ElevenLabs Text-to-Dialogue hard limit appears to be 5,000 characters total.
const TEXT_TO_DIALOGUE_MAX_CHARS = 5000;
const TEXT_TO_DIALOGUE_CHUNK_TARGET_CHARS = 4500;

function splitTextByMaxChars(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    const slice = remaining.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > 200 ? lastSpace : maxChars;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length) parts.push(remaining);
  return parts;
}

function chunkDialogue(script: DialogueTurn[], maxChars: number) {
  const normalized: DialogueTurn[] = [];

  for (const turn of script) {
    const text = turn.text?.trim();
    if (!text) continue;
    if (text.length <= maxChars) {
      normalized.push({ ...turn, text });
      continue;
    }
    for (const part of splitTextByMaxChars(text, maxChars)) {
      normalized.push({ ...turn, text: part });
    }
  }

  const chunks: DialogueTurn[][] = [];
  let current: DialogueTurn[] = [];
  let currentChars = 0;

  for (const turn of normalized) {
    const len = turn.text.length;
    if (current.length && currentChars + len > maxChars) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(turn);
    currentChars += len;
  }
  if (current.length) chunks.push(current);

  return chunks;
}

function sanitizeEnvValue(value: string) {
  let v = value.trim();
  const quoteChars = new Set(['"', "'", '`', '“', '”', '‘', '’']);
  while (v.length >= 2 && quoteChars.has(v[0]) && quoteChars.has(v[v.length - 1])) {
    v = v.slice(1, -1).trim();
  }
  if (v.endsWith(';')) v = v.slice(0, -1).trim();
  return v;
}

function getElevenLabsApiKey() {
  const raw = process.env.ELEVENLABS_API_KEY ?? process.env.VITE_ELEVENLABS_API_KEY;
  if (!raw) return undefined;
  return sanitizeEnvValue(raw);
}

const PODCASTS_OUTPUT_PATH = path.join(process.cwd(), 'public', 'podcasts');

async function ensurePodcastsDir() {
  await fs.mkdir(PODCASTS_OUTPUT_PATH, { recursive: true });
}

function normalizeForFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function generatePodcastAudio(script: DialogueTurn[], outputId: string) {
  const apiKey = getElevenLabsApiKey();
  // Safe diagnostics.
  // eslint-disable-next-line no-console
  console.info('[podcast] ElevenLabs API key configured:', Boolean(apiKey));
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  await ensurePodcastsDir();

  const client = new ElevenLabsClient({ apiKey });

  const totalChars = script.reduce((sum, turn) => sum + (turn.text?.length ?? 0), 0);
  const maxPerRequest = Math.min(TEXT_TO_DIALOGUE_MAX_CHARS, TEXT_TO_DIALOGUE_CHUNK_TARGET_CHARS);
  const chunks = totalChars > maxPerRequest ? chunkDialogue(script, maxPerRequest) : [script];

  // eslint-disable-next-line no-console
  console.info(
    `[podcast] ElevenLabs text-to-dialogue: totalChars=${totalChars}, chunks=${chunks.length}, maxPerRequest=${maxPerRequest}`
  );

  const buffers: Buffer[] = [];
  for (const [idx, chunk] of chunks.entries()) {
    const chunkChars = chunk.reduce((sum, t) => sum + t.text.length, 0);
    if (chunkChars > TEXT_TO_DIALOGUE_MAX_CHARS) {
      throw new Error(
        `Internal error: chunk ${idx + 1} exceeds ElevenLabs limit (chars=${chunkChars}, max=${TEXT_TO_DIALOGUE_MAX_CHARS})`
      );
    }

    const inputs = chunk.map((turn) => ({
      text: turn.text,
      voiceId: turn.speaker === 'CASSIDY' ? PODCAST_VOICE_IDS.CASSIDY : PODCAST_VOICE_IDS.MARK,
    }));

    // eslint-disable-next-line no-console
    console.info(`[podcast] ElevenLabs chunk ${idx + 1}/${chunks.length}: chars=${chunkChars}`);

    const audioStream = await client.textToDialogue.convert({
      outputFormat: 'mp3_44100_128',
      modelId: 'eleven_v3',
      settings: { stability: 0.5 },
      inputs,
    });

    buffers.push(await streamToBuffer(audioStream));
  }

  // Naive MP3 concatenation. For this demo path, this is typically playable as long as
  // all segments share the same encoding settings.
  const buffer = Buffer.concat(buffers);

  const filename = `podcast-${normalizeForFilename(outputId)}-${Date.now()}.mp3`;
  const outputPath = path.join(PODCASTS_OUTPUT_PATH, filename);
  await fs.writeFile(outputPath, buffer);
  // eslint-disable-next-line no-console
  console.info('[podcast] Wrote podcast file:', outputPath, `(bytes=${buffer.length})`);

  const totalWords = script.reduce(
    (sum, turn) => sum + turn.text.split(/\s+/).filter(Boolean).length,
    0
  );
  const estimatedDuration = (totalWords / 150) * 60;

  return {
    audioUrl: `/podcasts/${filename}`,
    duration: estimatedDuration,
  };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(out);
}
