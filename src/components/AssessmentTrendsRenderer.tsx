import React from 'react';
import type {
  AssessmentTrendsEnvelope,
  StructuredCitation,
} from '../types/structuredOutputs';

function CitationMark({ citation }: { citation?: StructuredCitation }) {
  if (!citation) return null;
  return (
    <span className="ml-1 text-xs text-slate-400 align-super">[{citation.number}]</span>
  );
}

export default function AssessmentTrendsRenderer({
  trends,
}: {
  trends: AssessmentTrendsEnvelope;
}) {
  const { output } = trends;
  const { collectionSummary, delinquencyAging, topDelinquent, recommendations } =
    output.sections;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{output.title}</h2>
        <p className="text-sm text-slate-500">
          {output.metadata.period} • Prepared {output.metadata.preparedDate}
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Collection Summary</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-700">
                  Property Type
                </th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Billed</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">
                  Collected
                </th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Rate</th>
              </tr>
            </thead>
            <tbody>
              {collectionSummary.rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="px-3 py-2 text-slate-700">
                    {row.propertyType}
                    <CitationMark citation={row.citation} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.billed}</td>
                  <td className="px-3 py-2 text-slate-700">{row.collected}</td>
                  <td className="px-3 py-2 text-slate-700">{row.rate}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">
                  TOTAL
                  <CitationMark citation={collectionSummary.total.citation} />
                </td>
                <td className="px-3 py-2 font-medium text-slate-700">
                  {collectionSummary.total.billed}
                </td>
                <td className="px-3 py-2 font-medium text-slate-700">
                  {collectionSummary.total.collected}
                </td>
                <td className="px-3 py-2 font-medium text-slate-700">
                  {collectionSummary.total.rate}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Delinquency Aging</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {delinquencyAging.map((bucket, idx) => (
            <li key={idx}>
              <span className="font-medium">{bucket.bucket}:</span> {bucket.amount} (
              {bucket.propertyCount} properties)
              <CitationMark citation={bucket.citation} />
            </li>
          ))}
          {delinquencyAging.length === 0 ? (
            <li className="list-none text-slate-500">No delinquency aging data.</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Top Delinquent Accounts</h3>
        <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700 space-y-1">
          {topDelinquent.map((acct, idx) => (
            <li key={idx}>
              <span className="font-medium">{acct.address}</span> — {acct.amount} (
              {acct.daysOverdue} days)
              <CitationMark citation={acct.citation} />
            </li>
          ))}
          {topDelinquent.length === 0 ? (
            <li className="list-none text-slate-500">No delinquent accounts listed.</li>
          ) : null}
        </ol>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Recommendations</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {recommendations.map((rec, idx) => (
            <li key={idx}>{rec.content}</li>
          ))}
          {recommendations.length === 0 ? (
            <li className="list-none text-slate-500">No recommendations.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
