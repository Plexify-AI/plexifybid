/**
 * Tenant Brand Config routes — email slice (v1)
 *
 * GET    /api/brand/email-images                 — current URLs + alt text
 * POST   /api/brand/email-images                 — multipart upload (hero / footer)
 * DELETE /api/brand/email-images?side=hero|footer — remove one side (storage + DB)
 *
 * Storage: reuses the existing public brand-assets bucket. Tenant isolation
 * via folder convention: brand-assets/{tenant_id}/email/{hero|footer}.{ext}.
 * The signature logo at brand-assets/sunnax-logo.png (pre-Sprint-A) is
 * untouched — root-level files stay reachable.
 *
 * Image contract (enforced server-side):
 *   - png / jpg / webp only (no gif, no svg — SVG has XSS risk in email clients)
 *   - <= 2 MB per image (Gmail image proxy degrades larger)
 *   - alt_text required when image present (accessibility + spam score)
 */

import { getSupabase, logUsageEvent } from '../lib/supabase.js';

const BUCKET = 'brand-assets';

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const ALLOWED_SIDES = new Set(['hero', 'footer']);

// Magic-byte sniff — belt-and-suspenders on top of the declared mime.
// Catches cases where a user renames .gif -> .png; multer would trust the
// header alone.
function detectMimeFromBytes(buf) {
  if (!buf || buf.length < 12) return null;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // WEBP: "RIFF....WEBP"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

function sendJSON(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// GET /api/brand/email-images
// ---------------------------------------------------------------------------

export async function handleGetEmailImages(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });

  try {
    const { data, error } = await getSupabase()
      .from('tenants')
      .select('brand_config')
      .eq('id', tenant.id)
      .maybeSingle();
    if (error) throw error;
    const bc = data?.brand_config || {};
    return sendJSON(res, 200, {
      hero_image_url: bc.email_hero_image_url || null,
      hero_alt_text: bc.email_hero_alt_text || null,
      footer_image_url: bc.email_footer_image_url || null,
      footer_alt_text: bc.email_footer_alt_text || null,
    });
  } catch (err) {
    console.error('[brand] GET failed:', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// POST /api/brand/email-images
// Multipart: { hero?: file, footer?: file, hero_alt_text?, footer_alt_text? }
// ---------------------------------------------------------------------------

export async function handleUploadEmailImages(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });

  const files = Array.isArray(req.files) ? req.files : [];
  const heroFile = files.find((f) => f.fieldname === 'hero') || null;
  const footerFile = files.find((f) => f.fieldname === 'footer') || null;
  const heroAlt = (req.body?.hero_alt_text || '').trim();
  const footerAlt = (req.body?.footer_alt_text || '').trim();

  if (!heroFile && !footerFile && !heroAlt && !footerAlt) {
    return sendJSON(res, 400, { error: 'No image or alt text provided' });
  }

  if (heroFile && !heroAlt) {
    return sendJSON(res, 400, { error: 'hero_alt_text is required when hero image is provided' });
  }
  if (footerFile && !footerAlt) {
    return sendJSON(res, 400, { error: 'footer_alt_text is required when footer image is provided' });
  }

  const supabase = getSupabase();
  const updates = {};
  const uploaded = { hero: null, footer: null };

  try {
    for (const [side, file, altText] of [
      ['hero', heroFile, heroAlt],
      ['footer', footerFile, footerAlt],
    ]) {
      if (!file) continue;

      // Validate declared mime + magic bytes
      const declared = String(file.mimetype || '').toLowerCase();
      const ext = MIME_TO_EXT[declared];
      if (!ext) {
        return sendJSON(res, 400, {
          error: `Unsupported image type "${declared}" for ${side}. Allowed: png, jpg, webp.`,
        });
      }
      const sniffed = detectMimeFromBytes(file.buffer);
      if (!sniffed || (sniffed !== declared && !(sniffed === 'image/jpeg' && declared === 'image/jpg'))) {
        return sendJSON(res, 400, {
          error: `${side} file content does not match declared type. Expected ${declared}, detected ${sniffed || 'unknown'}.`,
        });
      }
      // Size cap (multer also enforces; double-check)
      if (file.size > 2 * 1024 * 1024) {
        return sendJSON(res, 400, { error: `${side} exceeds 2 MB cap (${file.size} bytes)` });
      }

      const storagePath = `${tenant.id}/email/${side}.${ext}`;

      // Remove any existing file at the other extension so the folder doesn't
      // accumulate stale hero.png alongside a new hero.webp.
      for (const otherExt of Object.values(MIME_TO_EXT)) {
        if (otherExt !== ext) {
          const otherPath = `${tenant.id}/email/${side}.${otherExt}`;
          await supabase.storage.from(BUCKET).remove([otherPath]).catch(() => {});
        }
      }

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: declared === 'image/jpg' ? 'image/jpeg' : declared,
          upsert: true,
          cacheControl: '3600',
        });
      if (upErr) throw new Error(`Storage upload failed for ${side}: ${upErr.message}`);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error(`Could not resolve public URL for ${side}`);

      updates[`email_${side}_image_url`] = publicUrl;
      updates[`email_${side}_alt_text`] = altText;
      uploaded[side] = { url: publicUrl, alt: altText };
    }

    // Also accept alt-text-only updates (user editing caption without replacing image)
    if (!heroFile && heroAlt) updates.email_hero_alt_text = heroAlt;
    if (!footerFile && footerAlt) updates.email_footer_alt_text = footerAlt;

    if (Object.keys(updates).length === 0) {
      return sendJSON(res, 400, { error: 'Nothing to update' });
    }

    // Merge into brand_config — preserve existing keys (future logo, colors, fonts)
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('brand_config')
      .eq('id', tenant.id)
      .maybeSingle();
    const merged = { ...(tenantRow?.brand_config || {}), ...updates };

    const { error: updErr } = await supabase
      .from('tenants')
      .update({ brand_config: merged })
      .eq('id', tenant.id);
    if (updErr) throw updErr;

    logUsageEvent(tenant.id, 'brand_config_updated', {
      slice: 'email',
      action: 'uploaded',
      sides_touched: Object.keys(uploaded).filter((k) => uploaded[k]),
      fields: Object.keys(updates),
    }).catch(() => {});

    return sendJSON(res, 200, {
      ok: true,
      hero: uploaded.hero,
      footer: uploaded.footer,
      brand_config: {
        email_hero_image_url: merged.email_hero_image_url || null,
        email_hero_alt_text: merged.email_hero_alt_text || null,
        email_footer_image_url: merged.email_footer_image_url || null,
        email_footer_alt_text: merged.email_footer_alt_text || null,
      },
    });
  } catch (err) {
    console.error('[brand] upload failed:', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/brand/email-images?side=hero|footer
// Removes Storage object AND clears brand_config keys. Logs with action='removed'.
// ---------------------------------------------------------------------------

export async function handleDeleteEmailImage(req, res) {
  const tenant = req.tenant;
  if (!tenant) return sendJSON(res, 401, { error: 'Not authenticated' });

  const url = new URL(req.url, 'http://local');
  const side = url.searchParams.get('side');
  if (!ALLOWED_SIDES.has(side)) {
    return sendJSON(res, 400, { error: "side must be 'hero' or 'footer'" });
  }

  const supabase = getSupabase();
  try {
    // Remove all extension variants for this tenant/side from Storage.
    // Cheaper than listing — just try each; remove() on nonexistent is a no-op.
    const paths = Object.values(MIME_TO_EXT).map(
      (ext) => `${tenant.id}/email/${side}.${ext}`
    );
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmErr && !/not.?found/i.test(rmErr.message || '')) {
      // Log but don't block the DB cleanup — DB is source of truth for rendering.
      console.error('[brand] Storage remove error:', rmErr.message);
    }

    // Clear brand_config keys
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('brand_config')
      .eq('id', tenant.id)
      .maybeSingle();
    const bc = { ...(tenantRow?.brand_config || {}) };
    delete bc[`email_${side}_image_url`];
    delete bc[`email_${side}_alt_text`];

    const { error: updErr } = await supabase
      .from('tenants')
      .update({ brand_config: bc })
      .eq('id', tenant.id);
    if (updErr) throw updErr;

    logUsageEvent(tenant.id, 'brand_config_updated', {
      slice: 'email',
      action: 'removed',
      side,
    }).catch(() => {});

    return sendJSON(res, 200, { ok: true, side, removed: true });
  } catch (err) {
    console.error('[brand] delete failed:', err.message);
    return sendJSON(res, 500, { error: err.message });
  }
}
