/**
 * PlexifySOLO — Production Express Server
 *
 * Serves the Vite-built frontend from dist/ and exposes API routes.
 * In development, Vite handles both frontend and API middleware.
 * In production (Docker / Railway), this file is the entry point.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // SPA serves its own scripts
}));

// CORS — permissive for sandbox trial, lock down via ALLOWED_ORIGINS later
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null; // null = allow all

app.use(cors({
  origin: allowedOrigins || true,
  credentials: true,
}));

// Rate limiting — protect Claude API from abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '12mb' }));

// ---------------------------------------------------------------------------
// Public API routes (no auth)
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

// Auth validate (public)
import { handleValidate } from './routes/auth.js';

app.post('/api/auth/validate', async (req, res) => {
  await handleValidate(req, res, req.body);
});

// ---------------------------------------------------------------------------
// Sandbox auth gate — all /api/ routes below require valid token
// ---------------------------------------------------------------------------
import { sandboxAuth } from './middleware/sandboxAuth.js';

app.use(sandboxAuth());

// ---------------------------------------------------------------------------
// Protected API routes
// ---------------------------------------------------------------------------

// Ask Plexi chat
import { handleChat } from './routes/ask-plexi.js';

app.post('/api/ask-plexi/chat', async (req, res) => {
  await handleChat(req, res, req.body);
});

// Usage events (agent activity feed)
import { handleGetUsageEvents } from './routes/usage-events.js';

app.get('/api/usage-events', async (req, res) => {
  await handleGetUsageEvents(req, res);
});

// Deal Rooms
import multer from 'multer';
import {
  handleCreateDealRoom,
  handleListDealRooms,
  handleGetDealRoom,
  handleUploadSource,
  handleDeleteSource,
  handleDealRoomChat,
  handleGenerateArtifact,
  handleListArtifacts,
} from './routes/deal-rooms.js';

const dealRoomUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.post('/api/deal-rooms', async (req, res) => {
  await handleCreateDealRoom(req, res, req.body);
});

app.get('/api/deal-rooms', async (req, res) => {
  await handleListDealRooms(req, res);
});

app.get('/api/deal-rooms/:id', async (req, res) => {
  await handleGetDealRoom(req, res, req.params.id);
});

app.post('/api/deal-rooms/:id/sources', dealRoomUpload.single('file'), async (req, res) => {
  await handleUploadSource(req, res, req.params.id);
});

app.delete('/api/deal-rooms/:id/sources/:sourceId', async (req, res) => {
  await handleDeleteSource(req, res, req.params.id, req.params.sourceId);
});

app.post('/api/deal-rooms/:id/chat', async (req, res) => {
  await handleDealRoomChat(req, res, req.params.id, req.body);
});

app.post('/api/deal-rooms/:id/artifacts', async (req, res) => {
  await handleGenerateArtifact(req, res, req.params.id, req.body);
});

app.get('/api/deal-rooms/:id/artifacts', async (req, res) => {
  await handleListArtifacts(req, res, req.params.id);
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
