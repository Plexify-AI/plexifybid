/**
 * BatchEmailPage — /batch-email
 *
 * Sprint BATCH-50 rebuild. Three-step flow:
 *   1. Select recipients (filter + checkbox)
 *   2. Pick template + per-recipient preview with TipTap edit
 *   3. Review and send (Task 4 — placeholder; ships next commit)
 *
 * Hard cap 50 selected. Openers generated in parallel batches of 5 via
 * /api/batch-email/openers; each opener has a banned-word check + one
 * regen retry + generic fallback.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
  Mail, Loader2, Search, Filter, Check, ChevronRight, ChevronLeft,
  AlertCircle, FileText, Edit3, Sparkles, Wand2, Send, X, RefreshCw, MailX,
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

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_markdown: string;
  merge_fields: string[];
  generated_fields: string[];
}

interface Opener {
  opportunity_id: string;
  opener_text: string;
  regenerated: boolean;
  fallback: boolean;
  error?: string;
}

interface Draft {
  subject: string;
  body_html: string;
  edited: boolean;
}

type SendStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped_duplicate';

interface SendResult {
  status: SendStatus;
  error_message?: string | null;
}

type Step = 'select' | 'compose' | 'review';

// crypto.randomUUID is available in modern browsers; fall back to a v4 stub.
function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Merge field substitution
// ---------------------------------------------------------------------------

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function applyMergeFields(template: string, opp: Opportunity, opener: string, campaignName: string): string {
  return template
    .replace(/\{\{first_name\}\}/g, firstName(opp.contact_name))
    .replace(/\{\{company\}\}/g, opp.account_name || '')
    .replace(/\{\{campaign_name\}\}/g, campaignName || opp.source_campaign || '')
    .replace(/\{\{personalized_opener\}\}/g, opener || 'Hope this finds you well.');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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

  // Compose-step state — lifted here so step navigation preserves edits
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [openers, setOpeners] = useState<Map<string, Opener>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const [composeError, setComposeError] = useState<string | null>(null);

  // Review/send state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sendStatuses, setSendStatuses] = useState<Map<string, SendResult>>(new Map());
  const [sending, setSending] = useState(false);
  const [sendComplete, setSendComplete] = useState(false);

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

  // Load templates once
  useEffect(() => {
    if (!token) return;
    fetch('/api/batch-email/templates', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const list: Template[] = data.templates || [];
        setTemplates(list);
        // Default: Animation Y'all post-show if present, else first template
        const defaultTpl =
          list.find(t => /Animation Y.?all/i.test(t.name)) || list[0];
        if (defaultTpl) setTemplateId(defaultTpl.id);
      })
      .catch(err => console.error('[BatchEmailPage] Templates load error:', err));
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
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECTED) next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

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

  // -------------------------------------------------------------------------
  // Opener generation
  // -------------------------------------------------------------------------

  const generateOpenersAndDrafts = useCallback(
    async (tpl: Template, opps: Opportunity[]) => {
      setGenerating(true);
      setComposeError(null);
      setGenerationProgress({ done: 0, total: opps.length });

      try {
        const res = await fetch('/api/batch-email/openers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            opportunity_ids: opps.map(o => o.id),
            campaign_name: campaignFilter || null,
            template_id: tpl.id,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: 'Generation failed' }));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const list: Opener[] = data.openers || [];

        // Build map + drafts
        const openerMap = new Map<string, Opener>();
        const draftMap = new Map<string, Draft>();
        for (const op of opps) {
          const found = list.find(o => o.opportunity_id === op.id);
          const opener = found || {
            opportunity_id: op.id,
            opener_text: 'Hope this finds you well.',
            regenerated: false,
            fallback: true,
          };
          openerMap.set(op.id, opener);

          draftMap.set(op.id, {
            subject: applyMergeFields(tpl.subject, op, opener.opener_text, campaignFilter),
            body_html: applyMergeFields(tpl.body_html, op, opener.opener_text, campaignFilter),
            edited: false,
          });
        }

        setOpeners(openerMap);
        setDrafts(draftMap);
        setGenerationProgress({ done: opps.length, total: opps.length });
        if (opps.length > 0) setActiveRecipientId(opps[0].id);
      } catch (err: any) {
        console.error('[BatchEmailPage] Opener generation error:', err);
        setComposeError(err.message || 'Generation failed');
      } finally {
        setGenerating(false);
      }
    },
    [token, campaignFilter]
  );

  // Trigger generation when entering compose step
  useEffect(() => {
    if (step !== 'compose') return;
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl || selectedOpps.length === 0) return;
    if (drafts.size === 0) {
      generateOpenersAndDrafts(tpl, selectedOpps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleTemplateChange = useCallback(
    (newId: string) => {
      if (newId === templateId) return;
      const hadEdits = Array.from(drafts.values()).some(d => d.edited);
      const proceed = hadEdits
        ? window.confirm(
            'Change template? All per-recipient edits will be lost.'
          )
        : true;
      if (!proceed) return;
      setTemplateId(newId);
      const tpl = templates.find(t => t.id === newId);
      if (tpl) {
        setDrafts(new Map());
        setOpeners(new Map());
        generateOpenersAndDrafts(tpl, selectedOpps);
      }
    },
    [templateId, drafts, templates, selectedOpps, generateOpenersAndDrafts]
  );

  const updateActiveDraft = useCallback(
    (patch: Partial<Draft>) => {
      if (!activeRecipientId) return;
      setDrafts(prev => {
        const next = new Map(prev);
        const cur = next.get(activeRecipientId);
        if (!cur) return prev;
        next.set(activeRecipientId, { ...cur, ...patch, edited: true });
        return next;
      });
    },
    [activeRecipientId]
  );

  // -------------------------------------------------------------------------
  // Send loop
  // -------------------------------------------------------------------------

  const sendBatch = useCallback(
    async (idsToSend: string[]) => {
      if (!token || idsToSend.length === 0) return;

      // Generate batch_id once on first send; reuse for retries so the
      // server-side idempotency check matches.
      let currentBatchId = batchId;
      if (!currentBatchId) {
        currentBatchId = newUuid();
        setBatchId(currentBatchId);
      }

      setSending(true);
      setSendComplete(false);

      // Mark targeted rows as sending; preserve any already-sent rows from a
      // previous run (retry-failed-only path).
      setSendStatuses(prev => {
        const next = new Map(prev);
        for (const id of idsToSend) {
          next.set(id, { status: 'sending' });
        }
        return next;
      });

      for (let i = 0; i < idsToSend.length; i++) {
        const oppId = idsToSend[i];
        const opp = selectedOpps.find(o => o.id === oppId);
        const draft = drafts.get(oppId);

        if (!opp || !opp.contact_email || !draft) {
          setSendStatuses(prev => {
            const next = new Map(prev);
            next.set(oppId, { status: 'failed', error_message: 'Missing recipient or draft' });
            return next;
          });
          continue;
        }

        try {
          const res = await fetch('/api/batch-email/send-one', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              batch_id: currentBatchId,
              opportunity_id: oppId,
              to: opp.contact_email,
              subject: draft.subject,
              body_html: draft.body_html,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            setSendStatuses(prev => {
              const next = new Map(prev);
              next.set(oppId, { status: 'failed', error_message: err.error || `HTTP ${res.status}` });
              return next;
            });
          } else {
            const data = await res.json();
            setSendStatuses(prev => {
              const next = new Map(prev);
              next.set(oppId, {
                status: data.status as SendStatus,
                error_message: data.error_message || null,
              });
              return next;
            });
          }
        } catch (err: any) {
          setSendStatuses(prev => {
            const next = new Map(prev);
            next.set(oppId, { status: 'failed', error_message: err.message || 'Network error' });
            return next;
          });
        }

        // Spec: 500ms spacing between sends to stay under provider rate limits.
        if (i < idsToSend.length - 1) {
          await sleep(500);
        }
      }

      setSending(false);
      setSendComplete(true);
    },
    [token, batchId, selectedOpps, drafts]
  );

  const retryFailed = useCallback(() => {
    const failedIds: string[] = [];
    sendStatuses.forEach((result, id) => {
      if (result.status === 'failed') failedIds.push(id);
    });
    if (failedIds.length > 0) sendBatch(failedIds);
  }, [sendStatuses, sendBatch]);

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

        <StepIndicator step={step} />

        {step === 'select' && (
          <SelectStep
            opportunities={opportunities}
            campaigns={campaigns}
            campaignFilter={campaignFilter}
            setCampaignFilter={setCampaignFilter}
            search={search}
            setSearch={setSearch}
            hasEmailOnly={hasEmailOnly}
            setHasEmailOnly={setHasEmailOnly}
            loadingCampaigns={loadingCampaigns}
            loadingOpps={loadingOpps}
            limitCapped={limitCapped}
            error={error}
            selected={selected}
            atCap={atCap}
            selectedOpps={selectedOpps}
            canContinue={canContinue}
            toggleSelect={toggleSelect}
            selectVisible={selectVisible}
            clearSelection={clearSelection}
            onContinue={() => setStep('compose')}
          />
        )}

        {step === 'compose' && (
          <ComposeStep
            templates={templates}
            templateId={templateId}
            onTemplateChange={handleTemplateChange}
            selectedOpps={selectedOpps}
            openers={openers}
            drafts={drafts}
            activeRecipientId={activeRecipientId}
            setActiveRecipientId={setActiveRecipientId}
            updateActiveDraft={updateActiveDraft}
            generating={generating}
            generationProgress={generationProgress}
            composeError={composeError}
            onBack={() => setStep('select')}
            onContinue={() => setStep('review')}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            selectedOpps={selectedOpps}
            drafts={drafts}
            sendStatuses={sendStatuses}
            sending={sending}
            sendComplete={sendComplete}
            onSendAll={() => sendBatch(selectedOpps.map(o => o.id))}
            onRetryFailed={retryFailed}
            onBack={() => setStep('compose')}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 1 — Select
// ---------------------------------------------------------------------------

interface SelectStepProps {
  opportunities: Opportunity[];
  campaigns: Campaign[];
  campaignFilter: string;
  setCampaignFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  hasEmailOnly: boolean;
  setHasEmailOnly: (v: boolean) => void;
  loadingCampaigns: boolean;
  loadingOpps: boolean;
  limitCapped: boolean;
  error: string | null;
  selected: Set<string>;
  atCap: boolean;
  selectedOpps: Opportunity[];
  canContinue: boolean;
  toggleSelect: (id: string) => void;
  selectVisible: () => void;
  clearSelection: () => void;
  onContinue: () => void;
}

const SelectStep: React.FC<SelectStepProps> = (p) => (
  <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 mt-6">
    <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-gray-700/40 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search name, company, or email..."
              value={p.search}
              onChange={e => p.setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg">
            <Filter size={14} className="text-white/40" />
            <select
              value={p.campaignFilter}
              onChange={e => p.setCampaignFilter(e.target.value)}
              disabled={p.loadingCampaigns}
              className="bg-transparent text-sm text-white focus:outline-none min-w-[200px] max-w-[280px]"
            >
              <option value="" className="bg-gray-900">
                {p.loadingCampaigns ? 'Loading campaigns...' : 'All campaigns'}
              </option>
              {p.campaigns.map(c => (
                <option key={c.name} value={c.name} className="bg-gray-900">
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg cursor-pointer text-sm text-white/70">
            <input
              type="checkbox"
              checked={p.hasEmailOnly}
              onChange={e => p.setHasEmailOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500"
            />
            Has email
          </label>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="text-white/50">
            {p.loadingOpps
              ? 'Loading recipients...'
              : `${p.opportunities.length} ${p.opportunities.length === 1 ? 'recipient' : 'recipients'}${p.limitCapped ? ' (showing first 500)' : ''}`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={p.selectVisible}
              disabled={p.loadingOpps || p.opportunities.length === 0 || p.atCap}
              className="text-blue-400 hover:text-blue-300 disabled:text-white/20 disabled:cursor-not-allowed"
            >
              Select visible
            </button>
            {p.selected.size > 0 && (
              <button
                onClick={p.clearSelection}
                className="text-white/50 hover:text-white/80"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {p.error && (
          <div className="p-4 m-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
            <AlertCircle size={14} />
            {p.error}
          </div>
        )}

        {!p.error && p.loadingOpps && p.opportunities.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-white/40">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading...
          </div>
        ) : !p.error && p.opportunities.length === 0 ? (
          <div className="text-center py-16 text-white/40 text-sm">
            No recipients match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {p.opportunities.map(opp => {
              const isSelected = p.selected.has(opp.id);
              const disabled = !isSelected && p.atCap;
              return (
                <li key={opp.id}>
                  <RecipientRow
                    opp={opp}
                    selected={isSelected}
                    disabled={disabled}
                    onToggle={() => p.toggleSelect(opp.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>

    <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
      <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5">
        <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Selected</div>
        <div className="text-3xl font-semibold text-white">
          {p.selected.size}
          <span className="text-base text-white/40 font-normal"> / {MAX_SELECTED}</span>
        </div>
        {p.atCap && (
          <div className="mt-2 text-xs text-amber-400 flex items-center gap-1">
            <AlertCircle size={12} />
            {MAX_SELECTED} recipient maximum reached
          </div>
        )}

        {p.selectedOpps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700/40 max-h-[240px] overflow-y-auto">
            <ul className="space-y-1.5">
              {p.selectedOpps.map(opp => (
                <li key={opp.id} className="text-xs text-white/70 truncate">
                  {opp.contact_name || opp.account_name}
                  <span className="text-white/30"> · {opp.account_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          disabled={!p.canContinue}
          onClick={p.onContinue}
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
);

// ---------------------------------------------------------------------------
// Step 2 — Compose
// ---------------------------------------------------------------------------

interface ComposeStepProps {
  templates: Template[];
  templateId: string;
  onTemplateChange: (id: string) => void;
  selectedOpps: Opportunity[];
  openers: Map<string, Opener>;
  drafts: Map<string, Draft>;
  activeRecipientId: string | null;
  setActiveRecipientId: (id: string | null) => void;
  updateActiveDraft: (patch: Partial<Draft>) => void;
  generating: boolean;
  generationProgress: { done: number; total: number };
  composeError: string | null;
  onBack: () => void;
  onContinue: () => void;
}

const ComposeStep: React.FC<ComposeStepProps> = (p) => {
  const activeDraft = p.activeRecipientId ? p.drafts.get(p.activeRecipientId) : null;
  const activeOpp = p.selectedOpps.find(o => o.id === p.activeRecipientId) || null;
  const activeOpener = p.activeRecipientId ? p.openers.get(p.activeRecipientId) : null;
  const allDraftsReady = p.drafts.size === p.selectedOpps.length && p.selectedOpps.length > 0;

  return (
    <div className="mt-6">
      {/* Top bar — template picker + back */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={p.onBack}
          className="flex items-center gap-1 text-sm text-white/60 hover:text-white"
        >
          <ChevronLeft size={14} />
          Back to selection
        </button>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-white/40" />
          <span className="text-xs text-white/50 uppercase tracking-wide">Template</span>
          <select
            value={p.templateId}
            onChange={e => p.onTemplateChange(e.target.value)}
            disabled={p.generating}
            className="px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 min-w-[280px]"
          >
            {p.templates.map(t => (
              <option key={t.id} value={t.id} className="bg-gray-900">
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {p.composeError && (
        <div className="mb-4 p-3 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          <AlertCircle size={14} className="mt-0.5" />
          <div>
            <div className="font-medium">Opener generation failed</div>
            <div className="text-xs text-red-300/80 mt-1">{p.composeError}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-4">
        {/* Recipient list */}
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700/40 text-xs text-white/50 uppercase tracking-wide">
            Recipients ({p.selectedOpps.length})
          </div>
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-800">
            {p.selectedOpps.map(opp => {
              const draft = p.drafts.get(opp.id);
              const opener = p.openers.get(opp.id);
              const active = p.activeRecipientId === opp.id;
              return (
                <li key={opp.id}>
                  <button
                    onClick={() => p.setActiveRecipientId(opp.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? 'bg-blue-500/15 border-l-2 border-blue-500' : 'hover:bg-gray-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white truncate">
                        {opp.contact_name || opp.account_name}
                      </div>
                      {draft?.edited && (
                        <Edit3 size={11} className="text-amber-400" />
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate">{opp.contact_email}</div>
                    {opener?.fallback && (
                      <div className="text-[10px] text-amber-400/80 mt-0.5">generic opener</div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Editor */}
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl overflow-hidden">
          {p.generating ? (
            <GeneratingOverlay progress={p.generationProgress} />
          ) : !activeDraft || !activeOpp ? (
            <div className="p-12 text-center text-white/40 text-sm">
              Select a recipient on the left to preview their draft.
            </div>
          ) : (
            <DraftEditor
              opportunity={activeOpp}
              opener={activeOpener || null}
              draft={activeDraft}
              onChange={p.updateActiveDraft}
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-white/50">
          {allDraftsReady
            ? `${p.drafts.size} draft${p.drafts.size === 1 ? '' : 's'} ready · ${
                Array.from(p.drafts.values()).filter(d => d.edited).length
              } edited`
            : 'Generating drafts...'}
        </div>
        <button
          onClick={p.onContinue}
          disabled={!allDraftsReady || p.generating}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Review and Send
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const GeneratingOverlay: React.FC<{ progress: { done: number; total: number } }> = ({ progress }) => {
  const total = progress.total || 1;
  const pct = Math.min(100, Math.round((progress.done / total) * 100));
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <div className="flex items-center justify-center gap-2 text-amber-300 text-sm mb-2">
        <Sparkles size={14} />
        Generating personalized openers — {progress.done} of {progress.total}
      </div>
      <div className="text-xs text-white/40 mb-4">
        Parallel batches of 5. ~30 seconds total for 50 recipients.
      </div>
      <div className="max-w-sm mx-auto h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const DraftEditor: React.FC<{
  opportunity: Opportunity;
  opener: Opener | null;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}> = ({ opportunity, opener, draft, onChange }) => {
  // Track which opportunity is loaded so we can swap content cleanly
  const loadedIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your email...' }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
    ],
    content: draft.body_html,
    onUpdate: ({ editor }) => {
      onChange({ body_html: editor.getHTML() });
    },
  });

  // When the active recipient changes, replace editor content
  useEffect(() => {
    if (!editor) return;
    if (loadedIdRef.current !== opportunity.id) {
      editor.commands.setContent(draft.body_html, false);
      loadedIdRef.current = opportunity.id;
    }
  }, [editor, opportunity.id, draft.body_html]);

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* Recipient header */}
      <div className="px-5 py-3 border-b border-gray-700/40 bg-gray-900/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              {opportunity.contact_name}
              <span className="text-white/40"> · {opportunity.account_name}</span>
            </div>
            <div className="text-xs text-white/50">{opportunity.contact_email}</div>
          </div>
          {opener && (
            <div className="text-xs flex items-center gap-1.5">
              {opener.fallback ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle size={11} /> Generic opener (fallback)
                </span>
              ) : opener.regenerated ? (
                <span className="text-blue-400 flex items-center gap-1">
                  <Wand2 size={11} /> Regenerated
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Sparkles size={11} /> Personalized
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="px-5 py-3 border-b border-gray-700/40">
        <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Subject</label>
        <input
          type="text"
          value={draft.subject}
          onChange={e => onChange({ subject: e.target.value })}
          className="w-full bg-transparent text-sm text-white focus:outline-none"
        />
      </div>

      {/* Body editor */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <EditorContent
          editor={editor}
          className="prose prose-invert prose-sm max-w-none focus:outline-none [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:focus:outline-none"
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 3 — Review and Send
// ---------------------------------------------------------------------------

interface ReviewStepProps {
  selectedOpps: Opportunity[];
  drafts: Map<string, Draft>;
  sendStatuses: Map<string, SendResult>;
  sending: boolean;
  sendComplete: boolean;
  onSendAll: () => void;
  onRetryFailed: () => void;
  onBack: () => void;
}

const ReviewStep: React.FC<ReviewStepProps> = (p) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const sentCount = Array.from(p.sendStatuses.values()).filter(s => s.status === 'sent').length;
  const failedCount = Array.from(p.sendStatuses.values()).filter(s => s.status === 'failed').length;
  const skippedCount = Array.from(p.sendStatuses.values()).filter(s => s.status === 'skipped_duplicate').length;
  const inFlightCount = Array.from(p.sendStatuses.values()).filter(s => s.status === 'sending').length;
  const total = p.selectedOpps.length;
  const handled = sentCount + failedCount + skippedCount;
  const pct = total > 0 ? Math.round((handled / total) * 100) : 0;

  const hasStarted = p.sendStatuses.size > 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={p.onBack}
          disabled={p.sending}
          className="flex items-center gap-1 text-sm text-white/60 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          Back to compose
        </button>
      </div>

      {/* Summary card */}
      {!hasStarted && (
        <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-8 text-center mb-6">
          <Send size={32} className="text-amber-400 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-white mb-1">
            Send {total} personalized email{total === 1 ? '' : 's'}
          </h2>
          <p className="text-sm text-white/50 mb-6">
            Through your connected email account. {' '}
            {Array.from(p.drafts.values()).filter(d => d.edited).length} draft
            {Array.from(p.drafts.values()).filter(d => d.edited).length === 1 ? ' has' : 's have'} per-recipient edits.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-6 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-sm font-medium"
          >
            Send All
          </button>
        </div>
      )}

      {/* Progress + status list */}
      {hasStarted && (
        <>
          <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-white">
                {p.sending ? `Sending — ${handled} of ${total}` : `Send complete — ${handled} of ${total}`}
              </div>
              <div className="flex items-center gap-3 text-xs">
                {sentCount > 0 && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> {sentCount} sent
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <X size={12} /> {failedCount} failed
                  </span>
                )}
                {skippedCount > 0 && (
                  <span className="text-blue-400 flex items-center gap-1">
                    <MailX size={12} /> {skippedCount} skipped (duplicate)
                  </span>
                )}
                {inFlightCount > 0 && (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> {inFlightCount} in flight
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl overflow-hidden">
            <ul className="divide-y divide-gray-800 max-h-[55vh] overflow-y-auto">
              {p.selectedOpps.map(opp => {
                const result = p.sendStatuses.get(opp.id);
                return (
                  <li key={opp.id} className="px-4 py-3 flex items-center gap-3">
                    <SendStatusIcon status={result?.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {opp.contact_name || opp.account_name}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        {opp.contact_email}
                      </div>
                      {result?.status === 'failed' && result.error_message && (
                        <div className="text-xs text-red-400 mt-1">{result.error_message}</div>
                      )}
                      {result?.status === 'skipped_duplicate' && (
                        <div className="text-xs text-blue-400 mt-1">
                          Already sent in this batch — skipped
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Done banner + retry */}
          {p.sendComplete && (
            <div className="mt-4 bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-white font-medium">
                  {sentCount} of {total} sent successfully
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {failedCount > 0
                    ? `${failedCount} failed — retry only the failed recipients below.`
                    : 'All emails dispatched. Check your provider Sent folder to confirm.'}
                </div>
              </div>
              {failedCount > 0 && (
                <button
                  onClick={p.onRetryFailed}
                  disabled={p.sending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 text-sm disabled:opacity-30"
                >
                  <RefreshCw size={14} />
                  Retry failed ({failedCount})
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmSendDialog
          recipientCount={total}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            p.onSendAll();
          }}
        />
      )}
    </div>
  );
};

const SendStatusIcon: React.FC<{ status: SendStatus | undefined }> = ({ status }) => {
  if (status === 'sent') {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <Check size={14} className="text-emerald-400" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
        <X size={14} className="text-red-400" />
      </div>
    );
  }
  if (status === 'skipped_duplicate') {
    return (
      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        <MailX size={14} className="text-blue-400" />
      </div>
    );
  }
  if (status === 'sending') {
    return (
      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Loader2 size={14} className="text-amber-400 animate-spin" />
      </div>
    );
  }
  return <div className="w-6 h-6 rounded-full border border-gray-600 flex-shrink-0" />;
};

const ConfirmSendDialog: React.FC<{
  recipientCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ recipientCount, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle size={20} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base mb-1">
            Send {recipientCount} email{recipientCount === 1 ? '' : 's'}?
          </h3>
          <p className="text-sm text-white/60">
            This will dispatch {recipientCount} personalized email
            {recipientCount === 1 ? '' : 's'} immediately through your connected
            account. Sends are not reversible.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-gray-700/50 text-white/70 hover:text-white text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/30 border border-amber-500/50 text-amber-200 hover:bg-amber-500/40 text-sm font-medium"
        >
          <Send size={14} />
          Send {recipientCount}
        </button>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Shared subcomponents
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

export default BatchEmailPage;
