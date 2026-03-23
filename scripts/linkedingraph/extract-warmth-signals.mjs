/**
 * LinkedInGraph Warmth Signal Extraction v1.0
 *
 * Parses 8 files from a LinkedIn Data Export to compute 7-dimension
 * composite warmth scores (0-100) for each contact.
 *
 * Usage:
 *   node scripts/linkedingraph/extract-warmth-signals.mjs \
 *     --export-dir "data/linkedin_export" \
 *     --owner-url "https://www.linkedin.com/in/kendamato"
 *
 * Options:
 *   --export-dir <path>  Path to unzipped LinkedIn Data Export (required)
 *   --owner-url <url>    Owner's LinkedIn profile URL (required)
 *   --output <path>      Output JSON path (default: data/linkedingraph_warmth_signals.json)
 *   --dry-run            Show stats without writing output
 *   --limit N            Process first N contacts only
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');

// ── CSV parser (same state-machine used across all linkedingraph scripts) ──
function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len || text[i] === '\n' || text[i] === '\r') return '';
    if (text[i] === '"') {
      i++;
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      return field;
    } else {
      let field = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i++;
      }
      return field;
    }
  }

  while (i < len) {
    const row = [];
    while (true) {
      row.push(parseField());
      if (i < len && text[i] === ',') { i++; continue; }
      break;
    }
    if (i < len && text[i] === '\r') i++;
    if (i < len && text[i] === '\n') i++;
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

// ── URL normalization ──
function normalizeLinkedInUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let n = url.trim();
  if (!n) return null;
  n = n.replace(/^https?:\/\//, '');
  n = n.replace(/^www\./, '');
  n = n.replace(/\/$/, '');
  return n.toLowerCase();
}

// ── Company name normalization ──
function normalizeCompany(name) {
  if (!name) return '';
  return name
    .replace(/,?\s*(Inc\.?|LLC|Corp\.?|Ltd\.?|Co\.?|Group|Holdings|Pty|PLC|S\.A\.?|International|Global|Worldwide|NA|US|USA)$/i, '')
    .trim()
    .toLowerCase();
}

// ── Scoring functions ──
const WEIGHTS = {
  message_count: 0.30,
  reciprocity: 0.15,
  recency: 0.15,
  endorsements: 0.15,
  recommendations: 0.10,
  invitation: 0.10,
  company_follow: 0.05,
};

function scoreDimension(dimension, raw) {
  switch (dimension) {
    case 'message_count': {
      const v = typeof raw === 'number' ? raw : 0;
      if (v === 0) return 0;
      if (v <= 3) return 25;
      if (v <= 10) return 50;
      if (v <= 25) return 75;
      return 100;
    }
    case 'reciprocity': {
      const v = typeof raw === 'number' ? raw : 0;
      if (v === 0) return 0;
      if (v < 0.2) return 25;
      if (v < 0.4) return 50;
      if (v < 0.7) return 75;
      return 100;
    }
    case 'recency': {
      const v = typeof raw === 'number' ? raw : 9999;
      if (v > 730) return 0;
      if (v > 365) return 25;
      if (v > 180) return 50;
      if (v > 30) return 75;
      return 100;
    }
    case 'endorsements': {
      const given = raw?.given || 0;
      const received = raw?.received || 0;
      if (given === 0 && received === 0) return 0;
      if (given > 0 && received > 0) return 100;
      if (given + received >= 4) return 75;
      if (given + received >= 2) return 50;
      return 25;
    }
    case 'recommendations': {
      const g = !!raw?.given;
      const r = !!raw?.received;
      if (g && r) return 100;
      if (g) return 75;
      if (r) return 50;
      return 0;
    }
    case 'invitation': {
      if (raw === 'outgoing_custom') return 100;
      if (raw === 'outgoing') return 75;
      if (raw === 'incoming') return 50;
      return 0;
    }
    case 'company_follow':
      return raw ? 100 : 0;
    default:
      return 0;
  }
}

// Dimensions that require specific source files
const DIMENSION_FILE_MAP = {
  message_count: 'messages.csv',
  reciprocity: 'messages.csv',
  recency: 'messages.csv',
  endorsements: 'endorsements',
  recommendations: 'recommendations',
  invitation: 'Invitations.csv',
  company_follow: 'Company Follows.csv',
};

function computeComposite(dimensions, availableDims) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    if (availableDims.has(dim)) {
      totalWeight += weight;
      weightedSum += dimensions[dim].score * weight;
    }
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

function warmthLabel(composite) {
  if (composite >= 76) return 'Hot';
  if (composite >= 51) return 'Strong';
  if (composite >= 26) return 'Warm';
  return 'Cold';
}

function warmField(composite) {
  if (composite >= 51) return 'Y';
  if (composite >= 26) return 'Maybe';
  return '';
}

// ── File helpers ──
function tryReadCSV(dir, filename) {
  const path = join(dir, filename);
  if (!existsSync(path)) return null;
  try {
    const text = readFileSync(path, 'utf-8');
    const rows = parseCSV(text);
    return { rows, path, filename };
  } catch (err) {
    console.log(`  WARNING: Failed to parse ${filename}: ${err.message}`);
    return null;
  }
}

function makeColMap(headers) {
  const col = {};
  for (let i = 0; i < headers.length; i++) {
    col[headers[i].trim()] = i;
  }
  return col;
}

// ── CLI args ──
const args = process.argv.slice(2);
const exportDirIdx = args.indexOf('--export-dir');
const ownerUrlIdx = args.indexOf('--owner-url');
const outputIdx = args.indexOf('--output');
const limitIdx = args.indexOf('--limit');
const dryRun = args.includes('--dry-run');

if (exportDirIdx < 0 || ownerUrlIdx < 0) {
  console.error('Usage: node extract-warmth-signals.mjs --export-dir <path> --owner-url <url> [--output <path>] [--dry-run] [--limit N]');
  process.exit(1);
}

const EXPORT_DIR = args[exportDirIdx + 1];
const OWNER_URL = args[ownerUrlIdx + 1];
const OWNER_URL_NORM = normalizeLinkedInUrl(OWNER_URL);
const OUTPUT_PATH = outputIdx >= 0 ? args[outputIdx + 1] : join(DATA_DIR, 'linkedingraph_warmth_signals.json');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

if (!existsSync(EXPORT_DIR)) {
  console.error(`ERROR: Export directory not found: ${EXPORT_DIR}`);
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

console.log('LinkedInGraph Warmth Extraction v1.0');
console.log(`Parsing LinkedIn export from: ${EXPORT_DIR}/`);
console.log(`Owner: ${OWNER_URL}`);
if (dryRun) console.log('*** DRY RUN — no output file will be written ***');
if (LIMIT < Infinity) console.log(`Limit: first ${LIMIT} contacts`);
console.log();

const NOW = Date.now();
const filesParsed = [];
const filesMissing = [];

// ── 1. Parse Connections.csv (REQUIRED) ──
// LinkedIn's raw export has a 2-line disclaimer before the header:
//   Line 1: "Notes:"
//   Line 2: "When exporting your connection data..."
//   Line 3: "First Name,Last Name,URL,Email Address,Company,Position,Connected On"
// Skip lines until we find the header row containing "First Name".
const connectionsData = tryReadCSV(EXPORT_DIR, 'Connections.csv');
if (!connectionsData) {
  console.error('FATAL: Connections.csv not found in export directory. Cannot proceed.');
  process.exit(1);
}

// Find the actual header row (skip disclaimer lines)
let headerRowIdx = 0;
for (let r = 0; r < connectionsData.rows.length; r++) {
  const row = connectionsData.rows[r];
  if (row.some(cell => cell.trim() === 'First Name')) {
    headerRowIdx = r;
    break;
  }
}
if (headerRowIdx > 0) {
  console.log(`  (Skipped ${headerRowIdx} disclaimer line(s) in Connections.csv)`);
}

const connHeaders = connectionsData.rows[headerRowIdx];
const connCol = makeColMap(connHeaders);
const connRows = connectionsData.rows.slice(headerRowIdx + 1);
filesParsed.push('Connections.csv');

// Build contact index keyed by normalized URL
// Also build a name-based index for fallback matching (BUG 2: URL slug changes)
const contacts = new Map();
const contactsByName = new Map(); // "first last" -> normUrl (for fallback)
const processCount = Math.min(connRows.length, LIMIT);

for (let i = 0; i < processCount; i++) {
  const row = connRows[i];
  const url = (row[connCol['URL']] || '').trim();
  const normUrl = normalizeLinkedInUrl(url);
  if (!normUrl) continue;

  const firstName = (row[connCol['First Name']] || '').trim();
  const lastName = (row[connCol['Last Name']] || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();

  contacts.set(normUrl, {
    name: fullName,
    firstName,
    lastName,
    company: (row[connCol['Company']] || '').trim(),
    position: (row[connCol['Position']] || '').trim(),
    url: url,
    connectedOn: (row[connCol['Connected On']] || '').trim(),
    // Warmth signals — will be filled in below
    msg_total: 0, msg_sent: 0, msg_received: 0,
    msg_reciprocity: 0, msg_last_date: null, msg_recency_days: 9999,
    endorsements_given: 0, endorsements_received: 0,
    recommendation_given: false, recommendation_received: false,
    invitation_direction: 'unknown', invitation_custom_message: false,
    company_followed: false,
  });

  // Name-based index for fallback matching
  const nameKey = fullName.toLowerCase();
  if (nameKey && !contactsByName.has(nameKey)) {
    contactsByName.set(nameKey, normUrl);
  }
}

console.log(`Files found:`);
console.log(`  ✓ Connections.csv          (${contacts.size} contacts indexed)`);

// ── 2. Parse messages.csv ──
const messagesData = tryReadCSV(EXPORT_DIR, 'messages.csv');
let msgPartnersMatched = 0;

if (messagesData) {
  filesParsed.push('messages.csv');
  const msgHeaders = messagesData.rows[0];
  const msgCol = makeColMap(msgHeaders);
  const msgRows = messagesData.rows.slice(1);

  // Ken's addition: validate parsed row count
  const expectedMessageCount = 19260;
  const actualMessageCount = msgRows.length;
  const discrepancyPct = Math.abs(actualMessageCount - expectedMessageCount) / expectedMessageCount * 100;
  if (discrepancyPct > 1) {
    console.log(`  ⚠ WARNING: messages.csv parsed ${actualMessageCount} rows, expected ~${expectedMessageCount} (${discrepancyPct.toFixed(1)}% discrepancy)`);
    console.log(`    This may indicate parsing issues or a different export. Proceeding with caution.`);
  }

  // Group messages by partner URL
  // BUG 1 FIX: Credit each participant in group conversations individually
  // BUG 2 FIX: Name-based fallback when URL slug has changed
  const partnerMessages = new Map(); // normUrl -> { sent, received, lastDate }
  let nameFallbackHits = 0;

  function resolvePartner(normUrl, displayName) {
    // Direct URL match
    if (normUrl && contacts.has(normUrl)) return normUrl;
    // Name-based fallback (BUG 2: URL slug changes)
    if (displayName) {
      const nameKey = displayName.trim().toLowerCase();
      const fallbackUrl = contactsByName.get(nameKey);
      if (fallbackUrl) {
        nameFallbackHits++;
        return fallbackUrl;
      }
    }
    return null;
  }

  function creditMessage(partnerNormUrl, isFromOwner, msgDate) {
    if (!partnerNormUrl) return;
    if (!partnerMessages.has(partnerNormUrl)) {
      partnerMessages.set(partnerNormUrl, { sent: 0, received: 0, lastDate: null });
    }
    const pm = partnerMessages.get(partnerNormUrl);
    if (isFromOwner) {
      pm.sent++;
    } else {
      pm.received++;
    }
    if (msgDate && (!pm.lastDate || msgDate > pm.lastDate)) {
      pm.lastDate = msgDate;
    }
  }

  for (const row of msgRows) {
    const folder = (row[msgCol['FOLDER']] || '').trim();
    const convTitle = (row[msgCol['CONVERSATION TITLE']] || '').trim();
    const senderUrl = (row[msgCol['SENDER PROFILE URL']] || '').trim();

    // Filter out spam, sponsored, system messages
    if (folder === 'SPAM') continue;
    if (convTitle === 'Sponsored Conversation') continue;
    if (!senderUrl) continue;

    const senderNorm = normalizeLinkedInUrl(senderUrl);
    const recipientUrls = (row[msgCol['RECIPIENT PROFILE URLS']] || '').trim();
    const senderName = (row[msgCol['FROM']] || '').trim();
    const recipientNames = (row[msgCol['TO']] || '').trim();
    const dateStr = (row[msgCol['DATE']] || '').trim();
    const msgDate = dateStr ? new Date(dateStr) : null;

    const isFromOwner = senderNorm === OWNER_URL_NORM;

    if (isFromOwner) {
      // Owner sent → credit ALL recipients (BUG 1: group conversations)
      const recipUrls = recipientUrls.split(',').map(u => u.trim()).filter(Boolean);
      const recipNameList = recipientNames.split(',').map(n => n.trim()).filter(Boolean);

      for (let ri = 0; ri < recipUrls.length; ri++) {
        const ru = normalizeLinkedInUrl(recipUrls[ri]);
        if (ru === OWNER_URL_NORM) continue;
        const displayName = recipNameList[ri] || '';
        const resolved = resolvePartner(ru, displayName);
        if (resolved) creditMessage(resolved, true, msgDate);
      }
    } else {
      // Someone else sent → credit the sender to owner
      const resolved = resolvePartner(senderNorm, senderName);
      if (resolved) creditMessage(resolved, false, msgDate);
    }
  }

  if (nameFallbackHits > 0) {
    console.log(`  (Name-based fallback matched ${nameFallbackHits} messages from changed URL slugs)`);
  }

  // Apply message signals to contacts
  for (const [normUrl, pm] of partnerMessages) {
    const contact = contacts.get(normUrl);
    if (!contact) continue;

    contact.msg_total = pm.sent + pm.received;
    contact.msg_sent = pm.sent;
    contact.msg_received = pm.received;
    contact.msg_reciprocity = (pm.sent > 0 && pm.received > 0)
      ? Math.min(pm.sent, pm.received) / Math.max(pm.sent, pm.received)
      : 0;
    contact.msg_last_date = pm.lastDate;
    contact.msg_recency_days = pm.lastDate
      ? Math.floor((NOW - pm.lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : 9999;
    msgPartnersMatched++;
  }

  console.log(`  ✓ messages.csv             (${actualMessageCount} messages, ${msgPartnersMatched} partners matched)`);
} else {
  filesMissing.push('messages.csv');
  console.log('  ✗ messages.csv             (MISSING — warmth degraded to connection-tenure only)');
}

// ── 3. Parse Endorsement files ──
let endorseGivenMatched = 0;
let endorseReceivedMatched = 0;

const endorseGivenData = tryReadCSV(EXPORT_DIR, 'Endorsement_Given_Info.csv');
if (endorseGivenData) {
  filesParsed.push('Endorsement_Given_Info.csv');
  const egHeaders = endorseGivenData.rows[0];
  const egCol = makeColMap(egHeaders);
  const egRows = endorseGivenData.rows.slice(1);

  // Group by endorsee URL
  const endorseGiven = new Map();
  for (const row of egRows) {
    const endorseeUrl = normalizeLinkedInUrl(row[egCol['Endorsee Public Url']] || '');
    if (!endorseeUrl) continue;
    endorseGiven.set(endorseeUrl, (endorseGiven.get(endorseeUrl) || 0) + 1);
  }

  for (const [normUrl, count] of endorseGiven) {
    const contact = contacts.get(normUrl);
    if (contact) {
      contact.endorsements_given = count;
      endorseGivenMatched++;
    }
  }

  console.log(`  ✓ Endorsement_Given        (${egRows.length} endorsements to ${endorseGiven.size} contacts, ${endorseGivenMatched} matched)`);
} else {
  filesMissing.push('Endorsement_Given_Info.csv');
  console.log('  ✗ Endorsement_Given        (not found)');
}

const endorseReceivedData = tryReadCSV(EXPORT_DIR, 'Endorsement_Received_Info.csv');
if (endorseReceivedData) {
  filesParsed.push('Endorsement_Received_Info.csv');
  const erHeaders = endorseReceivedData.rows[0];
  const erCol = makeColMap(erHeaders);
  const erRows = endorseReceivedData.rows.slice(1);

  const endorseReceived = new Map();
  for (const row of erRows) {
    const endorserUrl = normalizeLinkedInUrl(row[erCol['Endorser Public Url']] || '');
    if (!endorserUrl) continue;
    endorseReceived.set(endorserUrl, (endorseReceived.get(endorserUrl) || 0) + 1);
  }

  for (const [normUrl, count] of endorseReceived) {
    const contact = contacts.get(normUrl);
    if (contact) {
      contact.endorsements_received = count;
      endorseReceivedMatched++;
    }
  }

  console.log(`  ✓ Endorsement_Received     (${erRows.length} endorsements from ${endorseReceived.size} contacts, ${endorseReceivedMatched} matched)`);
} else {
  filesMissing.push('Endorsement_Received_Info.csv');
  console.log('  ✗ Endorsement_Received     (not found)');
}

// ── 4. Parse Recommendation files ──
let recsGivenMatched = 0;
let recsReceivedMatched = 0;

const recsGivenData = tryReadCSV(EXPORT_DIR, 'Recommendations_Given.csv');
if (recsGivenData) {
  filesParsed.push('Recommendations_Given.csv');
  const rgHeaders = recsGivenData.rows[0];
  const rgCol = makeColMap(rgHeaders);
  const rgRows = recsGivenData.rows.slice(1);

  for (const row of rgRows) {
    const first = (row[rgCol['First Name']] || '').trim().toLowerCase();
    const last = (row[rgCol['Last Name']] || '').trim().toLowerCase();
    if (!first && !last) continue;

    // Match by name against contacts (no URL in this file)
    let matched = false;
    for (const contact of contacts.values()) {
      if (contact.firstName.toLowerCase() === first && contact.lastName.toLowerCase() === last) {
        contact.recommendation_given = true;
        matched = true;
        recsGivenMatched++;
        break; // Take first match
      }
    }
    if (!matched) {
      // Try with company tiebreaker
      const recCompany = (row[rgCol['Company']] || '').trim().toLowerCase();
      if (recCompany) {
        for (const contact of contacts.values()) {
          if (contact.firstName.toLowerCase() === first &&
              contact.lastName.toLowerCase() === last &&
              contact.company.toLowerCase().includes(recCompany)) {
            contact.recommendation_given = true;
            recsGivenMatched++;
            break;
          }
        }
      }
    }
  }

  console.log(`  ✓ Recommendations_Given    (${rgRows.length} recommendations, ${recsGivenMatched} matched)`);
} else {
  filesMissing.push('Recommendations_Given.csv');
  console.log('  ✗ Recommendations_Given    (not found)');
}

const recsReceivedData = tryReadCSV(EXPORT_DIR, 'Recommendations_Received.csv');
if (recsReceivedData) {
  filesParsed.push('Recommendations_Received.csv');
  const rrHeaders = recsReceivedData.rows[0];
  const rrCol = makeColMap(rrHeaders);
  const rrRows = recsReceivedData.rows.slice(1);

  for (const row of rrRows) {
    const first = (row[rrCol['First Name']] || '').trim().toLowerCase();
    const last = (row[rrCol['Last Name']] || '').trim().toLowerCase();
    if (!first && !last) continue;

    for (const contact of contacts.values()) {
      if (contact.firstName.toLowerCase() === first && contact.lastName.toLowerCase() === last) {
        contact.recommendation_received = true;
        recsReceivedMatched++;
        break;
      }
    }
  }

  console.log(`  ✓ Recommendations_Received (${rrRows.length} recommendations, ${recsReceivedMatched} matched)`);
} else {
  filesMissing.push('Recommendations_Received.csv');
  console.log('  ✗ Recommendations_Received (not found)');
}

// ── 5. Parse Invitations.csv ──
let invitationsMatched = 0;

const invitationsData = tryReadCSV(EXPORT_DIR, 'Invitations.csv');
if (invitationsData) {
  filesParsed.push('Invitations.csv');
  const invHeaders = invitationsData.rows[0];
  const invCol = makeColMap(invHeaders);
  const invRows = invitationsData.rows.slice(1);

  for (const row of invRows) {
    const directionField = (row[invCol['Direction']] || '').trim().toUpperCase();
    const inviterUrl = normalizeLinkedInUrl(row[invCol['inviterProfileUrl']] || '');
    const inviteeUrl = normalizeLinkedInUrl(row[invCol['inviteeProfileUrl']] || '');
    const message = (row[invCol['Message']] || '').trim();

    // BUG 3 FIX: Use Direction column directly, check BOTH URL columns
    let partnerNorm = null;
    let direction = 'unknown';

    if (directionField === 'OUTGOING') {
      // Owner sent invitation → partner is invitee
      partnerNorm = inviteeUrl;
      direction = message ? 'outgoing_custom' : 'outgoing';
    } else if (directionField === 'INCOMING') {
      // Partner sent invitation → partner is inviter
      partnerNorm = inviterUrl;
      direction = 'incoming';
    } else {
      // Fallback: infer from URL matching
      if (inviterUrl === OWNER_URL_NORM && inviteeUrl) {
        partnerNorm = inviteeUrl;
        direction = message ? 'outgoing_custom' : 'outgoing';
      } else if (inviteeUrl === OWNER_URL_NORM && inviterUrl) {
        partnerNorm = inviterUrl;
        direction = 'incoming';
      }
    }

    if (!partnerNorm) continue;

    const contact = contacts.get(partnerNorm);
    if (contact) {
      contact.invitation_direction = direction;
      contact.invitation_custom_message = !!message;
      invitationsMatched++;
    }
  }

  console.log(`  ✓ Invitations.csv          (${invRows.length} invitations, ${invitationsMatched} matched)`);
} else {
  filesMissing.push('Invitations.csv');
  console.log('  ✗ Invitations.csv          (not found)');
}

// ── 6. Parse Company Follows.csv ──
let companyFollowsMatched = 0;

const companyFollowsData = tryReadCSV(EXPORT_DIR, 'Company Follows.csv');
if (companyFollowsData) {
  filesParsed.push('Company Follows.csv');
  const cfHeaders = companyFollowsData.rows[0];
  const cfCol = makeColMap(cfHeaders);
  const cfRows = companyFollowsData.rows.slice(1);

  // Build set of followed company names (normalized)
  const followedCompanies = new Set();
  for (const row of cfRows) {
    const org = normalizeCompany(row[cfCol['Organization']] || '');
    if (org) followedCompanies.add(org);
  }

  // Match contacts whose company is in the followed set
  for (const contact of contacts.values()) {
    const normCo = normalizeCompany(contact.company);
    if (normCo && followedCompanies.has(normCo)) {
      contact.company_followed = true;
      companyFollowsMatched++;
    }
  }

  console.log(`  ✓ Company Follows.csv      (${cfRows.length} companies followed, ${companyFollowsMatched} contacts at followed companies)`);
} else {
  filesMissing.push('Company Follows.csv');
  console.log('  ✗ Company Follows.csv      (not found)');
}

// Check for Events.csv (not scored in v1.0)
if (existsSync(join(EXPORT_DIR, 'Events.csv'))) {
  console.log('  ○ Events.csv               (present but not scored in v1.0)');
} else {
  console.log('  ✗ Events.csv               (not found)');
}

// ── Determine available dimensions ──
const availableDims = new Set();
if (messagesData) {
  availableDims.add('message_count');
  availableDims.add('reciprocity');
  availableDims.add('recency');
}
if (endorseGivenData || endorseReceivedData) {
  availableDims.add('endorsements');
}
if (recsGivenData || recsReceivedData) {
  availableDims.add('recommendations');
}
if (invitationsData) {
  availableDims.add('invitation');
}
if (companyFollowsData) {
  availableDims.add('company_follow');
}

console.log(`\n  Warmth dimensions available: ${availableDims.size}/7`);
if (availableDims.size < 7) {
  const missing = Object.keys(WEIGHTS).filter(d => !availableDims.has(d));
  console.log(`  Missing dimensions: ${missing.join(', ')} — weight redistributed`);
}

// ── Compute composite scores ──
console.log('\nComputing composite scores...');

const scoreDist = { hot: 0, strong: 0, warm: 0, cold: 0, zero: 0 };
const contactsOutput = {};
let contactsWithWarmth = 0;

for (const [normUrl, contact] of contacts) {
  const dimensions = {
    message_count: {
      raw: contact.msg_total,
      score: availableDims.has('message_count') ? scoreDimension('message_count', contact.msg_total) : 0,
    },
    reciprocity: {
      raw: Math.round(contact.msg_reciprocity * 100) / 100,
      score: availableDims.has('reciprocity') ? scoreDimension('reciprocity', contact.msg_reciprocity) : 0,
    },
    recency: {
      raw: contact.msg_recency_days,
      score: availableDims.has('recency') ? scoreDimension('recency', contact.msg_recency_days) : 0,
    },
    endorsements: {
      raw: { given: contact.endorsements_given, received: contact.endorsements_received },
      score: availableDims.has('endorsements')
        ? scoreDimension('endorsements', { given: contact.endorsements_given, received: contact.endorsements_received })
        : 0,
    },
    recommendations: {
      raw: { given: contact.recommendation_given, received: contact.recommendation_received },
      score: availableDims.has('recommendations')
        ? scoreDimension('recommendations', { given: contact.recommendation_given, received: contact.recommendation_received })
        : 0,
    },
    invitation: {
      raw: contact.invitation_direction,
      score: availableDims.has('invitation') ? scoreDimension('invitation', contact.invitation_direction) : 0,
    },
    company_follow: {
      raw: contact.company_followed,
      score: availableDims.has('company_follow') ? scoreDimension('company_follow', contact.company_followed) : 0,
    },
  };

  const composite = computeComposite(dimensions, availableDims);
  const label = warmthLabel(composite);
  const warm = warmField(composite);

  if (composite > 0) {
    contactsWithWarmth++;
    contactsOutput[contact.url] = {
      name: contact.name,
      company: contact.company,
      warmth_composite: composite,
      warmth_label: label,
      warm_field: warm,
      dimensions,
      notes: contact.msg_total > 0
        ? `${contact.msg_total} msgs (${contact.msg_sent} sent, ${contact.msg_received} received), last: ${contact.msg_last_date ? contact.msg_last_date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}`
        : '',
    };
  }

  if (composite >= 76) scoreDist.hot++;
  else if (composite >= 51) scoreDist.strong++;
  else if (composite >= 26) scoreDist.warm++;
  else if (composite >= 1) scoreDist.cold++;
  else scoreDist.zero++;
}

console.log(`  Hot (76-100):    ${scoreDist.hot} contacts`);
console.log(`  Strong (51-75):  ${scoreDist.strong} contacts`);
console.log(`  Warm (26-50):    ${scoreDist.warm} contacts`);
console.log(`  Cold (1-25):     ${scoreDist.cold} contacts`);
console.log(`  No signal (0):   ${scoreDist.zero} contacts`);

// ── Top 10 ──
const sorted = Object.entries(contactsOutput)
  .sort((a, b) => b[1].warmth_composite - a[1].warmth_composite)
  .slice(0, 10);

console.log('\nTop 10 by warmth:');
sorted.forEach(([url, c], i) => {
  const signals = [];
  if (c.dimensions.message_count.raw > 0) signals.push(`${c.dimensions.message_count.raw} msgs`);
  if (c.dimensions.endorsements.raw.given > 0 || c.dimensions.endorsements.raw.received > 0) {
    const mutual = c.dimensions.endorsements.raw.given > 0 && c.dimensions.endorsements.raw.received > 0;
    signals.push(mutual ? 'mutual endorsement' : `${c.dimensions.endorsements.raw.given}G/${c.dimensions.endorsements.raw.received}R endorse`);
  }
  if (c.dimensions.recommendations.raw.given || c.dimensions.recommendations.raw.received) {
    const mutual = c.dimensions.recommendations.raw.given && c.dimensions.recommendations.raw.received;
    signals.push(mutual ? 'mutual rec' : c.dimensions.recommendations.raw.given ? 'rec given' : 'rec received');
  }
  if (c.dimensions.invitation.raw.startsWith('outgoing')) signals.push('outgoing invite');
  if (c.dimensions.company_follow.raw) signals.push('company followed');

  const pad = String(i + 1).padStart(2);
  const name = c.name.padEnd(25);
  console.log(`  ${pad}. ${name} — ${c.warmth_composite}  (${signals.join(', ')})`);
});

// ── Write output ──
const output = {
  meta: {
    generated_at: new Date().toISOString(),
    owner_url: OWNER_URL,
    export_dir: EXPORT_DIR,
    files_parsed: filesParsed,
    files_missing: filesMissing,
    dimensions_available: availableDims.size,
    total_contacts: contacts.size,
    contacts_with_warmth: contactsWithWarmth,
  },
  contacts: contactsOutput,
};

if (dryRun) {
  console.log(`\n*** DRY RUN — would write ${contactsWithWarmth} contacts to ${OUTPUT_PATH} ***`);
} else {
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nOutput: ${OUTPUT_PATH} (${contactsWithWarmth} contacts with warmth > 0)`);
}
