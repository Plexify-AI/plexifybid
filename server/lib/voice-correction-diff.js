/**
 * PlexifySOLO — Voice Correction Diff Utility (Sprint B / B2)
 *
 * Compares an AI-generated text against the user's edited version and returns
 * an array of { original_snippet, corrected_snippet } pairs representing the
 * style edits the user made.
 *
 * ALGORITHM:
 *   1. Strip HTML (TipTap emits HTML) to plain text, preserving sentence breaks.
 *   2. Normalise whitespace.
 *   3. Split both texts into sentences.
 *   4. Compute an LCS (longest common subsequence) alignment of sentence arrays.
 *   5. Walk the alignment: when a sentence appears in BOTH sides but the strings
 *      aren't identical, emit a correction. Pure inserts/deletes are skipped —
 *      those are content rewrites, not style corrections.
 *   6. Filter trivial changes: whitespace-only, case-only, typo-only
 *      (Levenshtein <= 2 on short sentences).
 *   7. Cap each snippet at SNIPPET_MAX_CHARS so injection size stays bounded.
 *
 * The algorithm is O(n*m) in sentence count. For the realistic envelope
 * (artifact body ≤ ~80 sentences), that's trivial.
 */

const SNIPPET_MAX_CHARS = 240;
const TYPO_LEVENSHTEIN_THRESHOLD = 2;        // ≤2 char edits → counted as typo fix
const TYPO_MAX_SENTENCE_LENGTH = 40;         // ...but only for short sentences

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Diff two texts and return the list of non-trivial style corrections.
 *
 * @param {string} originalText - AI-generated text (HTML or plain)
 * @param {string} editedText   - User-edited text  (HTML or plain)
 * @returns {Array<{original_snippet: string, corrected_snippet: string}>}
 */
export function diffToCorrections(originalText, editedText) {
  const originalSentences = splitToSentences(normaliseForDiff(stripHtml(originalText || '')));
  const editedSentences   = splitToSentences(normaliseForDiff(stripHtml(editedText   || '')));

  if (originalSentences.length === 0 || editedSentences.length === 0) return [];

  const alignment = lcsAlignment(originalSentences, editedSentences);
  const corrections = [];

  for (const pair of alignment) {
    // We only care about pairs where BOTH sides have content.
    if (pair.original === null || pair.edited === null) continue;
    if (pair.original === pair.edited) continue; // identical — skip

    if (isTrivialChange(pair.original, pair.edited)) continue;

    corrections.push({
      original_snippet: truncate(pair.original, SNIPPET_MAX_CHARS),
      corrected_snippet: truncate(pair.edited,   SNIPPET_MAX_CHARS),
    });
  }

  return corrections;
}

// ---------------------------------------------------------------------------
// Text preparation
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags while preserving sentence boundaries. Block-level tags
 * become newlines so sentences from different paragraphs don't collide.
 */
function stripHtml(html) {
  if (typeof html !== 'string') return '';

  // Fast path — no tags.
  if (!/[<&]/.test(html)) return html;

  return html
    // Block-level elements → newline
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Common entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/**
 * Collapse whitespace so sentence comparison isn't thrown off by formatting.
 */
function normaliseForDiff(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

/**
 * Split text into sentences. Breaks on sentence terminators and on newlines
 * so list items / bullets become discrete sentences.
 */
function splitToSentences(text) {
  if (!text) return [];
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"'([])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ---------------------------------------------------------------------------
// LCS alignment
// ---------------------------------------------------------------------------

/**
 * Build an alignment of two sentence arrays using classic LCS.
 * Returns an ordered list of { original, edited } pairs where one side
 * may be null (inserts/deletes) or both are non-null (match or substitution).
 *
 * Two sentences are considered "equal" for LCS purposes when their
 * case-folded, whitespace-normalised forms match. This means a case-only
 * rewrite like "Hi Mel" → "hi mel" still matches in LCS, and is then
 * filtered out by isTrivialChange() rather than emitted as a correction.
 */
function lcsAlignment(a, b) {
  const n = a.length;
  const m = b.length;

  // Identity matrix — dp[i][j] = LCS length of a[0..i-1] vs b[0..j-1]
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (sentencesEqualForLcs(a[i - 1], b[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Walk back to produce the alignment.
  const result = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (sentencesEqualForLcs(a[i - 1], b[j - 1])) {
      result.push({ original: a[i - 1], edited: b[j - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      result.push({ original: a[i - 1], edited: null });
      i--;
    } else {
      result.push({ original: null, edited: b[j - 1] });
      j--;
    }
  }
  while (i > 0) { result.push({ original: a[i - 1], edited: null }); i--; }
  while (j > 0) { result.push({ original: null, edited: b[j - 1] }); j--; }

  result.reverse();

  // Collapse adjacent insert+delete into substitution pairs — this is where
  // "user rewrote sentence X" becomes a real correction instead of two
  // separate insert+delete events.
  return collapseToSubstitutions(result);
}

function sentencesEqualForLcs(x, y) {
  return normForCompare(x) === normForCompare(y);
}

function normForCompare(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * After LCS, adjacent (delete, insert) runs mean "the user replaced old
 * sentence(s) with new sentence(s)". Pair them up 1:1 into substitutions
 * so the diff emits useful {original, edited} snippet pairs.
 *
 * If a run has unequal counts (e.g. 3 deletes + 1 insert) the extra
 * items stay as inserts/deletes.
 */
function collapseToSubstitutions(alignment) {
  const out = [];
  let i = 0;
  while (i < alignment.length) {
    const entry = alignment[i];
    if (entry.original !== null && entry.edited !== null) {
      out.push(entry);
      i++;
      continue;
    }

    // Collect a run of null-entries
    const dels = [];
    const ins = [];
    while (i < alignment.length && (alignment[i].original === null || alignment[i].edited === null)) {
      if (alignment[i].original !== null) dels.push(alignment[i].original);
      if (alignment[i].edited   !== null) ins.push(alignment[i].edited);
      i++;
    }

    const pairs = Math.min(dels.length, ins.length);
    for (let k = 0; k < pairs; k++) {
      out.push({ original: dels[k], edited: ins[k] });
    }
    for (let k = pairs; k < dels.length; k++) {
      out.push({ original: dels[k], edited: null });
    }
    for (let k = pairs; k < ins.length; k++) {
      out.push({ original: null, edited: ins[k] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trivial-change filter
// ---------------------------------------------------------------------------

/**
 * Returns true when a diff is too small to be a real style correction:
 *   - Same after whitespace normalisation
 *   - Same after case-fold
 *   - Levenshtein ≤ TYPO_LEVENSHTEIN_THRESHOLD on short sentences (typo fix)
 */
function isTrivialChange(a, b) {
  if (a === b) return true;

  const aNorm = normForCompare(a);
  const bNorm = normForCompare(b);
  if (aNorm === bNorm) return true;                   // whitespace + case only

  // Levenshtein filter only for short sentences — on long sentences
  // ≤2 edits is still a meaningful style tweak, don't drop it.
  if (Math.max(aNorm.length, bNorm.length) <= TYPO_MAX_SENTENCE_LENGTH) {
    if (levenshtein(aNorm, bNorm) <= TYPO_LEVENSHTEIN_THRESHOLD) return true;
  }

  return false;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s, max) {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// Exported for unit tests / debugging only. Not part of the capture endpoint.
export const _internal = {
  stripHtml,
  normaliseForDiff,
  splitToSentences,
  lcsAlignment,
  isTrivialChange,
  levenshtein,
};
