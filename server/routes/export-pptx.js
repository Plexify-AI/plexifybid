/**
 * PlexifyAEC — PPTX Export Route
 *
 * Two modes:
 * 1. POST /api/deal-rooms/:id/generate-deck — LLM-driven: loads sources, calls Claude
 *    for structured slide JSON, converts to branded .pptx, saves artifact record.
 * 2. POST /api/export/pptx — Direct export: takes editor content and converts to .pptx
 *    (no LLM call, mirrors Export DOCX pattern).
 *
 * Auth: sandboxAuth middleware sets req.tenant before this handler runs.
 */

import PptxGenJS from 'pptxgenjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { sendPrompt } from '../llm-gateway/index.js';
import { TASK_TYPES } from '../llm-gateway/types.js';
import { markPowerflowStage } from './powerflow.js';
import { injectVoicePrompt } from '../lib/voice-dna/inject-voice-prompt.js';
import {
  getSupabase,
  getDealRoom,
  getAllSourceChunks,
  createDealRoomArtifact,
  updateDealRoomArtifact,
  logUsageEvent,
} from '../lib/supabase.js';
import { buildRAGContext } from '../lib/rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------

const BRAND = {
  NAVY: '0D1B3E',
  WHITE: 'FFFFFF',
  LIGHT_GRAY: 'E2E8F0',
  MID_GRAY: '94A3B8',
  TEAL: '10B981',
  AMBER: 'F59E0B',
  VIOLET: '8B5CF6',
  DARK_PANEL: '1E293B',
};

