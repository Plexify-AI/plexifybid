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

// Email confirm-send (two-step approval pattern) + save-to-drafts
import { confirmSend, saveDraftToProvider } from './services/email/tool-executor.mjs';

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

// Email save-to-drafts (saves to Gmail/Outlook Drafts folder without sending)
// Accepts either { draft_id } (from email_send_drafts table) or
// { to, subject, body_html } (direct from outreach preview — no DB draft needed)
import { saveDraftDirect } from './services/email/tool-executor.mjs';

app.post('/api/email/save-to-gmail-drafts', async (req, res) => {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  const { draft_id, to, subject, body_html } = req.body;

  try {
    let result;
    if (draft_id) {
      // Path 1: Save from email_send_drafts table (EmailPreviewModal flow)
      result = await saveDraftToProvider(draft_id, tenant.id);
    } else if (to && subject) {
      // Path 2: Save directly from outreach preview (one-click flow)
      result = await saveDraftDirect(tenant.id, { to, subject, bodyHtml: body_html });
    } else {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Provide either draft_id or (to + subject + body_html)' }));
    }

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

// Skill-based generation (canonical endpoint — replaces hardcoded ARTIFACT_PROMPTS)
import { handleSkillGenerate, handleGetTabConfig } from './routes/deal-room-generate.js';

app.post('/api/deal-rooms/:id/generate', async (req, res) => {
  await handleSkillGenerate(req, res, req.params.id, req.body);
});

// Tenant tab configuration
app.get('/api/tab-config', async (req, res) => {
  await handleGetTabConfig(req, res);
});

// DOCX Export
import { handleExportDocx } from './routes/export-docx.js';

app.post('/api/export/docx', async (req, res) => {
  await handleExportDocx(req, res, req.body);
});

// Tenant Preferences
import { handleGetPreferences, handleUpdatePreferences } from './routes/preferences.js';

app.get('/api/preferences', async (req, res) => {
  await handleGetPreferences(req, res);
});

app.put('/api/preferences', async (req, res) => {
  await handleUpdatePreferences(req, res, req.body);
});

// User Preferences (Sprint B / B1 — per-user store, separate from tenant prefs)
import {
  handleGetAllUserPreferences,
  handleGetUserPreferences,
  handleUpdateUserPreferences,
} from './routes/user-preferences.js';

app.get('/api/user-preferences', async (req, res) => {
  await handleGetAllUserPreferences(req, res);
});

app.get('/api/user-preferences/:category', async (req, res) => {
  await handleGetUserPreferences(req, res, req.params.category);
});

app.put('/api/user-preferences/:category', async (req, res) => {
  await handleUpdateUserPreferences(req, res, req.params.category, req.body);
});

// Voice Corrections Capture (Sprint B / B2 — diff AI-generated vs user-edited,
// append to voice_corrections with FIFO cap)
import { handleCapture as handleVoiceCorrectionsCapture } from './routes/voice-corrections.js';

app.post('/api/voice-corrections/capture', async (req, res) => {
  await handleVoiceCorrectionsCapture(req, res, req.body);
});

// AskPlexi Conversation Library (Sprint B / B3 — list/load/pin/archive past chats)
import {
  handleList as handleAskPlexiConvList,
  handleGet as handleAskPlexiConvGet,
  handlePatch as handleAskPlexiConvPatch,
  handleDelete as handleAskPlexiConvDelete,
} from './routes/askplexi-conversations.js';

app.get('/api/askplexi/conversations', async (req, res) => {
  await handleAskPlexiConvList(req, res);
});

app.get('/api/askplexi/conversations/:id', async (req, res) => {
  await handleAskPlexiConvGet(req, res, req.params.id);
});

app.put('/api/askplexi/conversations/:id', async (req, res) => {
  await handleAskPlexiConvPatch(req, res, req.params.id, req.body);
});

app.delete('/api/askplexi/conversations/:id', async (req, res) => {
  await handleAskPlexiConvDelete(req, res, req.params.id);
});

// Batch Email Generation
import { handleBatchGenerate } from './routes/batch-email.js';

app.post('/api/batch-email/generate', async (req, res) => {
  await handleBatchGenerate(req, res, req.body);
});

// PPTX Export + Deck Generation
import { handleExportPptx, handleGenerateDeck } from './routes/export-pptx.js';

app.post('/api/deal-rooms/:id/generate-deck', async (req, res) => {
  await handleGenerateDeck(req, res, req.params.id, req.body);
});

app.post('/api/export/pptx', async (req, res) => {
  await handleExportPptx(req, res, req.body);
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

// PlexiCoS Skills (Sprint E / E2 — prospect-backed strategy skills)
import { handleRunSkill, handleListSkills } from './routes/skills.js';

app.post('/api/skills/run', async (req, res) => {
  await handleRunSkill(req, res, req.body);
});

app.get('/api/skills', async (req, res) => {
  await handleListSkills(req, res);
});

// PlexiCoS Public data (Sprint E / E3 — OZ + Census ACS)
import {
  handleGetOzTract,
  handleOzLookup,
  handleTractDemographics,
} from './routes/data.js';

app.get('/api/data/oz-tract/:tractId', async (req, res) => {
  await handleGetOzTract(req, res, req.params.tractId);
});

app.get('/api/data/oz-lookup', async (req, res) => {
  await handleOzLookup(req, res);
});

app.get('/api/data/tract-demographics/:tractId', async (req, res) => {
  await handleTractDemographics(req, res, req.params.tractId);
});

// PlexiCoS Jobs (Sprint E / E1 — runtime abstraction for inline + Managed Agent work)
import {
  handleStartJob,
  handleGetJob,
  handleCancelJob,
  handleListJobs,
  handleUsageSummary,
} from './jobs.mjs';
import { handleMultiplexStream, handleSingleJobStream } from './routes/job-events-sse.js';

app.get('/api/jobs/events', async (req, res) => {
  await handleMultiplexStream(req, res);
});

app.get('/api/jobs/:id/events', async (req, res) => {
  await handleSingleJobStream(req, res, req.params.id);
});

app.post('/api/jobs', async (req, res) => {
  await handleStartJob(req, res, req.body);
});

app.get('/api/jobs', async (req, res) => {
  await handleListJobs(req, res);
});

app.get('/api/jobs/:id', async (req, res) => {
  await handleGetJob(req, res, req.params.id);
});

app.post('/api/jobs/:id/cancel', async (req, res) => {
  await handleCancelJob(req, res, req.params.id);
});

app.get('/api/tenant-usage/summary', async (req, res) => {
  await handleUsageSummary(req, res);
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

// Lead Import (Excel/CSV)
import { handleParse as handleLeadParse, handleImport as handleLeadImport, handleTemplate as handleLeadTemplate } from './routes/lead-import.js';

const leadImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'text/plain',
    ];
    if (allowedMime.includes(file.mimetype) || ['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
    }
  },
});

app.get('/api/leads/template', async (req, res) => {
  await handleLeadTemplate(req, res);
});

app.post('/api/leads/parse', leadImportUpload.single('file'), async (req, res) => {
  await handleLeadParse(req, res);
});

app.post('/api/leads/import', async (req, res) => {
  await handleLeadImport(req, res);
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

  // Sprint E / E2 — Seed global strategy skills (upsert from file definitions)
  import('./skills/seed.mjs')
    .then((m) => m.seedSkills())
    .catch((err) => console.error('[skill-seed] startup seed failed:', err.message));

  // Sprint E / E4 — Sync Managed Agents + start crons
  import('./agents/seed.mjs')
    .then((m) => m.seedAgents())
    .catch((err) => console.error('[agent-seed] startup seed failed:', err.message));

  import('./cron/reconcile_jobs.mjs')
    .then((m) => m.startReconciler())
    .catch((err) => console.error('[reconciler] startup failed:', err.message));

  import('./cron/pipeline_analyst_cron.mjs')
    .then((m) => m.startPipelineAnalystCron())
    .catch((err) => console.error('[pipeline-cron] startup failed:', err.message));
});
