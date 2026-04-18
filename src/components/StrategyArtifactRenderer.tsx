/**
 * StrategyArtifactRenderer — JSON-driven renderer for Sprint E / E2 skills.
 *
 * Handles three shapes (pursuit_go_no_go, fee_strategy_architect,
 * competitor_teardown) with a switch on artifact_type. Rich per-skill
 * renderers arrive in Sprint F; this is the "basic but presentable" path.
 *
 * Dark theme to match DealRoomPage (gradient gray-900 / blue-900).
 */

import React from 'react';

interface Citation {
  claim: string;
  source: string;
  sourceId?: string;
}

interface Props {
  artifactType: string;
  content: any;
}

const STAGE_COLORS: Record<string, string> = {
  close: '#0D1B3E',
  enrich: '#8B5CF6',
  identify: '#6B2FD9',
  personalize: '#10B981',
  automate: '#F59E0B',
};

const StrategyArtifactRenderer: React.FC<Props> = ({ artifactType, content }) => {
  if (!content || typeof content !== 'object') {
    return <div className="text-sm text-gray-500 italic">No output yet.</div>;
  }

  switch (artifactType) {
    case 'pursuit_go_no_go':
      return <PursuitGoNoGo content={content} />;
    case 'fee_strategy_architect':
      return <FeeStrategy content={content} />;
    case 'competitor_teardown':
      return <CompetitorTeardown content={content} />;
    case 'acquisition_playbook':
      return <AcquisitionPlaybook content={content} />;
    case 'growth_plan_generator':
      return <GrowthPlan content={content} />;
    case 'bid_oz_opportunity_brief':
      return <BidOzOpportunityBrief content={content} />;
    case 'stakeholder_entry_map':
      return <StakeholderEntryMap content={content} />;
    default:
      return <JsonFallback content={content} />;
  }
};

// ---------------------------------------------------------------------------
// pursuit_go_no_go
// ---------------------------------------------------------------------------

const verdictColors: Record<string, string> = {
  GO: '#10B981',
  NO_GO: '#F59E0B',
  CONDITIONAL: '#8B5CF6',
};

