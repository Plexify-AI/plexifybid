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

// Email OAuth callback (public — Microsoft redirects here without sandbox token)
import {
  handleMicrosoftCallback,
  handleMicrosoftConnect,
  handleGmailCallback,
  handleGmailConnect,
  handleEmailDisconnect,
  handleEmailStatus,
} from './routes/email-auth.js';

app.get('/api/auth/email/microsoft/callback', async (req, res) => {
  await handleMicrosoftCallback(req, res);
});

app.get('/api/auth/email/gmail/callback', async (req, res) => {
  await handleGmailCallback(req, res);
});

// ---------------------------------------------------------------------------
// Sandbox auth gate — all /api/ routes below require valid token
// ---------------------------------------------------------------------------
import { sandboxAuth } from './middleware/sandboxAuth.js';

app.use(sandboxAuth());

// ---------------------------------------------------------------------------
// Protected API routes
// ---------------------------------------------------------------------------

// Email OAuth (protected — require sandbox token)
app.get('/api/auth/email/microsoft/connect', async (req, res) => {
  await handleMicrosoftConnect(req, res);
});

app.get('/api/auth/email/gmail/connect', async (req, res) => {
  await handleGmailConnect(req, res);
});

app.post('/api/auth/email/disconnect', async (req, res) => {
  await handleEmailDisconnect(req, res);
});

app.get('/api/auth/email/status', async (req, res) => {
  await handleEmailStatus(req, res);
});

// Email confirm-send (two-step approval pattern)
import { confirmSend } from './services/email/tool-executor.mjs';

app.post('/api/email/confirm-send', async (req, res) => {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { draft_id } = req.body;
  if (!draft_id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing draft_id' }));
  }

  try {
    const result = await confirmSend(draft_id, tenant.id);
    res.statusCode = result.success ? 200 : 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
});

// System Status
import { handleSystemStatus } from './routes/system-status.js';

app.get('/api/system-status', async (req, res) => {
  await handleSystemStatus(req, res);
});

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
  handleGetByOpportunity,
  handleUploadSource,
  handleDeleteSource,
  handleDealRoomChat,
  handleGenerateArtifact,
  handleListArtifacts,
  handleGenerateAudio,
  handleListAudio,
  handleStreamAudio,
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

app.get('/api/deal-rooms/by-opportunity/:opportunityId', async (req, res) => {
  await handleGetByOpportunity(req, res, req.params.opportunityId);
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

// Pipeline Summary (Level 1 template interpolation)
import { handlePipelineSummary } from './routes/pipeline-summary.js';

app.get('/api/pipeline-summary', async (req, res) => {
  await handlePipelineSummary(req, res);
});

// Powerflow Pipeline
import { handleGetToday, handleCompleteStage } from './routes/powerflow.js';

app.get('/api/powerflow/today', async (req, res) => {
  await handleGetToday(req, res);
});

app.post('/api/powerflow/complete', async (req, res) => {
  await handleCompleteStage(req, res, req.body);
});

// LinkedIn Import
import { handleUploadLinkedInExport, handleStartPipeline, handleGetStatus, handleCancelPipeline } from './routes/linkedin-import.js';
import { cleanupZombieJobs } from './services/linkedin-pipeline.mjs';

const linkedinUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for LinkedIn export ZIPs
});

app.post('/api/linkedin-import/upload', linkedinUpload.single('file'), async (req, res) => {
  await handleUploadLinkedInExport(req, res);
});

app.post('/api/linkedin-import/start', async (req, res) => {
  await handleStartPipeline(req, res);
});

app.get('/api/linkedin-import/status/:jobId', async (req, res) => {
  await handleGetStatus(req, res);
});

app.post('/api/linkedin-import/cancel/:jobId', async (req, res) => {
  await handleCancelPipeline(req, res);
});

// Voice DNA
import {
  handleCreateProfile as handleVoiceDnaCreate,
  handleGetActive as handleVoiceDnaActive,
  handleGetProfile as handleVoiceDnaGet,
  handleApproveProfile as handleVoiceDnaApprove,
  handleUpdateDimensions as handleVoiceDnaDimensions,
  handleVoiceGenerate as handleVoiceDnaGenerate,
} from './routes/voice-dna.js';

app.post('/api/voice-dna/profiles', async (req, res) => {
  await handleVoiceDnaCreate(req, res, req.body);
});

app.get('/api/voice-dna/profiles/active', async (req, res) => {
  await handleVoiceDnaActive(req, res);
});

app.get('/api/voice-dna/profiles/:id', async (req, res) => {
  await handleVoiceDnaGet(req, res, req.params.id);
});

app.put('/api/voice-dna/profiles/:id/approve', async (req, res) => {
  await handleVoiceDnaApprove(req, res, req.params.id);
});

app.put('/api/voice-dna/profiles/:id/dimensions', async (req, res) => {
  await handleVoiceDnaDimensions(req, res, req.params.id, req.body);
});

app.post('/api/voice-dna/generate', async (req, res) => {
  await handleVoiceDnaGenerate(req, res, req.body);
});

// Signals (warmth event logging)
import { handleLogSignal, handleGetSignals, handleBulkSignals } from './routes/signals.js';

app.post('/api/signals', async (req, res) => {
  await handleLogSignal(req, res, req.body);
});

app.get('/api/signals/:opportunityId', async (req, res) => {
  await handleGetSignals(req, res, req.params.opportunityId);
});

app.post('/api/signals/bulk', async (req, res) => {
  await handleBulkSignals(req, res, req.body);
});

// Opportunities
import { handleListOpportunities, handleGetOpportunity, handleCreateOpportunity } from './routes/opportunities.js';

app.get('/api/opportunities', async (req, res) => {
  await handleListOpportunities(req, res);
});

app.get('/api/opportunities/:id', async (req, res) => {
  await handleGetOpportunity(req, res, req.params.id);
});

app.post('/api/opportunities', async (req, res) => {
  await handleCreateOpportunity(req, res, req.body);
});

// Outreach Sequence Agent
import { handleGenerateSequence } from './routes/outreach-sequence.js';

app.post('/api/outreach-sequence', async (req, res) => {
  await handleGenerateSequence(req, res, req.body);
});

// Activity Feed (cross-opportunity events for Home screen)
import { handleActivityFeed } from './routes/activity-feed.js';

app.get('/api/activity-feed', async (req, res) => {
  await handleActivityFeed(req, res);
});

// Audio briefings + podcasts
app.post('/api/deal-rooms/:id/audio', async (req, res) => {
  await handleGenerateAudio(req, res, req.params.id, req.body);
});

app.get('/api/deal-rooms/:id/audio', async (req, res) => {
  await handleListAudio(req, res, req.params.id);
});

app.get('/api/deal-rooms/:id/audio/:audioId/stream', async (req, res) => {
  await handleStreamAudio(req, res, req.params.id, req.params.audioId);
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

  // Mark any zombie 'processing' LinkedIn import jobs as errored (e.g., after Railway redeploy)
  cleanupZombieJobs().catch(err => {
    console.error('Failed to cleanup zombie LinkedIn import jobs:', err.message);
  });
});
