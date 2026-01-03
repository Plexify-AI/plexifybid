import React from 'react';
import type { BoardBriefEnvelope } from '../types/structuredOutputs';

export function boardBriefToHtml(brief: BoardBriefEnvelope): string {
  const esc = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const h = brief.output;
  const title = esc(h.title);

  const meta = [h.districtName, h.reportingPeriod].filter(Boolean).join(' • ');

  const ul = (items: string[]) =>
    `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

  const metrics = h.keyMetrics.length
    ? `<ul>${h.keyMetrics
        .map((m) => `<li><strong>${esc(m.label)}:</strong> ${esc(m.value)}</li>`)
        .join('')}</ul>`
    : '<p><em>No metrics provided.</em></p>';

  return [
    `<h1>${title}</h1>`,
    meta ? `<p><em>${esc(meta)}</em></p>` : '',
    `<h2>Executive Summary</h2>`,
    ul(h.executiveSummary),
    `<h2>Key Metrics</h2>`,
    metrics,
    `<h2>Highlights</h2>`,
    ul(h.highlights),
    `<h2>Risks</h2>`,
    ul(h.risks),
    `<h2>Recommendations</h2>`,
    ul(h.recommendations),
  ]
    .filter(Boolean)
    .join('\n');
}

export default function BoardBriefRenderer({
  brief,
  onGenerateAudio,
  isGeneratingAudio = false,
  hasAudio = false,
}: {
  brief: BoardBriefEnvelope;
  onGenerateAudio?: (brief: BoardBriefEnvelope) => void;
  isGeneratingAudio?: boolean;
  hasAudio?: boolean;
}) {
  const { output } = brief;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{output.title}</h2>
        {(output.districtName || output.reportingPeriod) && (
          <p className="text-sm text-slate-500">
            {[output.districtName, output.reportingPeriod]
              .filter(Boolean)
              .join(' • ')}
          </p>
        )}
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">
          Executive Summary
        </h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {output.executiveSummary.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Key Metrics</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {output.keyMetrics.map((m, idx) => (
            <li key={idx}>
              <span className="font-medium">{m.label}:</span> {m.value}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Highlights</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {output.highlights.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Risks</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {output.risks.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Recommendations</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {output.recommendations.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      {onGenerateAudio ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onGenerateAudio(brief)}
            disabled={isGeneratingAudio}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {isGeneratingAudio
              ? 'Generating audio…'
              : hasAudio
                ? 'Regenerate audio briefing'
                : 'Generate audio briefing'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