const FOOTER_TEXT = 'Plexify AI — Win more by bidding less | plexifyai.com';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function extractJSONSafe(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  text = text.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Load the Plexify logo as a base64 data URI for embedding in PPTX.
 * Falls back gracefully if the file isn't found.
 */
function loadLogoBase64() {
  try {
    // Try dist/ first (production), then public/ (dev)
    const candidates = [
      resolve(__dirname, '../../dist/assets/logos/flat_P_logo.png'),
      resolve(__dirname, '../../public/assets/logos/flat_P_logo.png'),
    ];
    for (const p of candidates) {
      try {
        const buf = readFileSync(p);
        return `image/png;base64,${buf.toString('base64')}`;
      } catch { /* try next */ }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PPTX Template Engine
// ---------------------------------------------------------------------------

/**
 * Build a branded PPTX file from structured slide JSON.
 * Returns a Node.js Buffer of the .pptx file.
 */
async function buildPptx(slideData) {
  const pptx = new PptxGenJS();

  pptx.author = 'Plexify AI';
  pptx.company = 'Plexify AI';
  pptx.title = slideData.title || 'Board Deck';
  pptx.subject = slideData.subtitle || '';

  // Define slide master with branded background + footer
  pptx.defineSlideMaster({
    title: 'PLEXIFY_MASTER',
    background: { fill: BRAND.NAVY },
    objects: [
      // Violet accent line at top
      {
        rect: {
          x: 0, y: 0, w: '100%', h: 0.04,
          fill: { color: BRAND.VIOLET },
        },
      },
      // Footer text
      {
        text: {
          text: FOOTER_TEXT,
          options: {
            x: 0.5, y: 5.2, w: 9, h: 0.3,
            fontSize: 8, color: BRAND.MID_GRAY,
            fontFace: 'Arial',
          },
        },
      },
    ],
  });

  const logoData = loadLogoBase64();
  const slides = slideData.slides || [];

  for (const slideInfo of slides) {
    const slide = pptx.addSlide({ masterName: 'PLEXIFY_MASTER' });

    switch (slideInfo.type) {
      case 'title':
        renderTitleSlide(pptx, slide, slideInfo, slideData, logoData);
        break;
      case 'executive_summary':
        renderBulletSlide(pptx, slide, slideInfo);
        break;
      case 'metrics':
        renderMetricsSlide(pptx, slide, slideInfo);
        break;
      case 'two_column':
        renderTwoColumnSlide(pptx, slide, slideInfo);
        break;
      case 'recommendations':
        renderBulletSlide(pptx, slide, slideInfo, true);
        break;
      case 'closing':
        renderClosingSlide(pptx, slide, slideInfo);
        break;
      default:
        // Generic bullet slide for any unknown type
        renderBulletSlide(pptx, slide, slideInfo);
        break;
    }
  }

  // If no slides were generated, add a single title slide
  if (slides.length === 0) {
    const slide = pptx.addSlide({ masterName: 'PLEXIFY_MASTER' });
    renderTitleSlide(pptx, slide, { title: slideData.title, subtitle: slideData.subtitle }, slideData, logoData);
  }

  return pptx.write({ outputType: 'nodebuffer' });
}

// ---------------------------------------------------------------------------
// Slide renderers
// ---------------------------------------------------------------------------

function renderTitleSlide(pptx, slide, slideInfo, deckData, logoData) {
  // Logo
  if (logoData) {
    slide.addImage({
      data: logoData,
      x: 4.25, y: 0.6, w: 1.5, h: 1.5,
    });
  }

  // Title
  slide.addText(slideInfo.title || deckData.title || 'Board Deck', {
    x: 0.8, y: logoData ? 2.3 : 1.5, w: 8.4, h: 1.0,
    fontSize: 32, bold: true, color: BRAND.WHITE,
    fontFace: 'Arial', align: 'center',
  });

  // Subtitle
  const subtitle = slideInfo.subtitle || deckData.subtitle || '';
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: logoData ? 3.2 : 2.5, w: 8.4, h: 0.6,
      fontSize: 16, color: BRAND.LIGHT_GRAY,
      fontFace: 'Arial', align: 'center',
    });
  }

  // Date
  const dateStr = deckData.date || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  slide.addText(dateStr, {
    x: 0.8, y: logoData ? 3.9 : 3.2, w: 8.4, h: 0.4,
    fontSize: 12, color: BRAND.MID_GRAY,
    fontFace: 'Arial', align: 'center',
  });
}

function renderBulletSlide(pptx, slide, slideInfo, numbered = false) {
  // Title
  slide.addText(slideInfo.title || '', {
    x: 0.8, y: 0.3, w: 8.4, h: 0.7,
    fontSize: 24, bold: true, color: BRAND.WHITE,
    fontFace: 'Arial',
  });

  // Teal underline
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 0.95, w: 2.0, h: 0.03, fill: { color: BRAND.TEAL },
  });

  // Bullets
  const bullets = slideInfo.bullets || [];
  if (bullets.length > 0) {
    const textRows = bullets.map((b, i) => ({
      text: numbered ? `${i + 1}. ${b}` : b,
      options: {
        fontSize: 16, color: BRAND.LIGHT_GRAY, fontFace: 'Arial',
        bullet: numbered ? false : { type: 'bullet', color: BRAND.TEAL },
        paraSpaceAfter: 8,
        breakLine: true,
      },
    }));

    slide.addText(textRows, {
      x: 0.8, y: 1.2, w: 8.4, h: 3.8,
      valign: 'top',
    });
  }

  // Source citations (small, bottom)
  if (slideInfo.source_citations?.length) {
    slide.addText(slideInfo.source_citations.join(' | '), {
      x: 0.8, y: 4.8, w: 8.4, h: 0.3,
      fontSize: 7, color: BRAND.MID_GRAY, fontFace: 'Arial', italic: true,
    });
  }
}

