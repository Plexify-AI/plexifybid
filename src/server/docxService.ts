/**
 * DOCX Export Service
 * Generates Word documents from Board Report content.
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

export interface BoardBriefSection {
  heading: string;
  items?: string[];
  text?: string;
  metrics?: Array<{ label: string; value: string }>;
}

export interface BoardBriefContent {
  title: string;
  subtitle?: string;
  sections: BoardBriefSection[];
  citations?: Array<{ text?: string; source: string }>;
}

export interface BoardReportExportRequest {
  boardBrief: BoardBriefContent | null;
  editorContent: string | null;
  exportDate?: string;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Convert HTML content to docx paragraphs (simplified)
 */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

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
        new Paragraph({
          text: bulletMatch[2].trim(),
          bullet: { level: 0 },
        })
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

export async function generateBoardReportDocx(request: BoardReportExportRequest): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];
  const { boardBrief, editorContent, exportDate } = request;

  const dateLabel = exportDate || new Date().toLocaleDateString();

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'BOARD REPORT',
          bold: true,
          size: 28,
          color: '6B21A8',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${dateLabel}`,
          size: 20,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

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
            new TextRun({
              text: boardBrief.subtitle,
              italics: true,
              color: '666666',
            }),
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
          children.push(
            new Paragraph({
              text: item,
              bullet: { level: 0 },
            })
          );
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
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: m.label, bold: true })],
                        }),
                      ],
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

  if (editorContent?.trim()) {
    children.push(
      new Paragraph({
        text: 'Additional Notes',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 150 },
      })
    );

    const editorParagraphs = htmlToDocxParagraphs(editorContent);
    children.push(...editorParagraphs);
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '— Generated by PlexifyBID —',
          size: 18,
          color: '999999',
          italics: true,
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
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}
