#!/usr/bin/env node
/**
 * Upload a brand asset (logo, image) to Supabase Storage public bucket.
 *
 * Usage:
 *   node scripts/upload-brand-asset.mjs <file-path> [storage-name]
 *
 * Example:
 *   node scripts/upload-brand-asset.mjs data/sunnax/SunnAx-Logo.png sunnax-logo.png
 *
 * Outputs the public URL for use in email signatures, etc.
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { basename, extname } from 'path';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const BUCKET = 'brand-assets';

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function main() {
  const filePath = process.argv[2];
  const storageName = process.argv[3];

  if (!filePath) {
    console.error('Usage: node scripts/upload-brand-asset.mjs <file-path> [storage-name]');
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Ensure bucket exists (public)
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);

  if (!exists) {
    console.log(`Creating public bucket: ${BUCKET}`);
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/*'],
    });
    if (error) {
      console.error('Failed to create bucket:', error.message);
      process.exit(1);
    }
    console.log('Bucket created.');
  }

  // Read file
  const fileBuffer = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const fileName = storageName || basename(filePath);

  // Upload (upsert to allow re-uploads)
  console.log(`Uploading ${fileName} (${contentType}, ${fileBuffer.length} bytes)...`);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, { contentType, upsert: true });

  if (error) {
    console.error('Upload failed:', error.message);
    process.exit(1);
  }

  // Build public URL
  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${fileName}`;

  console.log('\n--- Upload complete ---');
  console.log(`File:   ${fileName}`);
  console.log(`Size:   ${fileBuffer.length} bytes`);
  console.log(`Type:   ${contentType}`);
  console.log(`Public: ${publicUrl}`);
  console.log('\nUse this URL in email signatures:');
  console.log(`<img src="${publicUrl}" alt="SunnAx Technologies" width="90" style="display: block;" />`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