function renderMetricsSlide(pptx, slide, slideInfo) {
  // Title
  slide.addText(slideInfo.title || 'Key Metrics', {
    x: 0.8, y: 0.3, w: 8.4, h: 0.7,
    fontSize: 24, bold: true, color: BRAND.WHITE,
    fontFace: 'Arial',
  });

  // Teal underline
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 0.95, w: 2.0, h: 0.03, fill: { color: BRAND.TEAL },
  });

  // Metric cards (up to 4 per row)
  const metrics = slideInfo.metrics || [];
  const cardWidth = 2.2;
  const gap = 0.3;
  const startX = 0.8;
  const startY = 1.4;

  metrics.forEach((metric, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = startX + col * (cardWidth + gap);
    const y = startY + row * 2.0;

    // Card background
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardWidth, h: 1.6,
      fill: { color: BRAND.DARK_PANEL },
      rectRadius: 0.1,
    });

    // Metric value (large, teal)
    slide.addText(metric.value || '—', {
      x, y: y + 0.2, w: cardWidth, h: 0.6,
      fontSize: 28, bold: true, color: BRAND.TEAL,
      fontFace: 'Arial', align: 'center',
    });

    // Metric label
    slide.addText(metric.label || '', {
      x, y: y + 0.8, w: cardWidth, h: 0.35,
      fontSize: 12, bold: true, color: BRAND.WHITE,
      fontFace: 'Arial', align: 'center',
    });

    // Context
    if (metric.context) {
      slide.addText(metric.context, {
        x, y: y + 1.1, w: cardWidth, h: 0.3,
        fontSize: 9, color: BRAND.MID_GRAY,
        fontFace: 'Arial', align: 'center',
      });
    }
  });
}

function renderTwoColumnSlide(pptx, slide, slideInfo) {
  // Title
  slide.addText(slideInfo.title || '', {
    x: 0.8, y: 0.3, w: 8.4, h: 0.7,
    fontSize: 24, bold: true, color: BRAND.WHITE,
    fontFace: 'Arial',
  });

  // Teal underline
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 0.95, w: 2.0, h: 0.03, fill: { color: BRAND.TEAL },
  });

  // Left column header
  slide.addText(slideInfo.left_header || 'Left', {
    x: 0.8, y: 1.2, w: 4.0, h: 0.5,
    fontSize: 16, bold: true, color: BRAND.TEAL,
    fontFace: 'Arial',
  });

  // Left column bullets
  const leftBullets = (slideInfo.left_bullets || []).map(b => ({
    text: b,
    options: {
      fontSize: 14, color: BRAND.LIGHT_GRAY, fontFace: 'Arial',
      bullet: { type: 'bullet', color: BRAND.TEAL },
      paraSpaceAfter: 6, breakLine: true,
    },
  }));
  if (leftBullets.length) {
    slide.addText(leftBullets, {
      x: 0.8, y: 1.7, w: 4.0, h: 3.0, valign: 'top',
    });
  }

  // Right column header
  slide.addText(slideInfo.right_header || 'Right', {
    x: 5.2, y: 1.2, w: 4.0, h: 0.5,
    fontSize: 16, bold: true, color: BRAND.AMBER,
    fontFace: 'Arial',
  });

  // Right column bullets
  const rightBullets = (slideInfo.right_bullets || []).map(b => ({
    text: b,
    options: {
      fontSize: 14, color: BRAND.LIGHT_GRAY, fontFace: 'Arial',
      bullet: { type: 'bullet', color: BRAND.AMBER },
      paraSpaceAfter: 6, breakLine: true,
    },
  }));
  if (rightBullets.length) {
    slide.addText(rightBullets, {
      x: 5.2, y: 1.7, w: 4.0, h: 3.0, valign: 'top',
    });
  }

  // Divider line
  slide.addShape(pptx.ShapeType.line, {
    x: 4.9, y: 1.3, w: 0, h: 3.2,
    line: { color: BRAND.MID_GRAY, width: 0.5, dashType: 'dash' },
  });
}