const PursuitGoNoGo: React.FC<{ content: any }> = ({ content }) => {
  const verdict = content.verdict || 'CONDITIONAL';
  const color = verdictColors[verdict] || '#8B5CF6';
  const scores = content.scores || {};
  const rationale = content.rationale || {};

  return (
    <div className="space-y-5">
      {/* Verdict header */}
      <div className="flex items-center gap-3">
        <span
          className="px-3 py-1 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {verdict.replace('_', ' ')}
        </span>
        <span className="text-2xl font-bold text-white">{content.compositeScore ?? '—'}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wider">composite</span>
      </div>

      {/* Scores row */}
      <div className="grid grid-cols-5 gap-2">
        {['fit', 'feeViability', 'relationships', 'competition', 'risk'].map((k) => (
          <div key={k} className="bg-gray-800/40 border border-gray-700/40 rounded p-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">{k}</div>
            <div className="text-lg font-semibold text-gray-100">{scores[k] ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Conditions (CONDITIONAL only) */}
      {Array.isArray(content.conditions) && content.conditions.length > 0 && (
        <Section title="Conditions to flip to GO">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
            {content.conditions.map((c: string, i: number) => <li key={i}>{c}</li>)}
          </ul>
        </Section>
      )}

      {/* Rationale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RationaleList title="Strengths" items={rationale.strengths} accent="#10B981" />
        <RationaleList title="Weaknesses" items={rationale.weaknesses} accent="#F59E0B" />
        <RationaleList title="Dealbreakers" items={rationale.dealbreakers} accent="#EF4444" />
      </div>

      {/* Recommended action */}
      <Section title="Recommended next action">
        <p className="text-sm text-gray-200">{content.recommendedAction || '—'}</p>
      </Section>

      <CitationsBlock citations={content.citations} />
    </div>
  );
};

const RationaleList: React.FC<{ title: string; items?: string[]; accent: string }> = ({ title, items, accent }) => (
  <div className="bg-gray-800/40 border border-gray-700/40 rounded p-3">
    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: accent }}>{title}</div>
    {Array.isArray(items) && items.length > 0 ? (
      <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-200">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    ) : <div className="text-xs text-gray-500 italic">none</div>}
  </div>
);

// ---------------------------------------------------------------------------
// fee_strategy_architect
// ---------------------------------------------------------------------------

const FeeStrategy: React.FC<{ content: any }> = ({ content }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <FeeCard label="Floor" data={content.floor} />
      <FeeCard label="Target" data={content.target} highlight />
      <FeeCard label="Ceiling" data={content.ceiling} />
    </div>

    <Section title="Discount triggers">
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
        {(content.discountTriggers || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
      </ul>
    </Section>

    <Section title="Value-capture levers">
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
        {(content.valueCaptureLevers || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
      </ul>
    </Section>

    <CitationsBlock citations={content.citations} />
  </div>
);

const FeeCard: React.FC<{ label: string; data: any; highlight?: boolean }> = ({ label, data, highlight }) => {
  if (!data) return null;
  const amount = typeof data.amount === 'number'
    ? data.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';
  return (
    <div className={`rounded p-3 border ${highlight ? 'bg-purple-900/30 border-purple-500/40' : 'bg-gray-800/40 border-gray-700/40'}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className="text-xl font-bold text-white mt-0.5">{amount}</div>
      {data.probabilityWin != null && (
        <div className="text-xs text-gray-300 mt-0.5">P(win): {(data.probabilityWin * 100).toFixed(0)}%</div>
      )}
      {data.marginAssumption != null && (
        <div className="text-xs text-gray-300 mt-0.5">Margin: {(data.marginAssumption * 100).toFixed(0)}%</div>
      )}
      <div className="text-xs text-gray-400 mt-2 leading-snug">{data.rationale}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// competitor_teardown
// ---------------------------------------------------------------------------

const CompetitorTeardown: React.FC<{ content: any }> = ({ content }) => (
  <div className="space-y-5">
    {content.feePattern && (
      <Section title="Fee pattern">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-xs uppercase tracking-wider text-gray-200">
            {content.feePattern.pattern || 'unknown'}
          </span>
        </div>
        <p className="text-sm text-gray-300">{content.feePattern.evidence}</p>
      </Section>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <RationaleList title="Strengths to expect" items={content.strengths} accent="#F59E0B" />
      <RationaleList title="Weaknesses to press" items={content.weaknesses} accent="#10B981" />
    </div>

    {Array.isArray(content.recentActivity) && content.recentActivity.length > 0 && (
      <Section title="Recent activity (24 months)">
        <ul className="divide-y divide-gray-700/40">
          {content.recentActivity.map((a: any, i: number) => (
            <li key={i} className="py-1.5 text-sm text-gray-200 flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{a.outcome}</span>
              <span className="flex-1">{a.project}</span>
              {a.value && <span className="text-xs text-gray-400">{a.value}</span>}
              {a.year && <span className="text-xs text-gray-500">{a.year}</span>}
            </li>
          ))}
        </ul>
      </Section>
    )}

    {Array.isArray(content.principalTurnover) && content.principalTurnover.length > 0 && (
      <Section title="Principal turnover">
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
          {content.principalTurnover.map((p: string, i: number) => <li key={i}>{p}</li>)}
        </ul>
      </Section>
    )}

    {content.likelyPursuitApproach && (
      <Section title="Likely pursuit approach">
        <p className="text-sm text-gray-200">{content.likelyPursuitApproach}</p>
      </Section>
    )}

    <CitationsBlock citations={content.citations} />
  </div>
);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">{title}</div>
    {children}
  </div>
);

const CitationsBlock: React.FC<{ citations?: Citation[] }> = ({ citations }) => {
  if (!Array.isArray(citations) || citations.length === 0) return null;
  return (
    <div className="border-t border-gray-700/40 pt-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Citations</div>
      <ul className="space-y-1 text-xs text-gray-400">
        {citations.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span
              className="shrink-0 uppercase tracking-wider px-1.5 rounded text-[9px] self-start mt-0.5"
              style={{
                backgroundColor: c.source === 'missing_evidence' || c.source === 'weak_sourcing' ? '#F59E0B' : '#6B2FD9',
                color: 'white',
              }}
            >
              {c.source}
            </span>
            <span>{c.claim}{c.sourceId ? ` (${c.sourceId})` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const JsonFallback: React.FC<{ content: any }> = ({ content }) => (
  <pre className="text-xs text-gray-300 bg-gray-900/60 border border-gray-700/40 rounded p-3 overflow-auto whitespace-pre-wrap">
    {JSON.stringify(content, null, 2)}
  </pre>
);

// ---------------------------------------------------------------------------
// acquisition_playbook
// ---------------------------------------------------------------------------

const AcquisitionPlaybook: React.FC<{ content: any }> = ({ content }) => {
  const dm = content.decisionMakerMap || {};
  const warmthColor: Record<string, string> = { strong: '#10B981', medium: '#8B5CF6', weak: '#F59E0B', none: '#6B7280' };
  return (
    <div className="space-y-5">
      <Section title="Decision-maker">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: dm.identified ? '#10B981' : '#F59E0B',
              color: dm.identified ? 'white' : '#0D1B3E',
            }}
          >
            {dm.identified ? 'Identified' : 'Not yet identified'}
          </span>
          {dm.name && <span className="text-gray-100 font-medium">{dm.name}</span>}
          {dm.title && <span className="text-gray-400 text-sm">{dm.title}</span>}
        </div>
        {dm.rationale && <p className="text-sm text-gray-300 mt-1">{dm.rationale}</p>}
        {dm.discoveryPlan && (
          <p className="text-xs text-gray-400 mt-1">
            <span className="uppercase tracking-wider text-gray-500 mr-1">Discovery:</span>
            {dm.discoveryPlan}
          </p>
        )}
      </Section>

      {Array.isArray(content.touchSequence) && content.touchSequence.length > 0 && (
        <Section title="Touch sequence">
          <ol className="space-y-2">
            {content.touchSequence.map((t: any, i: number) => (
              <li key={i} className="bg-gray-800/40 border border-gray-700/40 rounded p-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-400">#{t.order ?? i + 1}</span>
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900 text-gray-200">{t.channel}</span>
                  {t.dayOffset != null && <span className="text-[10px] text-gray-500">Day +{t.dayOffset}</span>}
                </div>
                <div className="text-sm text-gray-100 mt-1">{t.themeSummary}</div>
                {t.trigger && <div className="text-xs text-gray-400 mt-0.5"><span className="text-gray-500">Trigger: </span>{t.trigger}</div>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {Array.isArray(content.warmthPathways) && content.warmthPathways.length > 0 && (
        <Section title="Warmth pathways">
          <ul className="space-y-1">
            {content.warmthPathways.map((w: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-200">
                <span
                  className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: warmthColor[w.strength] || '#6B7280' }}
                >
                  {w.strength}
                </span>
                <span>{w.path}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(content.conversationStarters) && content.conversationStarters.length > 0 && (
        <Section title="Conversation starters">
          <ul className="space-y-1.5 text-sm text-gray-200">
            {content.conversationStarters.map((c: any, i: number) => (
              <li key={i}>
                <div>{c.hook}</div>
                {c.source && <div className="text-xs text-gray-500">source: {c.source}</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {content.cadence && (
          <div className="bg-gray-800/40 border border-gray-700/40 rounded p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Cadence</div>
            <div className="text-sm text-gray-200">{content.cadence}</div>
          </div>
        )}
        {content.successMetric && (
          <div className="bg-gray-800/40 border border-gray-700/40 rounded p-3">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Success metrics</div>
            <div className="text-xs text-gray-300"><span className="text-gray-500">Day 30:</span> {content.successMetric.day30}</div>
            <div className="text-xs text-gray-300 mt-0.5"><span className="text-gray-500">Day 60:</span> {content.successMetric.day60}</div>
          </div>
        )}
      </div>

      <CitationsBlock citations={content.citations} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// growth_plan_generator
// ---------------------------------------------------------------------------

const GrowthPlan: React.FC<{ content: any }> = ({ content }) => {
  const severityColor: Record<string, string> = { low: '#10B981', medium: '#8B5CF6', high: '#F59E0B', critical: '#EF4444' };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{content.title || 'Growth Plan'}</h2>
        {content.reportingPeriod && (
          <div className="text-xs uppercase tracking-wider text-gray-400 mt-0.5">{content.reportingPeriod}</div>
        )}
      </div>

      {Array.isArray(content.executiveSummary) && content.executiveSummary.length > 0 && (
        <Section title="Executive summary">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
            {content.executiveSummary.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </Section>
      )}

      {Array.isArray(content.keyMetrics) && content.keyMetrics.length > 0 && (
        <Section title="Key metrics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {content.keyMetrics.map((m: any, i: number) => (
              <div key={i} className="bg-gray-800/40 border border-gray-700/40 rounded p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-gray-400">{m.label}</div>
                <div className="text-sm text-gray-100 mt-0.5">
                  <span className="text-gray-400">{m.current}</span>
                  <span className="text-gray-500 mx-1">→</span>
                  <span className="font-semibold">{m.goal}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {Array.isArray(content.strategicInitiatives) && content.strategicInitiatives.length > 0 && (
        <Section title="Strategic initiatives">
          <ul className="space-y-2">
            {content.strategicInitiatives.map((ini: any, i: number) => (
              <li key={i} className="bg-gray-800/40 border border-gray-700/40 rounded p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-100">{ini.name}</span>
                  {ini.owner && <span className="text-xs text-gray-400">owner: {ini.owner}</span>}
                  {ini.timelineMonths && <span className="text-xs text-gray-500">{ini.timelineMonths} mo</span>}
                </div>
                <div className="text-xs text-gray-300 mt-1">{ini.rationale}</div>
                {ini.revenueImpactEstimate && (
                  <div className="text-xs text-emerald-400 mt-1">Revenue impact: {ini.revenueImpactEstimate}</div>
                )}
                {Array.isArray(ini.dependencies) && ini.dependencies.length > 0 && (
                  <div className="text-[11px] text-gray-500 mt-1">Depends on: {ini.dependencies.join(', ')}</div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(content.risks) && content.risks.length > 0 && (
        <Section title="Risks">
          <ul className="space-y-1.5">
            {content.risks.map((r: any, i: number) => (
              <li key={i} className="text-sm text-gray-200 flex items-start gap-2">
                <span
                  className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white mt-0.5"
                  style={{ backgroundColor: severityColor[r.severity] || '#6B7280' }}
                >
                  {r.severity}
                </span>
                <div>
                  <div>{r.risk}</div>
                  <div className="text-xs text-gray-500">Mitigation: {r.mitigation}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(content.recommendations) && content.recommendations.length > 0 && (
        <Section title="Recommendations">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-200">
            {content.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ol>
        </Section>
      )}

      <CitationsBlock citations={content.citations} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// bid_oz_opportunity_brief
// ---------------------------------------------------------------------------

const BidOzOpportunityBrief: React.FC<{ content: any }> = ({ content }) => {
  const v = content.locationVerified || {};
  const eco = content.economicBaseline || {};
  const num = (x: any, fmt: (n: number) => string) =>
    typeof x === 'number' && Number.isFinite(x) ? fmt(x) : '—';
  const usd = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: v.verified ? '#10B981' : '#F59E0B',
            color: v.verified ? 'white' : '#0D1B3E',
          }}
        >
          {v.verified ? 'LOCATION VERIFIED' : 'UNVERIFIED'}
        </span>
        {v.tractId && <span className="text-sm text-gray-300">Tract {v.tractId}</span>}
        {v.source && <span className="text-xs text-gray-500">via {v.source}</span>}
        {v.designationDate && <span className="text-xs text-gray-500">designated {v.designationDate}</span>}
      </div>

      {v.note && <p className="text-xs text-amber-300">{v.note}</p>}

      <Section title="Project thesis">
        <p className="text-sm text-gray-200">{content.projectThesis || '—'}</p>
      </Section>

      <Section title={`Economic baseline${eco.acsYear ? ` (ACS ${eco.acsYear})` : ''}`}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            ['Median income', num(eco.medianIncome, usd)],
            ['Population', num(eco.population, (n) => n.toLocaleString())],
            ['Housing units', num(eco.housingUnits, (n) => n.toLocaleString())],
            ['Poverty rate', num(eco.povertyRate, pct)],
            ['Median home value', num(eco.medianHomeValue, usd)],
            ['Median gross rent', num(eco.medianGrossRent, usd)],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-800/40 border border-gray-700/40 rounded p-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
              <div className="text-sm text-gray-100 mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      </Section>

      {Array.isArray(content.keyStakeholders) && content.keyStakeholders.length > 0 && (
        <Section title="Key stakeholders">
          <ul className="space-y-1.5 text-sm text-gray-200">
            {content.keyStakeholders.map((s: any, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900 text-gray-300 self-start mt-0.5">{s.role}</span>
                <div>
                  {s.name && <span className="text-gray-100 font-medium">{s.name}</span>}
                  <div className="text-xs text-gray-400">{s.entryApproach}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(content.taxTimingFlags) && content.taxTimingFlags.length > 0 && (
        <Section title="Tax timing (26 U.S.C. §1400Z-2)">
          <ul className="space-y-1.5">
            {content.taxTimingFlags.map((t: any, i: number) => (
              <li key={i} className="bg-gray-800/40 border border-gray-700/40 rounded p-2.5 text-sm text-gray-200">
                <div className="font-medium">{t.rule}</div>
                {t.deadline && <div className="text-xs text-amber-400">Deadline: {t.deadline}</div>}
                <div className="text-xs text-gray-400 mt-0.5">{t.impact}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(content.relationshipEntryPoints) && content.relationshipEntryPoints.length > 0 && (
        <Section title="Relationship entry points">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
            {content.relationshipEntryPoints.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </Section>
      )}

      {Array.isArray(content.recommendedNextActions) && content.recommendedNextActions.length > 0 && (
        <Section title="Recommended next actions">
          <ul className="space-y-1">
            {content.recommendedNextActions.map((a: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-700 text-white self-start mt-0.5">{a.owner}</span>
                <div>
                  <div>{a.action}</div>
                  {a.timeframe && <div className="text-xs text-gray-500">timeframe: {a.timeframe}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CitationsBlock citations={content.citations} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// stakeholder_entry_map
// ---------------------------------------------------------------------------

const StakeholderEntryMap: React.FC<{ content: any }> = ({ content }) => {
  const warmthColor: Record<string, string> = { hot: '#EF4444', warm: '#F59E0B', cold: '#6B7280', unknown: '#8B5CF6' };
  return (
    <div className="space-y-5">
      {Array.isArray(content.stakeholders) && content.stakeholders.length > 0 && (
        <Section title="Stakeholders">
          <ul className="space-y-2">
            {content.stakeholders.map((s: any, i: number) => {
              const firstTouch = s.suggestedFirstTouch || {};
              return (
                <li key={i} className="bg-gray-800/40 border border-gray-700/40 rounded p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: warmthColor[s.warmthSignal] || '#6B7280' }}
                    >
                      {s.warmthSignal}
                    </span>
                    <span className="text-sm text-gray-100">
                      {s.role}
                      {s.name ? ` — ${s.name}` : ''}
                    </span>
                    {s.organization && <span className="text-xs text-gray-400">@ {s.organization}</span>}
                  </div>
                  {s.relationshipBasis && (
                    <div className="text-xs text-gray-400 mt-1">{s.relationshipBasis}</div>
                  )}
                  {firstTouch.channel && (
                    <div className="mt-1.5 text-xs text-gray-300">
                      <span className="uppercase tracking-wider text-gray-500 mr-1">First touch:</span>
                      <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900 text-gray-200 mr-1">{firstTouch.channel}</span>
                    </div>
                  )}
                  {Array.isArray(firstTouch.talkingPoints) && firstTouch.talkingPoints.length > 0 && (
                    <ul className="list-disc pl-5 mt-1 text-xs text-gray-300 space-y-0.5">
                      {firstTouch.talkingPoints.map((p: string, j: number) => <li key={j}>{p}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {content.sequencingAdvice && (
        <Section title="Sequencing">
          <p className="text-sm text-gray-200">{content.sequencingAdvice}</p>
        </Section>
      )}

      {Array.isArray(content.networkPaths) && content.networkPaths.length > 0 && (
        <Section title="Network paths">
          <ul className="space-y-1 text-sm text-gray-200">
            {content.networkPaths.map((p: any, i: number) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900 text-gray-300">{p.strength}</span>
                <span>{p.from}</span>
                <span className="text-gray-500">→ {p.hops} hop{p.hops === 1 ? '' : 's'} →</span>
                <span className="font-medium">{p.to}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(content.risksAndPitfalls) && content.risksAndPitfalls.length > 0 && (
        <Section title="Risks and pitfalls">
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
            {content.risksAndPitfalls.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </Section>
      )}

      <CitationsBlock citations={content.citations} />
    </div>
  );
};

export default StrategyArtifactRenderer;
