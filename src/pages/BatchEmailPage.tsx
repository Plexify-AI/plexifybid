/**
 * BatchEmailPage — /batch-email
 *
 * Sprint BATCH-50 rebuild. Three-step flow:
 *   1. Select recipients (this file, fully wired)
 *   2. Pick template + per-recipient preview (Task 2/3 — placeholder for now)
 *   3. Review and send (Task 4 — placeholder for now)
 *
 * Hard cap 50 selected. List push-down filters: has_email, source_campaign,
 * substring search on name/company/email.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail, Loader2, Search, Filter, Check, ChevronRight, AlertCircle,
} from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

const MAX_SELECTED = 50;

interface Opportunity {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_title: string | null;
  account_name: string | null;
  warmth_score: number | null;
  stage: string | null;
  source_campaign: string | null;
  enrichment_data: Record<string, unknown> | null;
  deal_hypothesis: string | null;
}

interface Campaign {
  name: string;
  count: number;
}

type Step = 'select' | 'compose' | 'review';

const BatchEmailPage: React.FC = () => {
  const { token } = useSandbox();
  const [step, setStep] = useState<Step>('select');

  // Filter state
  const [campaignFilter, setCampaignFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [hasEmailOnly, setHasEmailOnly] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [limitCapped, setLimitCapped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Load campaigns once
  useEffect(() => {
    if (!token) return;
    setLoadingCampaigns(true);
    fetch('/api/batch-email/campaigns', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns || []))
      .catch(err => console.error('[BatchEmailPage] Campaigns load error:', err))
      .finally(() => setLoadingCampaigns(false));
  }, [token]);

  // Load opportunities when filters change
  useEffect(() => {
    if (!token) return;
    setLoadingOpps(true);
    setError(null);

    const params = new URLSearchParams();
    if (campaignFilter) params.set('source_campaign', campaignFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('has_email', hasEmailOnly ? 'true' : 'false');
    params.set('limit', '500');

    fetch(`/api/batch-email/opportunities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          setOpportunities([]);
          setLimitCapped(false);
          return;
        }
        setOpportunities(data.opportunities || []);
        setLimitCapped(!!data.limit_capped);
      })
      .catch(err => {
        console.error('[BatchEmailPage] Opps load error:', err);
        setError(err.message || 'Failed to load opportunities');
        setOpportunities([]);
      })
      .finally(() => setLoadingOpps(false));
  }, [token, campaignFilter, debouncedSearch, hasEmailOnly]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTED) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const selectVisible = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const opp of opportunities) {
        if (next.size >= MAX_SELECTED) break;
        if (opp.contact_email) next.add(opp.id);
      }
      return next;
    });
  }, [opportunities]);

  const atCap = selected.size >= MAX_SELECTED;
  const canContinue = selected.size > 0;

  const selectedOpps = useMemo(
    () => opportunities.filter(o => selected.has(o.id)),
    [opportunities, selected]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
            <Mail size={16} />
            <span>Batch Outreach</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Compose batch email</h1>
          <p className="text-sm text-white/50 mt-1">
            Select up to {MAX_SELECTED} recipients. Pick a template. Review, edit,
            and send personalized emails.
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {step === 'select' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 mt-6">
            {/* Main list panel */}
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl overflow-hidden">
              {/* Filter bar */}
              <div className="p-4 border-b border-gray-700/40 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="text"
                      placeholder="Search name, company, or email..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg">
                    <Filter size={14} className="text-white/40" />
                    <select
                      value={campaignFilter}
                      onChange={e => setCampaignFilter(e.target.value)}
                      disabled={loadingCampaigns}
                      className="bg-transparent text-sm text-white focus:outline-none min-w-[200px] max-w-[280px]"
                    >
                      <option value="" className="bg-gray-900">
                        {loadingCampaigns ? 'Loading campaigns...' : 'All campaigns'}
                      </option>
                      {campaigns.map(c => (
                        <option key={c.name} value={c.name} className="bg-gray-900">
                          {c.name} ({c.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg cursor-pointer text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={hasEmailOnly}
                      onChange={e => setHasEmailOnly(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500"
                    />
                    Has email
                  </label>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="text-white/50">
                    {loadingOpps
                      ? 'Loading recipients...'
                      : `${opportunities.length} ${opportunities.length === 1 ? 'recipient' : 'recipients'}${limitCapped ? ' (showing first 500)' : ''}`}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectVisible}
                      disabled={loadingOpps || opportunities.length === 0 || atCap}
                      className="text-blue-400 hover:text-blue-300 disabled:text-white/20 disabled:cursor-not-allowed"
                    >
                      Select visible
                    </button>
                    {selected.size > 0 && (
                      <button
                        onClick={clearSelection}
                        className="text-white/50 hover:text-white/80"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[60vh] overflow-y-auto">
                {error && (
                  <div className="p-4 m-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                {!error && loadingOpps && opportunities.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-white/40">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Loading...
                  </div>
                ) : !error && opportunities.length === 0 ? (
                  <div className="text-center py-16 text-white/40 text-sm">
                    No recipients match your filters.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-800">
                    {opportunities.map(opp => {
                      const isSelected = selected.has(opp.id);
                      const disabled = !isSelected && atCap;
                      return (
                        <li key={opp.id}>
                          <RecipientRow
                            opp={opp}
                            selected={isSelected}
                            disabled={disabled}
                            onToggle={() => toggleSelect(opp.id)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Selection sidebar */}
            <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
              <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5">
                <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Selected</div>
                <div className="text-3xl font-semibold text-white">
                  {selected.size}
                  <span className="text-base text-white/40 font-normal"> / {MAX_SELECTED}</span>
                </div>
                {atCap && (
                  <div className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {MAX_SELECTED} recipient maximum reached
                  </div>
                )}

                {selectedOpps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700/40 max-h-[240px] overflow-y-auto">
                    <ul className="space-y-1.5">
                      {selectedOpps.map(opp => (
                        <li key={opp.id} className="text-xs text-white/70 truncate">
                          {opp.contact_name || opp.account_name}
                          <span className="text-white/30"> · {opp.account_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  disabled={!canContinue}
                  onClick={() => setStep('compose')}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="text-xs text-white/40 leading-relaxed px-1">
                Step 2 picks a template and previews each personalized email before
                sending. Step 3 sends them through your connected email account.
              </div>
            </div>
          </div>
        )}

        {step === 'compose' && (
          <ComposeStepPlaceholder
            selectedCount={selected.size}
            onBack={() => setStep('select')}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const StepIndicator: React.FC<{ step: Step }> = ({ step }) => {
  const steps: { id: Step; label: string }[] = [
    { id: 'select', label: '1. Select recipients' },
    { id: 'compose', label: '2. Pick template + preview' },
    { id: 'review', label: '3. Review and send' },
  ];
  const activeIdx = steps.findIndex(s => s.id === step);
  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <React.Fragment key={s.id}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                active
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                  : done
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-gray-800/40 border border-gray-700/40 text-white/40'
              }`}
            >
              {done && <Check size={12} />}
              <span className="text-xs">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="w-4 h-px bg-gray-700" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const RecipientRow: React.FC<{
  opp: Opportunity;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}> = ({ opp, selected, disabled, onToggle }) => {
  const warmth = opp.warmth_score ?? 0;
  const warmthClass =
    warmth >= 75
      ? 'bg-emerald-500/20 text-emerald-300'
      : warmth >= 40
      ? 'bg-amber-500/20 text-amber-300'
      : 'bg-gray-700/40 text-gray-400';

  return (
    <label
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : selected
          ? 'bg-blue-500/10 cursor-pointer'
          : 'hover:bg-gray-900/40 cursor-pointer'
      }`}
      title={disabled ? '50 recipient maximum' : ''}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">
            {opp.contact_name || opp.account_name || '(unnamed)'}
          </span>
          {warmth > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${warmthClass}`}>
              {warmth}
            </span>
          )}
        </div>
        <div className="text-xs text-white/40 truncate">
          {opp.account_name}
          {opp.contact_email ? (
            <span className="text-emerald-400/70"> · {opp.contact_email}</span>
          ) : (
            <span className="text-amber-400/60"> · no email</span>
          )}
          {opp.source_campaign && (
            <span className="text-white/30"> · {opp.source_campaign}</span>
          )}
        </div>
      </div>
    </label>
  );
};

const ComposeStepPlaceholder: React.FC<{
  selectedCount: number;
  onBack: () => void;
}> = ({ selectedCount, onBack }) => (
  <div className="mt-6 bg-gray-800/40 border border-gray-700/40 rounded-2xl p-8 text-center">
    <div className="text-amber-300 text-sm mb-2">
      {selectedCount} recipient{selectedCount === 1 ? '' : 's'} selected
    </div>
    <h2 className="text-lg font-semibold text-white mb-2">
      Template picker + preview ships next
    </h2>
    <p className="text-sm text-white/50 mb-6">
      Tasks 2 and 3 of Sprint BATCH-50 wire up template selection, per-recipient
      LLM-generated openers, and the TipTap editor.
    </p>
    <button
      onClick={onBack}
      className="px-4 py-2 rounded-lg bg-gray-700/50 text-white/70 hover:text-white text-sm"
    >
      Back to selection
    </button>
  </div>
);

export default BatchEmailPage;
