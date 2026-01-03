import type { IncomingMessage, ServerResponse } from 'http';
import { loadSelectedDocuments } from './pdfService';
import { generatePodcastScript } from './podcastScriptService';
import { generatePodcastAudio, type PodcastResult } from './elevenLabsService';

type PodcastGenerateRequestBody = {
  documentIds?: string[];
  projectId?: string;
};

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

function buildContext(docs: Array<{ displayName: string; text: string }>) {
  const perDocMax = 12_000;
  const totalMax = 60_000;
  let total = 0;

  const parts: string[] = [];
  for (const doc of docs) {
    if (total >= totalMax) break;
    const slice = doc.text.slice(0, perDocMax);
    total += slice.length;
    parts.push(`--- SOURCE: ${doc.displayName} ---\n${slice}\n--- END SOURCE ---`);
  }

  return parts.join('\n\n');
}

export function notebookBDPodcastMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    try {
      const url = req.url || '';
      if (!url.startsWith('/api/podcast/generate')) return next();

      if (req.method !== 'POST') {
        return sendJson(res, 405, { success: false, error: 'Method not allowed' });
      }

      const body = await readJson<PodcastGenerateRequestBody>(req);
      const documentIds = body.documentIds ?? [];
      const projectId = body.projectId ?? 'golden-triangle';

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: 'No documents selected. Please select at least one document.',
        });
      }

      if (!process.env.ELEVENLABS_API_KEY && !process.env.VITE_ELEVENLABS_API_KEY) {
        return sendJson(res, 500, {
          success: false,
          error: 'ElevenLabs API key not configured',
        });
      }

      // eslint-disable-next-line no-console
      console.info('[podcast] Starting generation for documents:', documentIds);

      const { documents } = await loadSelectedDocuments(projectId, documentIds);
      if (documents.length === 0) {
        return sendJson(res, 400, {
          success: false,
          error: 'Could not load selected documents.',
        });
      }

      const context = buildContext(documents);

      // eslint-disable-next-line no-console
      console.info('[podcast] Generating script with Claude...');
      const script = await generatePodcastScript(context, 'Golden Triangle BID');
      // eslint-disable-next-line no-console
      console.info(
        `[podcast] Script generated: ${script.wordCount} words, ${script.dialogue.length} turns`
      );

      // eslint-disable-next-line no-console
      console.info('[podcast] Generating audio with ElevenLabs...');
      const outputId = `gt-${Date.now()}`;
      const audio = await generatePodcastAudio(script.dialogue, outputId);

      const result: PodcastResult = {
        podcastUrl: audio.audioUrl,
        title: script.title,
        duration: audio.duration,
        script: script.dialogue,
      };

      return sendJson(res, 200, { success: true, podcast: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[podcast] Generation error:', err);
      return sendJson(res, 500, { success: false, error: message });
    }
  };
}
