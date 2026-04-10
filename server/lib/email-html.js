/**
 * PlexifySOLO — Email HTML utilities
 *
 * Wraps outgoing email body HTML in a proper email template:
 *  - White background, dark text (readable in any email client)
 *  - Strips light/gray inline colors that become invisible on white
 *  - Appends the tenant's email signature from preferences
 *
 * Used by saveDraftDirect() and saveDraftToProvider() — the two
 * chokepoints before any email reaches Gmail/Outlook.
 */

import { getSupabase } from './supabase.js';

/**
 * Fetch tenant preferences from the database.
 * Returns {} if no preferences exist.
 */
async function getTenantPreferences(tenantId) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tenants')
      .select('preferences')
      .eq('id', tenantId)
      .single();
    if (error || !data) return {};
    return data.preferences || {};
  } catch {
    return {};
  }
}

/**
 * Replace inline color styles that are too light (would be invisible on white bg).
 * Converts any hex color lighter than #999999 to #1a1a1a.
 * Also handles rgb() colors.
 */
function enforceReadableColors(html) {
  if (!html) return html;

  // Fix hex colors
  const fixed = html.replace(/color:\s*#([a-fA-F0-9]{6})/g, (match, hex) => {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // If any channel > 0x99 and average brightness > 153 (~60%), it's too light
    const avg = (r + g + b) / 3;
    if (avg > 153) return 'color: #1a1a1a';
    return match;
  });

  // Fix rgb() colors
  return fixed.replace(/color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, (match, r, g, b) => {
    const avg = (parseInt(r) + parseInt(g) + parseInt(b)) / 3;
    if (avg > 153) return 'color: #1a1a1a';
    return match;
  });
}

/**
 * Wrap email body HTML in a proper email template.
 *
 * @param {string} bodyHtml - The raw email body HTML
 * @param {string} tenantId - Tenant UUID (used to fetch signature from preferences)
 * @returns {Promise<string>} - Full email HTML ready for Gmail/Outlook
 */
export async function wrapEmailHtml(bodyHtml, tenantId) {
  const prefs = await getTenantPreferences(tenantId);
  const signature = prefs.email_signature || '';

  // Enforce readable colors on the body
  const readableBody = enforceReadableColors(bodyHtml || '');

  // Build the full email HTML
  const parts = [readableBody];

  // Append signature with separator
  if (signature) {
    parts.push('<br/><br/>');
    parts.push(signature);
  }

  return `<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; background-color: #ffffff; padding: 16px; margin: 0;">
${parts.join('\n')}
</body>
</html>`;
}

/**
 * Format the tenant's price list as a clean HTML table for email embedding.
 *
 * @param {Array} priceList - Array of { product, sku, msrp, map, category }
 * @param {string} priceColumn - Which price to show: 'map' or 'msrp'
 * @returns {string} HTML table string
 */
export function formatPriceListHtml(priceList, priceColumn = 'map') {
  if (!priceList || priceList.length === 0) return '';

  const priceLabel = priceColumn === 'msrp' ? 'MSRP' : 'Price';

  const rows = priceList.map(item => {
    const price = priceColumn === 'msrp' ? item.msrp : item.map;
    return `<tr>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.product}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb;">${item.sku || ''}</td>
      <td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${price || ''}</td>
    </tr>`;
  }).join('\n');

  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; margin: 16px 0;">
  <thead>
    <tr style="background-color: #f3f4f6;">
      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Product</th>
      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">SKU</th>
      <th style="padding: 8px 12px; text-align: left; border-bottom: 2px solid #d1d5db;">${priceLabel}</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
}
