import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { exportReportToPDF } from 'plexify-shared-ui';

import type {
  BoardBriefEnvelope,
  AssessmentTrendsEnvelope,
  OZRFSectionEnvelope,
  NotebookBDStructuredOutput,
} from '../types/structuredOutputs';

import { boardBriefToHtml } from '../components/BoardBriefRenderer';
import { assessmentTrendsToHtml } from '../components/AssessmentTrendsRenderer';
import { ozrfSectionToHtml } from '../components/OZRFSectionRenderer';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAgentEnvelope(x: unknown): x is NotebookBDStructuredOutput {
  return (
    typeof x === 'object' &&
    x !== null &&
    'agentId' in x &&
    'output' in x &&
    'schemaVersion' in x
  );
}

function h(text: string, level: HeadingLevel) {
  return new Paragraph({
    text,
    heading: level,
  });
}

function p(text: string) {
  return new Paragraph({
    children: [new TextRun(text)],
  });
}

function bullet(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
  });
}

function twoColTable(rows: Array<[string, string]>) {
  return new Table({
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({ children: [p(k)] }),
            new TableCell({ children: [p(v)] }),
          ],
        })
    ),
  });
}

function collectionSummaryTable(env: AssessmentTrendsEnvelope) {
  const rows = env.output.sections.collectionSummary.rows;
  const total = env.output.sections.collectionSummary.total;

  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [p('Property Type')] }),
          new TableCell({ children: [p('Billed')] }),
          new TableCell({ children: [p('Collected')] }),
          new TableCell({ children: [p('Rate')] }),
        ],
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [
              new TableCell({ children: [p(r.propertyType)] }),
              new TableCell({ children: [p(r.billed)] }),
              new TableCell({ children: [p(r.collected)] }),
              new TableCell({ children: [p(r.rate)] }),
            ],
          })
      ),
      new TableRow({
        children: [
          new TableCell({ children: [p('TOTAL')] }),
          new TableCell({ children: [p(total.billed)] }),
          new TableCell({ children: [p(total.collected)] }),
          new TableCell({ children: [p(total.rate)] }),
        ],
      }),
    ],
  });
}

function docxContentForBoardBrief(env: BoardBriefEnvelope) {
  return [
    h(env.output.title, HeadingLevel.HEADING_1),
    ...(env.output.districtName || env.output.reportingPeriod
      ? [
          p(
            [env.output.districtName, env.output.reportingPeriod]
              .filter(Boolean)
              .join(' • ')
          ),
        ]
      : []),
    h('Executive Summary', HeadingLevel.HEADING_2),
    ...env.output.executiveSummary.map(bullet),
    h('Key Metrics', HeadingLevel.HEADING_2),
    twoColTable(env.output.keyMetrics.map((m) => [m.label, m.value])),
    h('Highlights', HeadingLevel.HEADING_2),
    ...env.output.highlights.map(bullet),
    h('Risks', HeadingLevel.HEADING_2),
    ...env.output.risks.map(bullet),
    h('Recommendations', HeadingLevel.HEADING_2),
    ...env.output.recommendations.map(bullet),
  ];
}

function docxContentForAssessmentTrends(env: AssessmentTrendsEnvelope) {
  return [
    h(env.output.title, HeadingLevel.HEADING_1),
    p(`${env.output.metadata.period} • Prepared ${env.output.metadata.preparedDate}`),
    h('Collection Summary', HeadingLevel.HEADING_2),
    collectionSummaryTable(env),
    h('Delinquency Aging', HeadingLevel.HEADING_2),
    ...(env.output.sections.delinquencyAging.length
      ? env.output.sections.delinquencyAging.map((d) =>
          bullet(`${d.bucket}: ${d.amount} (${d.propertyCount} properties)`)
        )
      : [p('No delinquency aging data.')]),
    h('Top Delinquent Accounts', HeadingLevel.HEADING_2),
    ...(env.output.sections.topDelinquent.length
      ? env.output.sections.topDelinquent.map((d) =>
          bullet(`${d.address} — ${d.amount} (${d.daysOverdue} days)`)
        )
      : [p('No delinquent accounts listed.')]),
    h('Recommendations', HeadingLevel.HEADING_2),
    ...(env.output.sections.recommendations.length
      ? env.output.sections.recommendations.map((r) => bullet(r.content))
      : [p('No recommendations.')]),
  ];
}

