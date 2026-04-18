/**
 * StrategySection — Sprint E / E2 Strategy skill surface inside Deal Room.
 *
 * Renders one card per strategy skill (3 in E2, 7 by E3). Each card has
 * a Run button + inline inputs. Clicking Run:
 *   1. POST /api/skills/run
 *   2. Render output via StrategyArtifactRenderer in an expanded panel below
 *   3. Output persists in deal_room_artifacts (visible in left panel history too)
 *
 * Strategy skills are distinguished from doc-backed generators by skill_key
 * (hardcoded list in STRATEGY_SKILLS). This keeps concerns clean — the
 * existing "Generate:" chip bar above still handles doc-backed artifacts.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';
import StrategyArtifactRenderer from './StrategyArtifactRenderer';

// Strategy skill keys and metadata. 7 in E3 (3 E2 + 4 E3).
const STRATEGY_SKILL_KEYS = [
  'pursuit_go_no_go',
  'fee_strategy_architect',
  'competitor_teardown',
  'acquisition_playbook',
  'growth_plan_generator',
  'bid_oz_opportunity_brief',
  'stakeholder_entry_map',
];

const SKILL_META: Record<string, { description: string; stage: string }> = {
  pursuit_go_no_go: {
    description: 'Disciplined Go/No-Go gate across fit, fee, relationships, competition, risk.',
    stage: 'close',
  },
  fee_strategy_architect: {
    description: 'Floor / target / ceiling with risk-adjusted P(win) and value-capture levers.',
    stage: 'close',
  },
  competitor_teardown: {
    description: 'Named-competitor analysis for a specific market segment or pursuit.',
    stage: 'enrich',
  },
  acquisition_playbook: {
    description: 'Multi-touch engagement plan — decision-maker map, warmth pathways, cadence.',
    stage: 'personalize',
  },
  growth_plan_generator: {
    description: 'Period-over-period growth plan with strategic initiatives and owner + revenue impact.',
    stage: 'close',
  },
  bid_oz_opportunity_brief: {
    description: 'IRS-verified OZ brief with Census demographics and §1400Z-2 deadlines.',
    stage: 'identify',
  },
  stakeholder_entry_map: {
    description: 'Role-based stakeholder map with warmth signals and first-touch guidance.',
    stage: 'enrich',
  },
};

const STAGE_COLORS: Record<string, string> = {
  identify: '#6B2FD9',
  enrich: '#8B5CF6',
  personalize: '#10B981',
  automate: '#F59E0B',
  close: '#0D1B3E',
};

interface SkillMeta {
  skill_key: string;
  skill_name: string;
  revenue_loop_stage: string;
  input_schema: any;
  output_schema: any;
  version: number;
  is_tenant_override: boolean;
}

interface Opportunity {
  id: string;
  account_name?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  stage?: string | null;
}

// Format opportunity for a dropdown option. Never show a bare UUID.
function prospectLabel(o: Opportunity): string {
  const account = (o.account_name || '').trim();
  const contact = (o.contact_name || '').trim();
  if (account && contact) return `${account} — ${contact}`;
  if (account) return account;
  if (contact) return contact;
  return `Prospect ${o.id.slice(0, 8)}`;
}

interface Props {
  dealRoomId: string;
  defaultOpportunityId?: string | null;
  onArtifactCreated?: (artifact: any) => void;
}

const StrategySection: React.FC<Props> = ({ dealRoomId, defaultOpportunityId, onArtifactCreated }) => {
  const { token } = useSandbox();
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    fetch('/api/skills', { headers: h })
      .then((r) => r.json())
      .then((d) => {
        const list: SkillMeta[] = (d.skills || [])
          .filter((s: SkillMeta) => STRATEGY_SKILL_KEYS.includes(s.skill_key))
          .sort(
            (a: SkillMeta, b: SkillMeta) =>
              STRATEGY_SKILL_KEYS.indexOf(a.skill_key) - STRATEGY_SKILL_KEYS.indexOf(b.skill_key)
          );
        setSkills(list);
      })
      .catch((err) => console.error('[strategy] skills load failed:', err?.message));

    fetch('/api/opportunities?limit=200', { headers: h })
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d.opportunities) ? d.opportunities : Array.isArray(d) ? d : [];
        setOpps(arr);
      })
      .catch((err) => console.error('[strategy] opportunities load failed:', err?.message));
  }, [token]);

  // Seed default inputs when skills load
  useEffect(() => {
    if (skills.length === 0) return;
    setInputs((prev) => {
      const next = { ...prev };
      for (const s of skills) {
        if (!next[s.skill_key]) {
          next[s.skill_key] = seedInput(s.skill_key, defaultOpportunityId);
        }
      }
      return next;
    });
  }, [skills, defaultOpportunityId]);

  function setInputField(skillKey: string, field: string, value: any) {
    setInputs((prev) => ({
      ...prev,
      [skillKey]: { ...(prev[skillKey] || {}), [field]: value },
    }));
  }

  async function runOne(skillKey: string) {
    if (!token || running) return;
    setRunning(skillKey);
    setErrors((e) => ({ ...e, [skillKey]: '' }));
    try {
      const res = await fetch('/api/skills/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deal_room_id: dealRoomId,
          skill_key: skillKey,
          input: inputs[skillKey] || {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Run failed (${res.status})`);
      setResults((r) => ({ ...r, [skillKey]: data.artifact }));
      if (onArtifactCreated) onArtifactCreated(data.artifact);
    } catch (err: any) {
      setErrors((e) => ({ ...e, [skillKey]: err.message || 'run failed' }));
    } finally {
      setRunning(null);
    }
  }

  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-gray-700/30 bg-gray-900/40">
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Strategy:</span>
        <span className="text-[10px] text-gray-600">senior-consultant moves</span>
      </div>
      <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-2">
        {skills.map((s) => {
          const isRunning = running === s.skill_key;
          const isExpanded = expanded === s.skill_key;
          const err = errors[s.skill_key];
          const result = results[s.skill_key];
          const stageColor = STAGE_COLORS[s.revenue_loop_stage] || '#6B2FD9';
          const meta = SKILL_META[s.skill_key];
          return (
            <div
              key={s.skill_key}
              className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-100 truncate">{s.skill_name}</span>
                    {s.revenue_loop_stage && (
                      <span
                        className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: stageColor }}
                      >
                        {s.revenue_loop_stage}
                      </span>
                    )}
                    {s.is_tenant_override && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-700 text-white">
                        custom
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{meta?.description}</p>
                </div>
              </div>

              <SkillInputs
                skillKey={s.skill_key}
                input={inputs[s.skill_key] || {}}
                opps={opps}
                onChange={(field, value) => setInputField(s.skill_key, field, value)}
                disabled={isRunning}
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={() => runOne(s.skill_key)}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {isRunning ? 'Running…' : 'Run'}
                </button>
                {result && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : s.skill_key)}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {isExpanded ? 'Hide output' : 'Show output'}
                  </button>
                )}
              </div>

              {err && (
                <div className="text-[11px] text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-2 py-1">
                  {err}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded result panel below the cards. Caps at 50vh with internal
          scroll so the editor + assistant panels below stay reachable. */}
      {expanded && results[expanded] && (
        <div className="border-t border-gray-700/30 bg-gray-900/20">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500">Output</span>
            <button
              onClick={() => setExpanded(null)}
              className="text-[11px] text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="px-4 pb-4 max-h-[50vh] overflow-y-auto">
            <StrategyArtifactRenderer
              artifactType={expanded}
              content={results[expanded]?.content}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Per-skill input widgets
// ---------------------------------------------------------------------------

const SkillInputs: React.FC<{
  skillKey: string;
  input: any;
  opps: Opportunity[];
  onChange: (field: string, value: any) => void;
  disabled?: boolean;
}> = ({ skillKey, input, opps, onChange, disabled }) => {
  const inputCls = 'bg-gray-900/60 border border-gray-700/50 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/60';

  if (skillKey === 'pursuit_go_no_go' || skillKey === 'fee_strategy_architect') {
    return (
      <ProspectPicker opps={opps} value={input.prospectId} onChange={(v) => onChange('prospectId', v)} disabled={disabled} />
    );
  }

  if (skillKey === 'competitor_teardown') {
    return (
      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={input.competitorName || ''}
          onChange={(e) => onChange('competitorName', e.target.value)}
          placeholder="Competitor name"
          disabled={disabled}
          className={inputCls}
        />
        <input
          type="text"
          value={input.marketSegment || ''}
          onChange={(e) => onChange('marketSegment', e.target.value)}
          placeholder="Market segment (e.g. NYC high-rise MEP)"
          disabled={disabled}
          className={inputCls}
        />
        <ProspectPicker opps={opps} value={input.prospectId} onChange={(v) => onChange('prospectId', v)} disabled={disabled} optional />
      </div>
    );
  }

  if (skillKey === 'acquisition_playbook') {
    return (
      <div className="flex flex-col gap-1.5">
        <ProspectPicker opps={opps} value={input.prospectId} onChange={(v) => onChange('prospectId', v)} disabled={disabled} />
        <input
          type="text"
          value={input.objective || ''}
          onChange={(e) => onChange('objective', e.target.value)}
          placeholder="Objective (e.g. book discovery call)"
          disabled={disabled}
          className={inputCls}
        />
        <select
          value={String(input.timeframeMonths || 3)}
          onChange={(e) => onChange('timeframeMonths', Number(e.target.value))}
          disabled={disabled}
          className={inputCls}
        >
          <option value="1">1 month</option>
          <option value="2">2 months</option>
          <option value="3">3 months (default)</option>
          <option value="6">6 months</option>
          <option value="12">12 months</option>
        </select>
      </div>
    );
  }

  if (skillKey === 'growth_plan_generator') {
    return (
      <div className="flex flex-col gap-1.5">
        <select
          value={input.period || 'quarter'}
          onChange={(e) => onChange('period', e.target.value)}
          disabled={disabled}
          className={inputCls}
        >
          <option value="quarter">Quarter</option>
          <option value="annual">Annual</option>
        </select>
        <input
          type="text"
          value={(input.focusAreas || []).join(', ')}
          onChange={(e) =>
            onChange(
              'focusAreas',
              e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
            )
          }
          placeholder="Focus areas, comma-separated (optional)"
          disabled={disabled}
          className={inputCls}
        />
      </div>
    );
  }

  if (skillKey === 'bid_oz_opportunity_brief') {
    return (
      <div className="flex flex-col gap-1.5">
        <select
          value={input.locationType || 'oz_tract'}
          onChange={(e) => onChange('locationType', e.target.value)}
          disabled={disabled}
          className={inputCls}
        >
          <option value="oz_tract">OZ tract (11-digit GEOID)</option>
          <option value="bid">BID (name or id)</option>
        </select>
        <input
          type="text"
          value={input.locationId || ''}
          onChange={(e) => onChange('locationId', e.target.value)}
          placeholder={input.locationType === 'bid' ? 'e.g. Golden Triangle BID' : '11-digit GEOID, e.g. 36047003300'}
          disabled={disabled}
          className={inputCls}
        />
        <input
          type="text"
          value={(input.firmCapabilities || []).join(', ')}
          onChange={(e) =>
            onChange(
              'firmCapabilities',
              e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
            )
          }
          placeholder="Firm capabilities, comma-separated"
          disabled={disabled}
          className={inputCls}
        />
        <select
          value={String(input.horizonMonths || 12)}
          onChange={(e) => onChange('horizonMonths', Number(e.target.value))}
          disabled={disabled}
          className={inputCls}
        >
          <option value="6">6-month horizon</option>
          <option value="12">12-month horizon (default)</option>
          <option value="24">24-month horizon</option>
          <option value="36">36-month horizon</option>
        </select>
      </div>
    );
  }

  if (skillKey === 'stakeholder_entry_map') {
    return (
      <div className="flex flex-col gap-1.5">
        <select
          value={input.districtType || 'bid'}
          onChange={(e) => onChange('districtType', e.target.value)}
          disabled={disabled}
          className={inputCls}
        >
          <option value="bid">BID</option>
          <option value="oz_tract">OZ tract</option>
          <option value="municipality">Municipality</option>
        </select>
        <input
          type="text"
          value={input.districtId || ''}
          onChange={(e) => onChange('districtId', e.target.value)}
          placeholder="District name or id"
          disabled={disabled}
          className={inputCls}
        />
        <input
          type="text"
          value={input.firmName || ''}
          onChange={(e) => onChange('firmName', e.target.value)}
          placeholder="Your firm name"
          disabled={disabled}
          className={inputCls}
        />
      </div>
    );
  }

  return null;
};

const ProspectPicker: React.FC<{
  opps: Opportunity[];
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  optional?: boolean;
}> = ({ opps, value, onChange, disabled, optional }) => (
  <select
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className="bg-gray-900/60 border border-gray-700/50 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-purple-500/60"
  >
    <option value="">{optional ? 'No prospect (optional)' : 'Select prospect…'}</option>
    {opps.map((o) => (
      <option key={o.id} value={o.id}>
        {prospectLabel(o)}
        {o.stage ? ` · ${o.stage}` : ''}
      </option>
    ))}
  </select>
);

function seedInput(skillKey: string, defaultOpportunityId?: string | null): any {
  const base: any = {};
  const prospectSkills = new Set(['pursuit_go_no_go', 'fee_strategy_architect', 'competitor_teardown', 'acquisition_playbook']);
  if (defaultOpportunityId && prospectSkills.has(skillKey)) {
    base.prospectId = defaultOpportunityId;
  }
  if (skillKey === 'acquisition_playbook') {
    base.timeframeMonths = 3;
  }
  if (skillKey === 'growth_plan_generator') {
    base.period = 'quarter';
    base.focusAreas = [];
  }
  if (skillKey === 'bid_oz_opportunity_brief') {
    base.locationType = 'oz_tract';
    base.horizonMonths = 12;
    base.firmCapabilities = [];
  }
  if (skillKey === 'stakeholder_entry_map') {
    base.districtType = 'bid';
  }
  return base;
}

export default StrategySection;
