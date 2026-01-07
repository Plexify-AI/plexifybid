import type { IncomingMessage, ServerResponse } from 'http';
import { generateAudioBriefing, type TTSResult, type TTSContent } from './ttsService';

type TtsApiRequestBody = {
  content?: TTSContent;
  outputId?: string;
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

export function notebookBDTtsMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    try {
      const url = req.url || '';
      if (!url.startsWith('/api/tts/generate')) return next();

      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }

      const body = await readJson<TtsApiRequestBody>(req);

      if (!body.content) {
        return sendJson(res, 400, { error: 'Missing content' });
      }

      if (!body.outputId) {
        return sendJson(res, 400, { error: 'Missing outputId' });
      }

      if (!process.env.OPENAI_API_KEY) {
        return sendJson(res, 500, { error: 'OpenAI API key not configured' });
      }

      const result: TTSResult = await generateAudioBriefing(body.content, body.outputId);
      return sendJson(res, 200, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return sendJson(res, 500, { error: message });
    }
  };
}
