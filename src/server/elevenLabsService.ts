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
  const raw = process.env.ELEVENLABS_API_KEY;
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
  console.info('[podcast] ELEVENLABS_API_KEY configured:', Boolean(apiKey));
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  await ensurePodcastsDir();

  const client = new ElevenLabsClient({ apiKey });

  const inputs = script.map((turn) => ({
    text: turn.text,
    voiceId: turn.speaker === 'CASSIDY' ? PODCAST_VOICE_IDS.CASSIDY : PODCAST_VOICE_IDS.MARK,
  }));

  const audioStream = await client.textToDialogue.convert({
    outputFormat: 'mp3_44100_128',
    modelId: 'eleven_v3',
    settings: { stability: 0.5 },
    inputs,
  });

  const buffer = await streamToBuffer(audioStream);

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
