/**
 * PlexifySOLO — Production Express Server
 *
 * Serves the Vite-built frontend from dist/ and exposes API routes.
 * In development, Vite handles both frontend and API middleware.
 * In production (Docker / Railway), this file is the entry point.
 */

import express from 'express';
import { resolve, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// Health check
app.get('/api/health', (_req, res) => {
  let version = 'unknown';
  try {
    const pkgPath = resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    version = pkg.version || 'unknown';
  } catch {
    // ignore
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
    environment: process.env.NODE_ENV || 'production',
  });
});

// ---------------------------------------------------------------------------
// Static files — serve the Vite build output
// ---------------------------------------------------------------------------
const distPath = resolve(__dirname, '..', 'dist');

if (existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for any non-API route
  app.get('*path', (_req, res) => {
    res.sendFile(resolve(distPath, 'index.html'));
  });
} else {
  app.get('*path', (_req, res) => {
    res.status(503).json({
      error: 'Frontend build not found. Run "npm run build" first.',
    });
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PlexifySOLO server running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`  App:    http://localhost:${PORT}`);
});