function renderClosingSlide(pptx, slide, slideInfo) {
  // Title
  slide.addText(slideInfo.title || 'Next Steps', {
    x: 0.8, y: 1.5, w: 8.4, h: 0.8,
    fontSize: 28, bold: true, color: BRAND.WHITE,
    fontFace: 'Arial', align: 'center',
  });

  // Content
  if (slideInfo.content) {
    slide.addText(slideInfo.content, {
      x: 1.5, y: 2.5, w: 7.0, h: 1.5,
      fontSize: 16, color: BRAND.LIGHT_GRAY,
      fontFace: 'Arial', align: 'center',
    });
  }

  // Bullets (if provided instead of content)
  if (slideInfo.bullets?.length) {
    const textRows = slideInfo.bullets.map(b => ({
      text: b,
      options: {
        fontSize: 14, color: BRAND.LIGHT_GRAY, fontFace: 'Arial',
        bullet: { type: 'bullet', color: BRAND.TEAL },
        paraSpaceAfter: 6, breakLine: true,
      },
    }));
    slide.addText(textRows, {
      x: 1.5, y: 2.5, w: 7.0, h: 2.5, valign: 'top',
    });
  }

  // Plexify tagline
  slide.addText('Prepared with Plexify AI', {
    x: 0.8, y: 4.3, w: 8.4, h: 0.4,
    fontSize: 11, color: BRAND.VIOLET, italic: true,
    fontFace: 'Arial', align: 'center',
  });
}

// ---------------------------------------------------------------------------
// LLM System Prompt for Slide Generation
// ---------------------------------------------------------------------------

const SLIDE_DECK_SYSTEM_PROMPT = `You are a presentation strategist preparing a Board Deck for a business development team. Your reader is an executive who needs to review deal intelligence in a 5-minute slide walkthrough.

{voice_dna_block}

DOMAIN CONTEXT: You work across AEC, broadcast, events, and enterprise tech verticals. The deck should be professional, data-driven, and actionable — not a brochure. Every slide must earn its place.

CITATION RULE: Every factual claim MUST cite its source using this exact format: [Source: {filename}, Chunk {N}]. Do not invent figures or contacts.

SLIDE TYPES AVAILABLE:
- "title" — Opening slide with deck title and subtitle
- "executive_summary" — Key findings as bullets
- "metrics" — Up to 4 metric cards with value, label, context
- "two_column" — Side-by-side comparison (Strengths/Risks, Pros/Cons, etc.)
- "recommendations" — Numbered action items
- "closing" — Next steps or call to action

OUTPUT FORMAT: Respond with ONLY a JSON object matching this exact schema. No markdown, no preamble, no commentary outside the JSON:
{
  "title": "string — deck title, e.g. 'WSP Federal Programs — Board Brief'",
  "subtitle": "string — prepared by line",
  "date": "string — e.g. 'April 7, 2026'",
  "slides": [
    {
      "type": "title",
      "title": "string",
      "subtitle": "string"
    },
    {
      "type": "executive_summary",
      "title": "Executive Summary",
      "bullets": ["string — 4-6 key findings, each 15-25 words"],
      "source_citations": ["filename, Chunk N"]
    },
    {
      "type": "metrics",
      "title": "Key Metrics",
      "metrics": [
        { "label": "string", "value": "string — e.g. '$20B+'", "context": "string — e.g. 'Since 2009'" }
      ]
    },
    {
      "type": "two_column",
      "title": "Strengths & Risks",
      "left_header": "Strengths",
      "left_bullets": ["string"],
      "right_header": "Risks",
      "right_bullets": ["string"]
    },
    {
      "type": "recommendations",
      "title": "Recommended Actions",
      "bullets": ["string — concrete, actionable items"]
    },
    {
      "type": "closing",
      "title": "Next Steps",
      "content": "string — what happens after this deck"
    }
  ]
}

DECK STRUCTURE: Generate 5-7 slides total. Always include: title, executive_summary, at least one metrics or two_column, recommendations, closing. The deck should tell a story: situation, evidence, analysis, action.

VOICE RULES: Write like someone presenting to a VP, not reading a memo. Bullet points should be scannable in 3 seconds. Metrics should use concrete numbers. Recommendations should name who does what.

NEVER use these words: delve, leverage, seamless, transformative.`;

// ---------------------------------------------------------------------------
// POST /api/deal-rooms/:id/generate-deck
// ---------------------------------------------------------------------------

