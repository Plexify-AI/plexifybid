import React from 'react';
import type {
  OZRFSectionEnvelope,
  StructuredCitation,
} from '../types/structuredOutputs';

function CitationMark({ citation }: { citation?: StructuredCitation }) {
  if (!citation) return null;
  return (
    <span className="ml-1 text-xs text-slate-400 align-super">[{citation.number}]</span>
  );
}

function MetricCard({
  label,
  value,
  citation,
}: {
  label: string;
  value: React.ReactNode;
  citation?: StructuredCitation;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {value}
        <CitationMark citation={citation} />
      </div>
    </div>
  );
}

export default function OZRFSectionRenderer({
  section,
}: {
  section: OZRFSectionEnvelope;
}) {
  const { output } = section;
  const { communityImpact, investmentFacilitation, environmentalSocial, disclosureStatement } =
    output.sections;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{output.title}</h2>
        <p className="text-sm text-slate-500">
          Reporting Period: {output.metadata.reportingPeriod} • Prepared{' '}
          {output.metadata.preparedDate}
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Community Impact Metrics</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Jobs Created"
            value={communityImpact.jobsCreated.value}
            citation={communityImpact.jobsCreated.citation}
          />
          <MetricCard
            label="Jobs Retained"
            value={communityImpact.jobsRetained.value}
            citation={communityImpact.jobsRetained.citation}
          />
          <MetricCard
            label="Local Hiring Rate"
            value={communityImpact.localHiringRate.value}
            citation={communityImpact.localHiringRate.citation}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Investment Facilitation</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Total Investment Attracted"
            value={investmentFacilitation.totalInvestment.value}
            citation={investmentFacilitation.totalInvestment.citation}
          />
          <MetricCard
            label="QOF Investments"
            value={investmentFacilitation.qofInvestments.value}
            citation={investmentFacilitation.qofInvestments.citation}
          />
          <MetricCard
            label="Business Relocations"
            value={investmentFacilitation.businessRelocations.value}
            citation={investmentFacilitation.businessRelocations.citation}
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">
          Environmental &amp; Social Outcomes
        </h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          {environmentalSocial.map((item, idx) => (
            <li key={idx}>
              <span className="font-medium">{item.metric}:</span> {item.value}
              <CitationMark citation={item.citation} />
            </li>
          ))}
          {environmentalSocial.length === 0 ? (
            <li className="list-none text-slate-500">No environmental/social outcomes.</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-800">Disclosure Statement</h3>
        <p className="mt-2 text-sm text-slate-700">{disclosureStatement}</p>
      </section>
    </div>
  );
}
