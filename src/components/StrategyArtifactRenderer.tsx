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

export default StrategyArtifactRenderer;
