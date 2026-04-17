/**
 * PlexifySOLO — Public-data lookup routes (Sprint E / E3)
 *
 * GET /api/data/oz-tract/:tractId               — IRS OZ designation status
 * GET /api/data/oz-lookup?address=...           — address → tract (not impl yet)
 * GET /api/data/tract-demographics/:tractId     — Census ACS 5yr
 *
 * These endpoints wrap server/data/*.mjs. They are tenant-auth gated (same
 * pattern as other protected routes) but the data is public — no PII.
 */

import { isOzDesignated, lookupByAddress } from '../data/oz_tracts.mjs';
import { getTractDemographics } from '../data/acs.mjs';

function sendJSON(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleGetOzTract(req, res, tractId) {
  if (!req.tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  try {
    const result = await isOzDesignated(tractId);
    sendJSON(res, 200, result);
  } catch (err) {
    console.error('[data/oz-tract]', err.message);
    sendJSON(res, 500, { error: err.message });
  }
}

export async function handleOzLookup(req, res) {
  if (!req.tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  try {
    const url = new URL(req.url, 'http://local');
    const address = url.searchParams.get('address') || '';
    if (!address) return sendJSON(res, 400, { error: 'address is required' });
    const result = await lookupByAddress(address);
    sendJSON(res, 200, result);
  } catch (err) {
    console.error('[data/oz-lookup]', err.message);
    sendJSON(res, 500, { error: err.message });
  }
}

export async function handleTractDemographics(req, res, tractId) {
  if (!req.tenant) return sendJSON(res, 401, { error: 'Not authenticated' });
  try {
    const url = new URL(req.url, 'http://local');
    const year = Number(url.searchParams.get('year')) || undefined;
    const result = await getTractDemographics(tractId, year);
    sendJSON(res, 200, result);
  } catch (err) {
    console.error('[data/tract-demographics]', err.message);
    sendJSON(res, 500, { error: err.message });
  }
}