export async function handleGenerateDeck(req, res, dealRoomId, body) {
  const tenant = req.tenant;
  if (!tenant) return sendError(res, 401, 'Not authenticated');

  const startTime = Date.now();

  try {
    // 1. Verify deal room exists
    const dealRoom = await getDealRoom(tenant.id, dealRoomId);
    if (!dealRoom) return sendError(res, 404, 'Deal room not found');

    // 2. Load source chunks
    const sources = await getAllSourceChunks(tenant.id, dealRoomId);
    if (sources.length === 0) {
      return sendError(res, 400, 'No sources uploaded. Upload documents before generating a deck.');
    }

    let allChunks = [];
    for (const source of sources) {
      if (!source.content_chunks || source.content_chunks.length === 0) continue;
      for (const chunk of source.content_chunks) {
        allChunks.push({
          chunk: {
            ...chunk,
            source_name: chunk.source_name || source.file_name,
          },
          sourceId: source.id,
          score: 1.0,
        });
      }
    }

    if (allChunks.length < 3) {
      return sendJSON(res, 200, {
        success: false,
        reason: 'insufficient_data',
        message: 'This Deal Room needs more source documents to generate a Board Deck. Upload PDFs, DOCX, or TXT files to the Sources panel.',
        chunksFound: allChunks.length,
        chunksRequired: 3,
      });
    }

    // Cap chunks at 20
    if (allChunks.length > 20) {
      allChunks = allChunks.slice(0, 20);
    }

    const ragContext = buildRAGContext(allChunks);

    // 3. Inject Voice DNA
    let systemPrompt = SLIDE_DECK_SYSTEM_PROMPT;
    try {
      const voiceBlock = await injectVoicePrompt(tenant.id, 'general');
      if (voiceBlock) {
        systemPrompt = systemPrompt.replace('{voice_dna_block}', voiceBlock);
      } else {
        systemPrompt = systemPrompt.replace('{voice_dna_block}', '');
      }
    } catch (voiceErr) {
      console.error('[export-pptx] Voice DNA injection failed:', voiceErr.message);
      systemPrompt = systemPrompt.replace('{voice_dna_block}', '');
    }

    // 4. Create artifact record (status=generating)
    const sourcesUsed = sources.map(s => ({ id: s.id, file_name: s.file_name }));
    const artifact = await createDealRoomArtifact(tenant.id, dealRoomId, {
      artifact_type: 'board_deck',
      title: 'Board Deck',
      status: 'generating',
      sources_used: sourcesUsed,
      user_id: tenant.id,
      skill_version: 'board_deck:inline',
    });

    // 5. Call LLM Gateway for slide structure
    const result = await sendPrompt({
      taskType: TASK_TYPES.DEAL_ROOM_ARTIFACT,
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate a Board Deck from the following sources. Create 5-7 branded slides covering the key intelligence.\n\n${ragContext}`,
        },
      ],
      maxTokens: 4096,
      temperature: 0.3,
      tenantId: tenant.id,
    });

    const rawText = (result.content || '').trim();
    const usage = result.usage || {};

    // 6. Parse JSON
    const parsed = extractJSONSafe(rawText);
    if (!parsed || !parsed.slides) {
      console.error('[export-pptx] JSON parse failed. Raw (first 500):', rawText.slice(0, 500));
      await updateDealRoomArtifact(artifact.id, {
        status: 'failed',
        error_message: 'Failed to parse slide structure from Claude.',
        model_used: result.model || null,
        token_count_in: usage.inputTokens || 0,
        token_count_out: usage.outputTokens || 0,
      });
      return sendError(res, 422, 'Failed to parse slide structure from AI response.');
    }

    // 7. Build PPTX
    const pptxBuffer = await buildPptx(parsed);

    // 8. Update artifact record
    await updateDealRoomArtifact(artifact.id, {
      status: 'ready',
      title: parsed.title || 'Board Deck',
      content: {
        artifact_type: 'board_deck',
        schema_version: '1.0',
        generated_at: new Date().toISOString(),
        deal_room_id: dealRoomId,
        sources_used: sourcesUsed,
        output: parsed,
      },
      model_used: result.model || null,
      token_count_in: usage.inputTokens || 0,
      token_count_out: usage.outputTokens || 0,
    });

    // 9. Log usage event
    const durationMs = Date.now() - startTime;
    logUsageEvent(tenant.id, 'deal_room_deck_generated', {
      deal_room_id: dealRoomId,
      artifact_id: artifact.id,
      model: result.model || null,
      token_count_in: usage.inputTokens || 0,
      token_count_out: usage.outputTokens || 0,
      duration_ms: durationMs,
      slide_count: parsed.slides?.length || 0,
    }).catch(() => {});

    console.log(
      `[export-pptx] Generated deck (${artifact.id}) in ${durationMs}ms, ` +
      `${parsed.slides?.length || 0} slides`
    );

    // 10. Powerflow Stage 5
    markPowerflowStage(tenant, 5);

    // 11. Send PPTX as download
    const safeName = (dealRoom.name || 'Board-Deck').replace(/[^a-zA-Z0-9\-_ ]/g, '-');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Board-Deck.pptx"`);
    res.end(Buffer.from(pptxBuffer));
  } catch (err) {
    console.error('[export-pptx] Generation error:', err);
    return sendError(res, 500, `Failed to generate deck: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// POST /api/export/pptx — Direct export from editor content (no LLM)
// ---------------------------------------------------------------------------

export async function handleExportPptx(req, res, body) {
  const { editorContent = null, filename = 'Board-Deck' } = body || {};
  const safeName = (filename || 'Board-Deck').replace(/[^a-zA-Z0-9\-_ ]/g, '-');

  if (!editorContent?.trim()) {
    res.status(400).json({ error: 'No content to export' });
    return;
  }

  try {
    // Convert editor HTML to simple slide structure
    const slideData = editorContentToSlides(editorContent, filename);
    const pptxBuffer = await buildPptx(slideData);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pptx"`);
    res.send(Buffer.from(pptxBuffer));
  } catch (err) {
    console.error('[export-pptx] Export error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate presentation' });
  }
}

