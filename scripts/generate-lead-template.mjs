/**
 * Generate the Plexify Lead Import Template XLSX file.
 * Run: node scripts/generate-lead-template.mjs
 *
 * Creates public/templates/Plexify_Lead_Import_Template.xlsx with:
 * - Sheet 1: "Lead Import Template" — headers + 2 example rows
 * - Sheet 2: "Field Guide" — column documentation
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Sheet 1: Lead Import Template
const templateData = [
  // Header row
  ['First Name', 'Last Name', 'Email', 'Job Title', 'Company Name', 'Industry', 'State', 'Source Campaign', 'Lifecycle Stage', 'Notes'],
  // Example rows
  ['Jane', 'Doe', 'jane.doe@acme.com', 'VP of Sales', 'Acme Corporation', 'Technology', 'NY', 'Webinar March 2026', 'MQL', 'Met at trade show booth'],
  ['Bob', 'Smith', 'bob@initech.com', 'Director of Engineering', 'Initech LLC', 'Manufacturing', 'CA', 'Cold Outbound', 'Lead', ''],
];

// Sheet 2: Field Guide
const fieldGuideData = [
  ['Column', 'Required', 'Description', 'Examples'],
  ['First Name', 'Recommended', 'Contact first/given name. If you only have a full name, use a single "Full Name" column instead.', 'Jane, Bob, Maria'],
  ['Last Name', 'Recommended', 'Contact last/family name.', 'Doe, Smith, Garcia'],
  ['Email', 'Recommended', 'Work email address. Used for deduplication.', 'jane@acme.com'],
  ['Job Title', 'Optional', 'Role, position, or designation at the company.', 'VP Sales, Director of Ops, Engineer'],
  ['Company Name', 'Required', 'Organization or account name. Rows without this will be skipped.', 'Acme Corp, Initech LLC'],
  ['Industry', 'Optional', 'Business vertical or sector.', 'Technology, Manufacturing, Healthcare'],
  ['State', 'Optional', 'US state or region. Full names auto-normalize to 2-letter codes.', 'NY, California, TX'],
  ['Source Campaign', 'Optional', 'Where the lead was acquired. Campaign, event, trade show.', 'Webinar Q1, NAB 2026, Cold List'],
  ['Lifecycle Stage', 'Optional', 'Lead status or pipeline stage.', 'Lead, MQL, SQL, Qualified'],
  ['Notes', 'Optional', 'Any freeform comments or conversation notes.', 'Met at booth, requested demo'],
  ['', '', '', ''],
  ['TIPS', '', '', ''],
  ['1. Column order does not matter — Plexify auto-maps by header name.', '', '', ''],
  ['2. If headers are ambiguous, Plexify uses AI to suggest mappings. You can always adjust before importing.', '', '', ''],
  ['3. A single "Full Name" or "Contact" column works too — it will be split into first + last automatically.', '', '', ''],
  ['4. You can add extra columns (they will be available to map to Notes or skip).', '', '', ''],
  ['5. Maximum 5,000 rows per import. For larger files, split into batches.', '', '', ''],
];

// Create workbook
const wb = XLSX.utils.book_new();

// Sheet 1
const ws1 = XLSX.utils.aoa_to_sheet(templateData);
// Set column widths
ws1['!cols'] = [
  { wch: 14 }, // First Name
  { wch: 14 }, // Last Name
  { wch: 24 }, // Email
  { wch: 26 }, // Job Title
  { wch: 22 }, // Company Name
  { wch: 16 }, // Industry
  { wch: 8 },  // State
  { wch: 22 }, // Source Campaign
  { wch: 16 }, // Lifecycle Stage
  { wch: 30 }, // Notes
];
XLSX.utils.book_append_sheet(wb, ws1, 'Lead Import Template');

// Sheet 2
const ws2 = XLSX.utils.aoa_to_sheet(fieldGuideData);
ws2['!cols'] = [
  { wch: 20 }, // Column
  { wch: 14 }, // Required
  { wch: 60 }, // Description
  { wch: 36 }, // Examples
];
XLSX.utils.book_append_sheet(wb, ws2, 'Field Guide');

// Write file
const outDir = path.join(process.cwd(), 'public', 'templates');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'Plexify_Lead_Import_Template.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`Template written to ${outPath}`);