function docxContentForOZRF(env: OZRFSectionEnvelope) {
  const { communityImpact, investmentFacilitation, environmentalSocial, disclosureStatement } =
    env.output.sections;

  return [
    h(env.output.title, HeadingLevel.HEADING_1),
    p(
      `Reporting Period: ${env.output.metadata.reportingPeriod} • Prepared ${env.output.metadata.preparedDate}`
    ),
    h('Community Impact Metrics', HeadingLevel.HEADING_2),
    ...[
      `Jobs Created: ${communityImpact.jobsCreated.value}`,
      `Jobs Retained: ${communityImpact.jobsRetained.value}`,
      `Local Hiring Rate: ${communityImpact.localHiringRate.value}`,
    ].map(bullet),
    h('Investment Facilitation', HeadingLevel.HEADING_2),
    ...[
      `Total Investment Attracted: ${investmentFacilitation.totalInvestment.value}`,
      `QOF Investments: ${investmentFacilitation.qofInvestments.value}`,
      `Business Relocations: ${investmentFacilitation.businessRelocations.value}`,
    ].map(bullet),
    h('Environmental & Social Outcomes', HeadingLevel.HEADING_2),
    ...(environmentalSocial.length
      ? environmentalSocial.map((m) => bullet(`${m.metric}: ${m.value}`))
      : [p('No environmental/social outcomes.')]),
    h('Disclosure Statement', HeadingLevel.HEADING_2),
    p(disclosureStatement),
  ];
}

export async function exportStructuredOutputToDocx(data: unknown): Promise<void> {
  if (!isAgentEnvelope(data)) throw new Error('Invalid structured output');

  const env = data;
  const children =
    env.agentId === 'board-brief'
      ? docxContentForBoardBrief(env as BoardBriefEnvelope)
      : env.agentId === 'assessment-trends'
        ? docxContentForAssessmentTrends(env as AssessmentTrendsEnvelope)
        : docxContentForOZRF(env as OZRFSectionEnvelope);

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${env.agentId}-${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(blob, filename);
}

export async function exportStructuredOutputToPDF(data: unknown): Promise<void> {
  if (!isAgentEnvelope(data)) throw new Error('Invalid structured output');

  const env = data;
  const html =
    env.agentId === 'board-brief'
      ? boardBriefToHtml(env as BoardBriefEnvelope)
      : env.agentId === 'assessment-trends'
        ? assessmentTrendsToHtml(env as AssessmentTrendsEnvelope)
        : ozrfSectionToHtml(env as OZRFSectionEnvelope);

  const filename = `${env.agentId}-${new Date().toISOString().slice(0, 10)}.pdf`;
  await exportReportToPDF(html, filename, {
    title: env.agentId,
  });
}

export async function exportStructuredOutput(
  data: unknown,
  format: 'docx' | 'pdf'
): Promise<void> {
  if (format === 'docx') return exportStructuredOutputToDocx(data);
  return exportStructuredOutputToPDF(data);
}

export interface BoardBriefContent {
  title: string;
  subtitle?: string;
  sections: Array<{
    heading: string;
    items?: string[];
    text?: string;
    metrics?: Array<{ label: string; value: string }>;
  }>;
  citations?: Array<{ text?: string; source: string }>;
}

export interface ExportBoardReportDocxParams {
  boardBrief: BoardBriefContent | null;
  editorContent: string | null;
  filename?: string;
}

export async function exportBoardReportDocx(
  params: ExportBoardReportDocxParams
): Promise<void> {
  const { boardBrief, editorContent, filename = 'board-report' } = params;

  const response = await fetch('/api/export/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardBrief, editorContent, filename }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Export failed');
  }

  const blob = await response.blob();
  saveAs(blob, `${filename}.docx`);
}
