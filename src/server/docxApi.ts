/**
 * DOCX Export API (dev middleware)
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { generateBoardReportDocx, type BoardReportExportRequest } from './docxService';

type DocxApiRequestBody = BoardReportExportRequest & {
  filename?: string;
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

export function notebookBDDocxMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    try {
      const url = req.url || '';
      if (!url.startsWith('/api/export/docx')) return next();

      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }

      const body = await readJson<DocxApiRequestBody>(req);
      const { boardBrief = null, editorContent = null } = body;
      const filename = (body.filename || 'board-report').replace(/[^a-zA-Z0-9-_]/g, '-');

      if (!boardBrief && !(editorContent && editorContent.trim())) {
        return sendJson(res, 400, { error: 'No content to export' });
      }

      const buffer = await generateBoardReportDocx({
        boardBrief,
        editorContent,
        exportDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      });

      res.statusCode = 200;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
      res.end(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[DOCX Export] Error:', err);
      return sendJson(res, 500, { error: message || 'Failed to generate document' });
    }
  };
}
