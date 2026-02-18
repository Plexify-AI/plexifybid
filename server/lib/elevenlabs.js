/**
 * PlexifySOLO — ElevenLabs TTS client
 *
 * Lazy-init ElevenLabsClient. Two generation modes:
 *   generateBriefing(text) — single professional voice → mp3 Buffer
 *   generatePodcast(sections) — two-voice dialogue → mp3 Buffer
 *
 * Uses eleven_turbo_v2 for speed. Graceful degradation via isElevenLabsConfigured().
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// ---------------------------------------------------------------------------
// Voice IDs (ElevenLabs pre-made voices)
// ---------------------------------------------------------------------------

const VOICE_BRIEFING = 'onwK4e9ZLuTAKqWW03F9'; // Daniel — professional male
const VOICE_HOST     = '21m00Tcm4TlvDq8ikWAM'; // Rachel — conversational female
const VOICE_ANALYST  = 'onwK4e9ZLuTAKqWW03F9'; // Daniel — professional male

const MODEL_ID = 'eleven_turbo_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';

// ---------------------------------------------------------------------------
// Lazy client
// ---------------------------------------------------------------------------

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY');
    _client = new ElevenLabsClient({ apiKey });
  }
  return _client;
}

export function isElevenLabsConfigured() {
  return !!process.env.ELEVENLABS_API_KEY;
}

// ---------------------------------------------------------------------------
// Stream → Buffer helper
// ---------------------------------------------------------------------------

async function streamToBuffer(stream) {
  const chunks = [];

  // Handle both Web ReadableStream and Node Readable
  if (typeof stream.getReader === 'function') {
    // Web ReadableStream
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } else if (typeof stream[Symbol.asyncIterator] === 'function') {
    // Node Readable stream
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
  } else {
    throw new Error('Unexpected stream type from ElevenLabs SDK');
  }

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Generate briefing (single voice)
// ---------------------------------------------------------------------------

/**
 * Generate a single-voice audio briefing.
 * @param {string} text — Script text to narrate (200-300 words ideal)
 * @param {string} [voiceId] — ElevenLabs voice ID (default: Daniel)
 * @returns {Promise<Buffer>} mp3 audio buffer
 */
export async function generateBriefing(text, voiceId) {
  const client = getClient();
  const vid = voiceId || VOICE_BRIEFING;

  console.log(`[elevenlabs] Generating briefing: ${text.length} chars, voice=${vid}`);

  const response = await client.textToSpeech.convert(vid, {
    text,
    modelId: MODEL_ID,
    outputFormat: OUTPUT_FORMAT,
  });

  const buffer = await streamToBuffer(response);
  console.log(`[elevenlabs] Briefing generated: ${buffer.length} bytes`);
  return buffer;
}

// ---------------------------------------------------------------------------
// Generate podcast (two-voice dialogue)
// ---------------------------------------------------------------------------

/**
 * Generate a two-voice podcast dialogue.
 * @param {Array<{speaker: 'host'|'analyst', text: string}>} sections
 * @returns {Promise<Buffer>} mp3 audio buffer
 */
export async function generatePodcast(sections) {
  const client = getClient();

  // Map sections to ElevenLabs DialogueInput format
  const inputs = sections.map((s) => ({
    text: s.text,
    voiceId: s.speaker === 'host' ? VOICE_HOST : VOICE_ANALYST,
  }));

  const totalChars = sections.reduce((acc, s) => acc + s.text.length, 0);
  console.log(`[elevenlabs] Generating podcast: ${sections.length} sections, ${totalChars} chars`);

  const response = await client.textToDialogue.convert({
    inputs,
    outputFormat: OUTPUT_FORMAT,
  });

  const buffer = await streamToBuffer(response);
  console.log(`[elevenlabs] Podcast generated: ${buffer.length} bytes`);
  return buffer;
}