/**
 * Convert TipTap HTML editor content into a simple slide deck structure.
 * Splits on <h1>/<h2> headings — each becomes a new slide.
 */
function editorContentToSlides(html, deckTitle) {
  // Strip HTML tags and decode entities
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

  const slides = [];

  // Title slide
  slides.push({
    type: 'title',
    title: stripTags(deckTitle || 'Report'),
    subtitle: 'Prepared with Plexify AI',
  });

  // Split content by headings
  const sections = html.split(/<h[12][^>]*>/i).filter(Boolean);
  for (const section of sections) {
    // Extract heading text (up to first closing tag)
    const headingMatch = section.match(/^([^<]+)/);
    const heading = headingMatch ? stripTags(headingMatch[1]) : '';

    // Extract bullets from <li> tags
    const liMatches = [...section.matchAll(/<li[^>]*>(.*?)<\/li>/gi)];
    const bullets = liMatches.map(m => stripTags(m[1])).filter(Boolean);

    // Extract paragraphs
    const pMatches = [...section.matchAll(/<p[^>]*>(.*?)<\/p>/gi)];
    const paras = pMatches.map(m => stripTags(m[1])).filter(Boolean);

    if (bullets.length > 0) {
      slides.push({
        type: 'executive_summary',
        title: heading || 'Details',
        bullets,
      });
    } else if (paras.length > 0) {
      slides.push({
        type: 'closing',
        title: heading || 'Details',
        content: paras.join('\n\n'),
      });
    } else if (heading) {
      // Plain text content
      const contentText = stripTags(section.replace(/^[^<]*<\/h[12]>/i, ''));
      if (contentText) {
        slides.push({
          type: 'closing',
          title: heading,
          content: contentText,
        });
      }
    }
  }

  return {
    title: stripTags(deckTitle || 'Report'),
    subtitle: 'Prepared with Plexify AI',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    slides,
  };
}
