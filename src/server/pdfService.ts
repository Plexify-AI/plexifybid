import path from 'path';
import fs from 'fs/promises';
import pdfParseImport from 'pdf-parse';
import type { RealDocsIndex } from '../types/realDocs';

const REAL_DOCS_PATH = path.join(process.cwd(), 'public', 'real-docs');

const pdfParse: any = (pdfParseImport as any)?.default ?? (pdfParseImport as any);

export interface ExtractedDocument {
  id: string;
  filename: string;
  displayName: string;
  text: string;
  pageCount: number;
}

const pdfCache = new Map<string, Promise<{ text: string; pageCount: number }>>();

const normalizeBase = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, '');

function assertSafeSlug(slug: string) {
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    throw new Error('Invalid district slug');
  }
}

function assertSafeFilename(filename: string) {
  const base = path.basename(filename);
  if (base !== filename) {
    throw new Error('Invalid filename');
  }

  if (!base.toLowerCase().endsWith('.pdf')) {
    throw new Error(`Unsupported file type: ${base}`);
  }
}

async function resolvePdfPath(districtSlug: string, filename: string) {
  const dir = path.join(REAL_DOCS_PATH, districtSlug);
  const base = path.basename(filename);
  const direct = path.join(dir, base);

  try {
    await fs.access(direct);
    return direct;
  } catch {
    // fallthrough
  }

  const entries = await fs.readdir(dir);
  const lower = base.toLowerCase();
  const directCaseInsensitive = entries.find((e) => e.toLowerCase() === lower);
  if (directCaseInsensitive) {
    return path.join(dir, directCaseInsensitive);
  }

  const want = normalizeBase(base);
  const fuzzy = entries.find((e) =>
    e.toLowerCase().endsWith('.pdf') ? normalizeBase(e) === want : false
  );
  if (fuzzy) {
    return path.join(dir, fuzzy);
  }

  const err: NodeJS.ErrnoException = new Error(
    `ENOENT: no such file or directory, open '${direct}'`
  );
  err.code = 'ENOENT';
  throw err;
}

export async function extractPdfText(
  districtSlug: string,
  filename: string
): Promise<{ text: string; pageCount: number }> {
  assertSafeSlug(districtSlug);
  assertSafeFilename(filename);

  const filePath = await resolvePdfPath(districtSlug, filename);

  const cached = pdfCache.get(filePath);
  if (cached) return cached;

  const promise = (async () => {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return { text: data.text ?? '', pageCount: data.numpages ?? 0 };
  })();

  pdfCache.set(filePath, promise);
  return promise;
}

function clampText(text: string, maxChars = 40_000) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[...truncated...]`;
}

export async function loadSelectedDocuments(
  districtSlug: string,
  documentIds: string[]
): Promise<{ documents: ExtractedDocument[]; missing: ExtractedDocument[] }> {
  assertSafeSlug(districtSlug);

  const indexPath = path.join(REAL_DOCS_PATH, districtSlug, 'index.json');
  const indexRaw = await fs.readFile(indexPath, 'utf-8');
  const index = JSON.parse(indexRaw) as RealDocsIndex;

  const requested = new Set(documentIds);
  const docs = index.documents.filter((doc) => requested.has(doc.id));

  const results: ExtractedDocument[] = [];
  const missing: ExtractedDocument[] = [];
  for (const doc of docs) {
    if (!doc.filename.toLowerCase().endsWith('.pdf')) {
      // Not supported in Phase 2B-1.
      continue;
    }

    try {
      const { text, pageCount } = await extractPdfText(districtSlug, doc.filename);
      results.push({
        id: doc.id,
        filename: doc.filename,
        displayName: doc.displayName,
        text: clampText(text),
        pageCount: doc.pageCount ?? pageCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      missing.push({
        id: doc.id,
        filename: doc.filename,
        displayName: doc.displayName,
        text: message,
        pageCount: doc.pageCount ?? 0,
      });
    }
  }

  return { documents: results, missing };
}
