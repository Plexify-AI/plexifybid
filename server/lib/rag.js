/**
 * PlexifySOLO — RAG utilities
 *
 * Text chunking (~500 words with overlap) and keyword-based
 * relevance search. No vector embeddings — simple, fast, zero deps.
 */

// ---------------------------------------------------------------------------
// Text Chunking
// ---------------------------------------------------------------------------

const CHUNK_TARGET_WORDS = 500;
const CHUNK_OVERLAP_WORDS = 50;

/**
 * Split text into overlapping chunks of ~500 words.
 * Each chunk includes metadata for RAG retrieval.
 *
 * @param {string} text - Full extracted text
 * @param {string} sourceId - UUID of the source
 * @param {string} sourceName - File name for attribution
 * @returns {Array<{index: number, text: string, source_id: string, source_name: string, word_count: number}>}
 */
export function chunkText(text, sourceId, sourceName) {
  if (!text || !text.trim()) return [];

  // Normalize whitespace
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Split into words
  const words = cleaned.split(/\s+/);

  if (words.length <= CHUNK_TARGET_WORDS) {
    return [
      {
        index: 0,
        text: cleaned,
        source_id: sourceId,
        source_name: sourceName,
        word_count: words.length,
      },
    ];
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_TARGET_WORDS, words.length);
    const chunkWords = words.slice(start, end);
    const chunkText = chunkWords.join(' ');

    chunks.push({
      index: chunks.length,
      text: chunkText,
      source_id: sourceId,
      source_name: sourceName,
      word_count: chunkWords.length,
    });

    // Advance with overlap
    start = end - CHUNK_OVERLAP_WORDS;
    if (start >= words.length) break;
    // Avoid tiny trailing chunks
    if (words.length - start < CHUNK_OVERLAP_WORDS * 2) {
      // Last chunk — grab everything remaining
      const remaining = words.slice(end - CHUNK_OVERLAP_WORDS);
      if (remaining.length > CHUNK_OVERLAP_WORDS) {
        chunks.push({
          index: chunks.length,
          text: remaining.join(' '),
          source_id: sourceId,
          source_name: sourceName,
          word_count: remaining.length,
        });
      }
      break;
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Keyword Relevance Search
// ---------------------------------------------------------------------------

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us',
  'my', 'your', 'his', 'its', 'our', 'their', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'about', 'above',
  'after', 'again', 'also', 'any', 'because', 'before', 'between', 'here',
  'there', 'if', 'into', 'out', 'over', 'then', 'up', 'down',
]);

/**
 * Extract meaningful keywords from text.
 */
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Score a chunk against query keywords using keyword overlap + TF boost.
 *
 * @param {object} chunk - Chunk with {text, index, source_name, ...}
 * @param {string[]} queryKeywords - Extracted keywords from user query
 * @returns {number} Relevance score (higher = more relevant)
 */
function scoreChunk(chunk, queryKeywords) {
  const chunkText = chunk.text.toLowerCase();
  const chunkWords = extractKeywords(chunk.text);
  const chunkWordSet = new Set(chunkWords);

  let score = 0;

  for (const kw of queryKeywords) {
    if (chunkWordSet.has(kw)) {
      // Base match
      score += 1;

      // TF boost — how many times does this keyword appear?
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = chunkText.match(regex);
      if (matches) {
        score += Math.min(matches.length * 0.3, 2); // cap at 2 bonus
      }
    }

    // Partial match bonus (keyword is substring of a chunk word)
    for (const cw of chunkWordSet) {
      if (cw !== kw && cw.includes(kw) && kw.length >= 4) {
        score += 0.3;
      }
    }
  }

  // Normalize by query length to avoid bias toward long queries
  if (queryKeywords.length > 0) {
    score = score / queryKeywords.length;
  }

  // Position boost — earlier chunks (intro/summary) get slight preference
  if (chunk.index === 0) score *= 1.15;

  return score;
}

/**
 * Search all source chunks for the most relevant ones to a query.
 *
 * @param {string} query - User's question
 * @param {Array} sources - Array of {id, file_name, content_chunks: [...]}
 * @param {number} topK - Number of chunks to return
 * @returns {Array<{chunk: object, score: number}>}
 */
/**
 * Detect if a query is a broad/meta request (summarize, overview, etc.)
 * that should include all sources rather than keyword-filtered results.
 */
const BROAD_QUERY_PATTERNS = [
  /\bsummar/i, /\boverview\b/i, /\ball\b.*\bsource/i, /\beverything\b/i,
  /\bwhat.*(?:have|uploaded|got)\b/i, /\btell me about\b/i, /\bkey (?:takeaway|point|theme|finding)/i,
  /\bhighlight/i, /\bbrief me\b/i, /\bcatch me up\b/i, /\bwhat.*\bknow\b/i,
];

function isBroadQuery(query) {
  return BROAD_QUERY_PATTERNS.some((p) => p.test(query));
}

export function searchChunks(query, sources, topK = 6) {
  const queryKeywords = extractKeywords(query);
  const broad = isBroadQuery(query);

  // For broad queries or no meaningful keywords — return chunks from all sources
  // so Claude always has material to work with
  if (broad || queryKeywords.length === 0) {
    const allChunks = [];
    for (const source of sources) {
      if (!source.content_chunks || source.content_chunks.length === 0) continue;
      for (const chunk of source.content_chunks) {
        allChunks.push({ chunk, score: 0.5 });
      }
    }
    // For broad queries, include more chunks (up to topK * 2)
    return allChunks.slice(0, broad ? topK * 2 : topK);
  }

  // Flatten all chunks from all sources
  const allChunks = [];
  for (const source of sources) {
    if (!source.content_chunks || source.content_chunks.length === 0) continue;
    for (const chunk of source.content_chunks) {
      allChunks.push(chunk);
    }
  }

  // Score each chunk
  const scored = allChunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, queryKeywords),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fallback: if keyword search found nothing, return first chunks from each source
  // This ensures Claude always has some context to work with
  if (scored.length === 0) {
    return sources
      .filter((s) => s.content_chunks?.length > 0)
      .flatMap((s) => s.content_chunks.slice(0, 2).map((chunk) => ({ chunk, score: 0.1 })))
      .slice(0, topK);
  }

  return scored;
}

/**
 * Build context string for Claude from retrieved chunks.
 */
export function buildRAGContext(rankedChunks) {
  if (rankedChunks.length === 0) {
    return 'No relevant source material found for this query.';
  }

  const sections = rankedChunks.map(({ chunk }, i) => {
    return `[Source: ${chunk.source_name}, Chunk ${chunk.index}]\n${chunk.text}`;
  });

  return '=== SOURCE DOCUMENTS ===\n\n' + sections.join('\n\n---\n\n');
}
