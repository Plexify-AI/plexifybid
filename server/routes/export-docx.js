/**
 * PlexifySOLO — DOCX Export Route (Production)
 *
 * POST /api/export/docx — Generate a Word document from editor content
 *
 * Mirrors the Vite dev middleware in src/server/docxApi.ts + docxService.ts
 * for production use via server/index.mjs.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from 'docx';

// ---------------------------------------------------------------------------
// HTML → DOCX paragraph converter
// ---------------------------------------------------------------------------

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToDocxParagraphs(html) {
  const paragraphs = [];

  const text = decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
      .replace(/<\/?(p|div|section|article|blockquote)[^>]*>/gi, '\n')
      .replace(/<\/?h[1-6][^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return paragraphs;

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const bulletMatch = line.match(/^([•\-*])\s+(.*)$/);
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);

    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({ text: bulletMatch[2].trim(), bullet: { level: 0 } })
      );
      continue;
    }

    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          text: numberedMatch[1].trim(),
          numbering: { reference: 'numbered-list', level: 0 },
        })
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 200 },
      })
    );
  }

  return paragraphs;
}

// ---------------------------------------------------------------------------
// Document generator
// ---------------------------------------------------------------------------

async function generateDocx({ boardBrief, editorContent, exportDate }) {
  const children = [];
  const dateLabel = exportDate || new Date().toLocaleDateString();

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: boardBrief?.title || 'DEAL ROOM REPORT',
          bold: true,
          size: 28,
          color: '0D1B3E',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${dateLabel}`,
          size: 20,
          color: '666666',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Structured board brief sections
  if (boardBrief) {
    children.push(
      new Paragraph({
        text: boardBrief.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    if (boardBrief.subtitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: boardBrief.subtitle, italics: true, color: '666666' }),
          ],
          spacing: { after: 300 },
        })
      );
    }

    for (const section of boardBrief.sections) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );

      if (section.items?.length) {
        for (const item of section.items) {
          children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
        }
        children.push(new Paragraph({ spacing: { after: 150 } }));
      }

      if (section.text) {
        children.push(
          new Paragraph({
            children: [new TextRun(section.text)],
            spacing: { after: 200 },
          })
        );
      }

      if (section.metrics?.length) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: section.metrics.map(
              (m) =>
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: m.label, bold: true })] })],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph(m.value)],
                      width: { size: 50, type: WidthType.PERCENTAGE },
                    }),
                  ],
                })
            ),
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
          })
        );
        children.push(new Paragraph({ spacing: { after: 200 } }));
      }
    }

    if (boardBrief.citations?.length) {
      children.push(
        new Paragraph({
          text: 'Sources',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 150 },
        })
      );
      for (const citation of boardBrief.citations) {
        const parts = [new TextRun({ text: `[${citation.source}] `, bold: true })];
        const trimmed = (citation.text ?? '').trim();
        if (trimmed) parts.push(new TextRun(trimmed));
        children.push(
          new Paragraph({
            children: parts,
            spacing: { after: 100 },
            indent: { left: convertInchesToTwip(0.25) },
          })
        );
      }
    }
  }

  // Editor HTML content
  if (editorContent?.trim()) {
    if (!boardBrief) {
      // No structured brief — editor content IS the report
    } else {
      children.push(
        new Paragraph({
          text: 'Additional Notes',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 150 },
        })
      );
    }
    const editorParagraphs = htmlToDocxParagraphs(editorContent);
    children.push(...editorParagraphs);
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '— Generated by PlexifyAI —',
          size: 18,
          color: '999999',
          italics: true,
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
    })
  );

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function handleExportDocx(req, res, body) {
  const { boardBrief = null, editorContent = null, filename = 'board-report', artifact_id = null, override_id = null } = body || {};
  const safeName = (filename || 'board-report').replace(/[^a-zA-Z0-9\-_ ]/g, '-');

  if (!boardBrief && !(editorContent && editorContent.trim())) {
    res.status(400).json({ error: 'No content to export' });
    return;
  }

  // Sprint E / E5 — pre-export gate. Only fires when caller passes
  // artifact_id (legacy "free" exports without an artifact context bypass).
  if (artifact_id && req.tenant) {
    try {
      const { runExportGates } = await import('./gates.js');
      const gateResult = await runExportGates({
        tenantId: req.tenant.id,
        userId: req.tenant.id,
        artifactId: artifact_id,
        overrideIds: override_id ? [override_id] : [],
      });
      if (!gateResult.passed) {
        res.status(409).json({
          blocked: true,
          export_format: 'docx',
          artifact_id,
          blockers: gateResult.blocked_by,
          override_endpoint: '/api/gate-overrides',
          gates_run: gateResult.gates_run,
        });
        return;
      }
    } catch (err) {
      console.error('[export-docx] gate error:', err.message);
      // Gate infrastructure failure: fail closed (do not export).
      res.status(500).json({ error: `Pre-export gate failed: ${err.message}` });
      return;
    }
  }

  try {
    const buffer = await generateDocx({
      boardBrief,
      editorContent,
      exportDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[export-docx] Generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate document' });
  }
}
