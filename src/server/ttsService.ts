import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

export interface AudioChapter {
  title: string;
  text: string;
  startTime?: number;
  duration?: number;
}

export interface TTSResult {
  audioUrl: string;
  chapters: AudioChapter[];
  totalDuration: number;
}

type TTSContent = {
  title: string;
  subtitle?: string;
  sections: Array<{ heading: string; items?: string[]; text?: string }>;
};

function sanitizeEnvValue(value: string) {
  let v = value.trim();
  const quoteChars = new Set(['"', "'", '`', '“', '”', '‘', '’']);
  while (v.length >= 2 && quoteChars.has(v[0]) && quoteChars.has(v[v.length - 1])) {
    v = v.slice(1, -1).trim();
  }
  if (v.endsWith(';')) v = v.slice(0, -1).trim();
  return v;
}

function getOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return undefined;
  return sanitizeEnvValue(raw);
}

const AUDIO_OUTPUT_PATH = path.join(process.cwd(), 'public', 'audio');

async function ensureAudioDir() {
  await fs.mkdir(AUDIO_OUTPUT_PATH, { recursive: true });
}

function normalizeForFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function estimateChapterTimings(chapters: AudioChapter[]) {
  const wordsPerMinute = 150;
  let currentTime = 0;

  for (const chapter of chapters) {
    const wordCount = chapter.text.split(/\s+/).filter(Boolean).length;
    const duration = (wordCount / wordsPerMinute) * 60;
    chapter.startTime = currentTime;
    chapter.duration = duration;
    currentTime += duration;
  }

  return currentTime;
}

function buildScript(content: TTSContent) {
  const chapters: AudioChapter[] = [];

  const introText = [content.title, content.subtitle].filter(Boolean).join('. ');
  chapters.push({ title: 'Introduction', text: introText });

  const scriptParts: string[] = [];
  scriptParts.push(`${content.title}.`);
  if (content.subtitle) scriptParts.push(`${content.subtitle}.`);

  for (const section of content.sections) {
    const sectionText =
      section.items && section.items.length > 0
        ? section.items.join('. ')
        : section.text ?? '';

    const cleaned = sectionText.trim();
    if (!cleaned) continue;

    scriptParts.push(`${section.heading}.`);
    scriptParts.push(cleaned);
    chapters.push({ title: section.heading, text: cleaned });
  }

  // Keep the audio briefing concise and under typical TTS input limits.
  const fullScript = scriptParts.join('\n\n').slice(0, 3500);
  return { fullScript, chapters };
}

export async function generateAudioBriefing(
  content: TTSContent,
  outputId: string
): Promise<TTSResult> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  await ensureAudioDir();

  const { fullScript, chapters } = buildScript(content);

  const openai = new OpenAI({ apiKey });

  const mp3Response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'alloy',
    input: fullScript,
    speed: 1.0,
  });

  const filename = `briefing-${normalizeForFilename(outputId)}-${Date.now()}.mp3`;
  const outputPath = path.join(AUDIO_OUTPUT_PATH, filename);

  const buffer = Buffer.from(await mp3Response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);

  const totalDuration = estimateChapterTimings(chapters);

  return {
    audioUrl: `/audio/${filename}`,
    chapters,
    totalDuration,
  };
}

export type { TTSContent };
