/**
 * Lead Import API — parse Excel/CSV files and import into opportunities table
 *
 * GET  /api/leads/template — download import template
 * POST /api/leads/parse    — upload file, return headers + preview + suggested mapping
 * POST /api/leads/import   — insert mapped rows into opportunities
 *
 * Uses raw Node HTTP response methods (statusCode + end) for Vite dev compatibility.
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { getSupabase } from '../lib/supabase.js';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Response helpers (compatible with both Express and raw Node HTTP)
// ---------------------------------------------------------------------------

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// State normalization
// ---------------------------------------------------------------------------

const STATE_MAP = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

function normalizeState(state) {
  if (!state) return null;
  const trimmed = state.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  const lookup = STATE_MAP[trimmed.toLowerCase()];
  return lookup || trimmed;
}

// ---------------------------------------------------------------------------
// Country normalization — ISO 3166-1 alpha-2
// ---------------------------------------------------------------------------

const COUNTRY_MAP = {
  'us': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US',
  'united states': 'US', 'united states of america': 'US', 'america': 'US',
  'ca': 'CA', 'canada': 'CA',
  'mx': 'MX', 'mexico': 'MX',
  'uk': 'GB', 'gb': 'GB', 'united kingdom': 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB',
  'au': 'AU', 'australia': 'AU',
  'de': 'DE', 'germany': 'DE',
  'fr': 'FR', 'france': 'FR',
  'jp': 'JP', 'japan': 'JP',
  'cn': 'CN', 'china': 'CN',
  'in': 'IN', 'india': 'IN',
};

function normalizeCountry(country) {
  if (!country) return null;
  const trimmed = String(country).trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  const lookup = COUNTRY_MAP[trimmed.toLowerCase().replace(/\./g, '.').replace(/\s+/g, ' ')];
  return lookup || trimmed;
}

function cleanPhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  return trimmed || null;
}

// ---------------------------------------------------------------------------
// Tenant-specific custom-field pattern (Bucket 2)
//
// Schema: tenants.preferences.custom_lead_fields = {
//   namespace: "xencelabs_icp_signals",
//   mappings: [
//     { field: "software_used",   header_patterns: ["softwareused", "software", ...] },
//     { field: "pen_tablet_used", header_patterns: ["pentabletdisplayused", "tablet", ...] }
//   ]
// }
//
// Matched columns route to opportunities.enrichment_data[namespace][field].
// Single namespace per tenant (v1 design — array shape deferred until needed).
// ---------------------------------------------------------------------------

async function loadTenantCustomFields(tenantId) {
  if (!tenantId) return null;
  try {
    const { data, error } = await getSupabase()
      .from('tenants')
      .select('preferences')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw error;
    const cfg = data?.preferences?.custom_lead_fields;
    if (!cfg || !cfg.namespace || !Array.isArray(cfg.mappings) || cfg.mappings.length === 0) {
      return null;
    }
    return cfg;
  } catch (err) {
    console.error('[lead-import] loadTenantCustomFields failed:', err.message);
    return null;
  }
}

// Returns { byHeader: {header -> customFieldName}, matchedFields: [...] }.
// The parse preview uses this to show the custom-mapped bucket; the import
// uses it to route values into enrichment_data[namespace].
function applyCustomMapping(headers, customFields) {
  const byHeader = {};
  const matchedFields = [];
  if (!customFields?.mappings?.length) return { byHeader, matchedFields };

  const normalizedHeaders = headers.map(h => ({
    raw: h,
    norm: String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  }));

  for (const m of customFields.mappings) {
    const patterns = (m.header_patterns || []).map(p => String(p).toLowerCase().replace(/[^a-z0-9]/g, ''));
    const hit = normalizedHeaders.find(h => patterns.includes(h.norm));
    if (hit) {
      byHeader[hit.raw] = m.field;
      matchedFields.push(m.field);
    }
  }
  return { byHeader, matchedFields };
}

// ---------------------------------------------------------------------------
// Auto column mapping (keyword-based)
// ---------------------------------------------------------------------------

function autoMapColumns(headers) {
  const mapping = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const rules = [
    { target: 'contact_first_name', patterns: ['firstname', 'first', 'fname', 'givenname', 'contactfirstname'] },
    { target: 'contact_last_name', patterns: ['lastname', 'last', 'lname', 'surname', 'contactlastname'] },
    { target: 'contact_full_name', patterns: ['name', 'fullname', 'contactname', 'contact'] },
    { target: 'contact_email', patterns: ['email', 'emailaddress', 'contactemail'] },
    { target: 'contact_title', patterns: ['jobtitle', 'title', 'position', 'role', 'contacttitle'] },
    { target: 'company_name', patterns: ['companyname', 'company', 'companies', 'organization', 'org', 'account', 'accountname'] },
    { target: 'industry', patterns: ['industry', 'vertical', 'sector'] },
    { target: 'state', patterns: ['stateregion', 'state', 'region', 'province'] },
    { target: 'source_campaign', patterns: ['campaign', 'sourcecampaign', 'leadsource', 'tradeshowattended', '2025tradeshowattended'] },
    { target: 'lifecycle_stage', patterns: ['lifecyclestage', 'stage', 'status', 'leadstatus'] },
    { target: 'school_type', patterns: ['schooltype', 'zspaceschooltype', 'institutiontype'] },
    { target: 'email_domain', patterns: ['emaildomain', 'domain'] },
    { target: 'mql_date', patterns: ['mqldate', 'createdat', 'createddate', 'date', 'becameamarketingqualifiedleaddate'] },
    { target: 'notes', patterns: ['notes', 'comments', 'description'] },
    // Universal Bucket 1 (added 2026-04-20) — city/country/phone first-class
    { target: 'city', patterns: ['city', 'town', 'municipality', 'locality'] },
    { target: 'country', patterns: ['country', 'nation', 'countrycode', 'countryregion'] },
    { target: 'phone', patterns: ['phone', 'phonenumber', 'tel', 'telephone', 'mobile', 'contactphone', 'cell'] },
  ];

  for (const rule of rules) {
    const matchIndex = normalizedHeaders.findIndex(h => rule.patterns.includes(h));
    if (matchIndex !== -1) {
      mapping[headers[matchIndex]] = rule.target;
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// LLM-powered smart column mapper (fallback when keyword mapper gets < 3 matches)
// ---------------------------------------------------------------------------

let _anthropic = null;

function getAnthropicClient() {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY. Set it in .env.local.');
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

async function smartMapColumns(headers, sampleRows) {
  try {
    const anthropic = getAnthropicClient();

    const samples = sampleRows.slice(0, 3).map((row, i) => {
      const values = headers.map(h => row[h] ?? '(empty)');
      return `Row ${i + 1}: ${values.join(' | ')}`;
    }).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a data mapping assistant for a B2B sales platform. Given these spreadsheet column headers and sample data, map each column to the closest Plexify field.

Headers: ${headers.join(' | ')}

${samples}

Available Plexify fields (pick exactly one per column):
- first_name — person's first/given name
- last_name — person's last/family name
- company_name — organization, company, account, employer
- email — email address
- job_title — role, position, title, designation
- state — US state, region, province, geographic location
- city — city, town, municipality
- country — country name or ISO code
- phone — phone number (any format)
- industry — business vertical, sector, market segment
- source_campaign — lead source, campaign name, event, trade show, how they were acquired
- notes — any freeform text, comments, conversation notes
- lifecycle_stage — lead status, pipeline stage, lead score label
- skip — column has no useful mapping (internal IDs, timestamps, marketing metrics, etc.)

Rules:
- If a column contains a full name (first + last combined), map it to "full_name"
- If a column clearly contains dates, map to "mql_date"
- If unsure, use "skip" rather than guessing wrong
- Every header MUST have a mapping

Return ONLY a valid JSON object. No markdown. No explanation.
Example: {"First Name": "first_name", "Company": "company_name", "Internal ID": "skip"}`
      }],
    });

    const text = response.content[0]?.text?.trim();
    const mapping = JSON.parse(text);

    // Convert LLM field names to our internal target names
    const fieldMap = {
      'first_name': 'contact_first_name',
      'last_name': 'contact_last_name',
      'full_name': 'contact_full_name',
      'company_name': 'company_name',
      'email': 'contact_email',
      'job_title': 'contact_title',
      'state': 'state',
      'city': 'city',
      'country': 'country',
      'phone': 'phone',
      'industry': 'industry',
      'source_campaign': 'source_campaign',
      'notes': 'notes',
      'lifecycle_stage': 'lifecycle_stage',
      'mql_date': 'mql_date',
      'skip': null,
    };

    const result = {};
    for (const [header, llmField] of Object.entries(mapping)) {
      if (llmField in fieldMap) {
        result[header] = fieldMap[llmField];
      }
    }

    return { mapping: result, source: 'ai' };
  } catch (err) {
    console.error('Smart mapper LLM call failed:', err.message);
    return { mapping: {}, source: 'error' };
  }
}

// ---------------------------------------------------------------------------
// Contact name builder — handles nulls, junk, extra whitespace
// ---------------------------------------------------------------------------

function buildContactName(firstName, lastName) {
  const clean = (v) => {
    if (v === null || v === undefined) return '';
    return String(v).replace(/\s+/g, ' ').trim();
  };
  const f = clean(firstName);
  const l = clean(lastName);
  if (f && l) return `${f} ${l}`;
  if (f) return f;
  if (l) return l;
  return null;
}

// ---------------------------------------------------------------------------
// Clean job title — remove junk entries
// ---------------------------------------------------------------------------

function cleanTitle(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length < 3) return null;
  if (/^(Mr|Mrs|Ms|Miss|Dr|Prof)\.?$/i.test(trimmed)) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Parse file contents
// ---------------------------------------------------------------------------

function parseFileBuffer(buffer, ext) {
  if (['xlsx', 'xls'].includes(ext)) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const nonEmptyRows = jsonData.filter(row =>
      Object.values(row).some(v => v !== null && v !== '' && v !== undefined)
    );
    return nonEmptyRows;
  } else {
    const csvString = buffer.toString('utf-8');
    const parsed = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    return parsed.data;
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads/template — download import template
// ---------------------------------------------------------------------------

export async function handleTemplate(req, res) {
  try {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'Plexify_Lead_Import_Template.xlsx');

    if (!fs.existsSync(templatePath)) {
      return sendJson(res, 404, { error: 'Template not found' });
    }

    const stat = fs.statSync(templatePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Plexify_Lead_Import_Template.xlsx"');
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(templatePath).pipe(res);
  } catch (err) {
    console.error('Template download error:', err);
    return sendJson(res, 500, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/leads/parse
// ---------------------------------------------------------------------------

export async function handleParse(req, res) {
  try {
    if (!req.file) {
      return sendJson(res, 400, { error: 'No file uploaded' });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const allRows = parseFileBuffer(req.file.buffer, ext);

    if (!allRows || allRows.length === 0) {
      return sendJson(res, 400, { error: 'No data found in file' });
    }

    const headers = Object.keys(allRows[0] || {});
    const previewRows = allRows.slice(0, 10);
    const totalRows = allRows.length;

    // Auto-detect standard column mapping — keyword first, LLM fallback
    let suggestedMapping = autoMapColumns(headers);
    let mappingSource = 'keyword';

    // Count confident matches (non-null values)
    const confidentMatches = Object.values(suggestedMapping).filter(v => v !== null && v !== undefined).length;

    // If keyword mapper got fewer than 3 matches, try LLM
    if (confidentMatches < 3 && previewRows.length > 0) {
      console.log(`Keyword mapper only found ${confidentMatches} matches. Trying smart mapper...`);
      const smartResult = await smartMapColumns(headers, previewRows);
      if (Object.keys(smartResult.mapping).length >= 3) {
        suggestedMapping = smartResult.mapping;
        mappingSource = smartResult.source; // 'ai'
        console.log(`Smart mapper found ${Object.keys(smartResult.mapping).length} matches`);
      }
    }

    // Tenant-specific custom fields (Bucket 2). Silent — no UX badge per plan.
    const customFields = await loadTenantCustomFields(req.tenant?.id);
    const { byHeader: customMapping } = applyCustomMapping(headers, customFields);

    // Unmapped bucket = any header not in standard OR custom mapping.
    const mappedHeaders = new Set([
      ...Object.entries(suggestedMapping).filter(([, v]) => v).map(([h]) => h),
      ...Object.keys(customMapping),
    ]);
    const unmapped = headers.filter(h => !mappedHeaders.has(h));

    return sendJson(res, 200, {
      success: true,
      filename: req.file.originalname,
      fileType: ext,
      headers,
      previewRows,
      totalRows,
      suggestedMapping,
      mappingSource,
      customMapping,
      customNamespace: customFields?.namespace || null,
      unmapped,
      allData: totalRows <= 5000 ? allRows : null,
      truncated: totalRows > 5000,
    });
  } catch (err) {
    console.error('Lead parse error:', err);
    return sendJson(res, 500, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/leads/import
// ---------------------------------------------------------------------------

export async function handleImport(req, res) {
  try {
    const {
      rows,
      mapping,
      sourceType,
      options = {},
    } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return sendJson(res, 400, { error: 'No rows to import' });
    }

    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return sendJson(res, 401, { error: 'Not authenticated' });
    }

    const supabase = getSupabase();

    // Tenant-specific custom fields (Bucket 2) — resolved per-request so
    // tenants that toggle their config mid-session don't need a restart.
    const customFields = await loadTenantCustomFields(tenantId);

    // 1. Get existing emails for dedup
    const { data: existingOpps } = await supabase
      .from('opportunities')
      .select('contact_email')
      .eq('tenant_id', tenantId)
      .not('contact_email', 'is', null);

    const existingEmails = new Set(
      (existingOpps || []).map(o => o.contact_email?.toLowerCase().trim())
    );

    let imported = 0;
    let skippedNoEmail = 0;
    let skippedDuplicate = 0;
    let skippedError = 0;
    const errors = [];

    // 2. Build insert rows with reverse mapping
    const reverseMap = {};
    for (const [header, target] of Object.entries(mapping)) {
      if (target && target !== 'skip') {
        reverseMap[target] = header;
      }
    }

    const toInsert = [];

    for (const rawRow of rows) {
      const getValue = (targetField) => {
        const header = reverseMap[targetField];
        if (!header) return null;
        const val = rawRow[header];
        if (val === null || val === undefined || val === '') return null;
        return options.trimWhitespace ? String(val).trim() : String(val);
      };

      const email = getValue('contact_email')?.toLowerCase() || null;

      if (options.skipNoEmail && !email) {
        skippedNoEmail++;
        continue;
      }

      if (options.skipDuplicates && email && existingEmails.has(email)) {
        skippedDuplicate++;
        continue;
      }

      // Handle full_name → split into first + last
      let firstName = getValue('contact_first_name');
      let lastName = getValue('contact_last_name');
      const fullName = getValue('contact_full_name');
      if (fullName && !firstName) {
        const parts = fullName.toString().trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      const contactName = buildContactName(firstName, lastName);

      // Company name → account_name (required NOT NULL field)
      // Clean multi-company values: '"Acuity Brands","Lithonia Lighting"' → 'Acuity Brands'
      let accountName = getValue('company_name');
      if (accountName) {
        // Handle quoted CSV-style lists: take the first company
        if (accountName.includes('","') || (accountName.startsWith('"') && accountName.endsWith('"'))) {
          const parts = accountName.split('","').map(s => s.replace(/^"|"$/g, '').trim());
          accountName = parts[0] || accountName;
        }
        accountName = accountName.replace(/^"|"$/g, '').trim();
      }
      if (!accountName) {
        skippedError++;
        continue;
      }

      let state = getValue('state');
      if (options.normalizeStates && state) {
        state = normalizeState(state);
      }

      const title = cleanTitle(getValue('contact_title'));

      let mqlDate = getValue('mql_date');
      if (mqlDate) {
        const parsed = new Date(mqlDate);
        mqlDate = isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }

      // Universal Bucket 1 (added 2026-04-20) — normalized city/country/phone.
      const city = getValue('city') || null;
      const country = normalizeCountry(getValue('country'));
      const phone = cleanPhone(getValue('phone'));

      // Tenant-specific custom fields (Bucket 2) → enrichment_data[namespace].
      // Silent: if config is present AND any configured field has a value,
      // we write under a single namespaced key. Empty values are omitted so
      // downstream readers can .has() check safely.
      let enrichmentData = null;
      if (customFields?.namespace && customFields?.mappings?.length) {
        const bucket = {};
        const { byHeader } = applyCustomMapping(Object.keys(rawRow), customFields);
        // byHeader is {rawHeader -> fieldName}. Use rawRow directly since
        // handleImport receives rows keyed by original headers.
        for (const [rawHeader, fieldName] of Object.entries(byHeader)) {
          const raw = rawRow[rawHeader];
          const val = (raw === null || raw === undefined) ? null : String(raw).trim();
          if (val) bucket[fieldName] = val;
        }
        if (Object.keys(bucket).length > 0) {
          enrichmentData = { [customFields.namespace]: bucket };
        }
      }

      toInsert.push({
        tenant_id: tenantId,
        account_name: accountName,
        contact_name: contactName,
        contact_email: email,
        contact_title: title,
        industry: getValue('industry'),
        state: state,
        city: city,
        country: country,
        phone: phone,
        source_type: sourceType || null,
        source_campaign: getValue('source_campaign'),
        lifecycle_stage: getValue('lifecycle_stage'),
        mql_date: mqlDate,
        school_type: getValue('school_type'),
        warmth_score: 0,
        stage: 'imported',
        ...(enrichmentData ? { enrichment_data: enrichmentData } : {}),
      });

      if (email) existingEmails.add(email);
    }

    if (toInsert.length === 0) {
      return sendJson(res, 200, {
        success: true,
        imported: 0,
        skippedNoEmail,
        skippedDuplicate,
        skippedError,
        total: rows.length,
        message: 'No valid leads to import after filtering',
      });
    }

    // 3. Batch insert (100 at a time)
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('opportunities')
        .insert(batch);

      if (error) {
        skippedError += batch.length;
        errors.push({ batch: Math.floor(i / BATCH_SIZE), error: error.message });
        console.error(`Lead import batch ${Math.floor(i / BATCH_SIZE)} error:`, error.message);
      } else {
        imported += batch.length;
      }
    }

    return sendJson(res, 200, {
      success: true,
      imported,
      skippedNoEmail,
      skippedDuplicate,
      skippedError,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Lead import error:', err);
    return sendJson(res, 500, { error: err.message });
  }
}
