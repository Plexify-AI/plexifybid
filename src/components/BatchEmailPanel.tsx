/**
 * BatchEmailPanel — Multi-prospect sequential outreach with per-email approval
 *
 * States: selecting → generating → reviewing → done
 *
 * - Selecting: loads opportunities, checkboxes for multi-select
 * - Generating: calls /api/batch-email/generate, shows progress
 * - Reviewing: carousel through generated emails, approve/skip each
 * - Done: summary of saved drafts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, SkipForward,
  Mail, Loader2, Users, Save, AlertCircle,
} from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

type BatchState = 'selecting' | 'generating' | 'reviewing' | 'done';

interface Opportunity {
  id: string;
  contact_name: string;
  account_name: string;
  contact_email: string | null;
  warmth_score: number;
  stage: string;
  deal_hypothesis: string | null;
}

interface GeneratedEmail {
  opportunity_id: string;
  contact_name: string;
  contact_email: string | null;
  account_name: string;
  subject: string;
  body: string;
  raw_content: string;
  warmth_score: number;
  index: number;
}

type EmailAction = 'pending' | 'saved' | 'skipped';

interface BatchEmailPanelProps {
  onClose: () => void;
}

const BatchEmailPanel: React.FC<BatchEmailPanelProps> = ({ onClose }) => {
  const { token } = useSandbox();
  const [state, setState] = useState<BatchState>('selecting');

  // Selecting state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'warmth_desc' | 'created'>('warmth_desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Generating state
  const [generatingProgress, setGeneratingProgress] = useState(0);

  // Reviewing state
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actions, setActions] = useState<Map<number, EmailAction>>(new Map());
  const [savingDraft, setSavingDraft] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load opportunities when mount or sort changes
  useEffect(() => {
    if (!token) return;
    setLoadingOpps(true);
    fetch(`/api/opportunities?sort=${sortBy}&limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const opps = data.opportunities || [];
        setOpportunities(opps);
      })
      .catch(err => console.error('[BatchEmailPanel] Load error:', err))
      .finally(() => setLoadingOpps(false));
  }, [token, sortBy]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 15) next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = opportunities.filter(opp => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (opp.contact_name || '').toLowerCase().includes(q) ||
        (opp.account_name || '').toLowerCase().includes(q) ||
        (opp.contact_email || '').toLowerCase().includes(q)
      );
    });
    const top = filtered.filter(o => o.contact_email).slice(0, 15);
    setSelected(new Set(top.map(o => o.id)));
  };

  // Generate emails
  const handleGenerate = useCallback(async () => {
    if (selected.size === 0 || !token) return;
    setState('generating');
    setGeneratingProgress(0);

    try {
      // Simulate progress (actual generation is one API call)
      const progressInterval = setInterval(() => {
        setGeneratingProgress(prev => Math.min(prev + 1, selected.size - 1));
      }, 3000);

      const res = await fetch('/api/batch-email/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunity_ids: Array.from(selected),
        }),
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      setEmails(data.emails || []);
      if (data.errors?.length) {
        setErrors(data.errors.map((e: any) => `${e.opportunity_id}: ${e.error}`));
      }

      // Initialize all as pending
      const actionMap = new Map<number, EmailAction>();
      (data.emails || []).forEach((_: any, i: number) => actionMap.set(i, 'pending'));
      setActions(actionMap);
      setCurrentIndex(0);
      setState('reviewing');
    } catch (err: any) {
      console.error('[BatchEmailPanel] Generation error:', err);
      setErrors([err.message]);
      setState('selecting');
    }
  }, [selected, token]);

  // Save current email as draft
  const handleSaveDraft = useCallback(async () => {
    const email = emails[currentIndex];
    if (!email?.contact_email || !token) return;

    setSavingDraft(true);
    try {
      const res = await fetch('/api/email/save-to-gmail-drafts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.contact_email,
          subject: email.subject || '(No subject)',
          body_html: `<div>${email.body.replace(/\n/g, '<br/>')}</div>`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save draft');
      }

      // Mark as saved and advance
      setActions(prev => new Map(prev).set(currentIndex, 'saved'));
      advanceToNext();
    } catch (err: any) {
      console.error('[BatchEmailPanel] Save draft error:', err);
      setErrors(prev => [...prev, `Draft save failed: ${err.message}`]);
    } finally {
      setSavingDraft(false);
    }
  }, [emails, currentIndex, token]);

  // Skip current email
  const handleSkip = useCallback(() => {
    setActions(prev => new Map(prev).set(currentIndex, 'skipped'));
    advanceToNext();
  }, [currentIndex, emails.length]);

  // Advance to next pending email, or go to done
  const advanceToNext = () => {
    setCurrentIndex(prev => {
      // Find next pending
      for (let i = prev + 1; i < emails.length; i++) {
        if (actions.get(i) === 'pending') return i;
      }
      // Wrap around
      for (let i = 0; i < prev; i++) {
        if (actions.get(i) === 'pending') return i;
      }
      // All done
      setState('done');
      return prev;
    });
  };

  // Counts
  const savedCount = Array.from(actions.values()).filter(a => a === 'saved').length;
  const skippedCount = Array.from(actions.values()).filter(a => a === 'skipped').length;
  const pendingCount = emails.length - savedCount - skippedCount;
  const currentEmail = emails[currentIndex];

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">
            {state === 'selecting' && 'Batch Outreach — Select Prospects'}
            {state === 'generating' && 'Generating Emails...'}
            {state === 'reviewing' && `Review Email ${currentIndex + 1} of ${emails.length}`}
            {state === 'done' && 'Batch Complete'}
          </span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/70">
          <X size={16} />
        </button>
      </div>

      {/* Selecting state */}
      {state === 'selecting' && (
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {loadingOpps ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-white/40" />
              <span className="ml-2 text-sm text-white/40">Loading prospects...</span>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              No prospects with email addresses found. Add contacts with emails first.
            </div>
          ) : (
            <>
              {/* Sort toggle + search */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center bg-gray-800/60 rounded-lg p-0.5">
                  <button
                    onClick={() => setSortBy('warmth_desc')}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      sortBy === 'warmth_desc'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Warmth
                  </button>
                  <button
                    onClick={() => setSortBy('created')}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                      sortBy === 'created'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Recent
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search name or company..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs bg-gray-800/40 border border-gray-700/40 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-blue-500/40"
                />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">{selected.size} selected (max 15)</span>
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Select all with email
                </button>
              </div>
              <div className="space-y-1.5">
                {opportunities.filter(opp => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    (opp.contact_name || '').toLowerCase().includes(q) ||
                    (opp.account_name || '').toLowerCase().includes(q) ||
                    (opp.contact_email || '').toLowerCase().includes(q)
                  );
                }).map(opp => (
                  <label
                    key={opp.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selected.has(opp.id)
                        ? 'bg-blue-500/15 border border-blue-500/30'
                        : 'bg-gray-900/30 border border-transparent hover:bg-gray-900/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(opp.id)}
                      onChange={() => toggleSelect(opp.id)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">
                          {opp.contact_name || opp.account_name}
                        </span>
                        {opp.warmth_score > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            opp.warmth_score >= 75 ? 'bg-emerald-500/20 text-emerald-300' :
                            opp.warmth_score >= 40 ? 'bg-amber-500/20 text-amber-300' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {opp.warmth_score}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        {opp.account_name}
                        {opp.contact_email ? (
                          <span className="text-emerald-400/60"> · {opp.contact_email}</span>
                        ) : (
                          <span className="text-amber-400/50"> · no email</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Generate button */}
          {selected.size > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <button
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium"
              >
                <Mail size={14} />
                Draft {selected.size} Email{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Generating state */}
      {state === 'generating' && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70 text-sm mb-1">
            Generating email {Math.min(generatingProgress + 1, selected.size)} of {selected.size}...
          </p>
          <p className="text-white/30 text-xs">This may take 10-30 seconds per email</p>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-gray-700 rounded-full overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${((generatingProgress + 1) / selected.size) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Reviewing state */}
      {state === 'reviewing' && currentEmail && (
        <div className="p-4">
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-4 text-xs">
            <div className="flex items-center gap-1 text-emerald-400">
              <Check size={12} /> {savedCount} saved
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <SkipForward size={12} /> {skippedCount} skipped
            </div>
            <div className="flex items-center gap-1 text-amber-400">
              <Mail size={12} /> {pendingCount} remaining
            </div>
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${((savedCount + skippedCount) / emails.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Email card */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 mb-4">
            {/* Recipient header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700/50">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users size={14} className="text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{currentEmail.contact_name}</div>
                <div className="text-xs text-white/40">
                  {currentEmail.account_name}
                  {currentEmail.contact_email && ` · ${currentEmail.contact_email}`}
                </div>
              </div>
              {currentEmail.warmth_score > 0 && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                  currentEmail.warmth_score >= 75 ? 'bg-emerald-500/20 text-emerald-300' :
                  currentEmail.warmth_score >= 40 ? 'bg-amber-500/20 text-amber-300' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {currentEmail.warmth_score}/100
                </span>
              )}
            </div>

            {/* Subject */}
            {currentEmail.subject && (
              <div className="mb-2">
                <span className="text-xs text-white/40">Subject: </span>
                <span className="text-sm text-white font-medium">{currentEmail.subject}</span>
              </div>
            )}

            {/* Body */}
            <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {currentEmail.body}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Nav arrows */}
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg bg-gray-700/50 text-white/60 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Skip */}
            <button
              onClick={handleSkip}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700/70 transition-colors text-sm"
            >
              <SkipForward size={14} />
              Skip
            </button>

            {/* Save as Draft */}
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || !currentEmail.contact_email}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm font-medium disabled:opacity-40"
            >
              {savingDraft ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {savingDraft ? 'Saving...' : 'Save as Draft'}
            </button>

            {/* Nav arrows */}
            <button
              onClick={() => setCurrentIndex(prev => Math.min(emails.length - 1, prev + 1))}
              disabled={currentIndex === emails.length - 1}
              className="p-2 rounded-lg bg-gray-700/50 text-white/60 hover:text-white disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* No email warning */}
          {!currentEmail.contact_email && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
              <AlertCircle size={12} />
              No email address — skip or copy manually
            </div>
          )}
        </div>
      )}

      {/* Done state */}
      {state === 'done' && (
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-emerald-400" />
          </div>
          <h3 className="text-white font-semibold mb-2">Batch Complete</h3>
          <div className="space-y-1 text-sm">
            <p className="text-emerald-400">{savedCount} email{savedCount !== 1 ? 's' : ''} saved as drafts</p>
            {skippedCount > 0 && (
              <p className="text-gray-400">{skippedCount} skipped</p>
            )}
          </div>
          {savedCount > 0 && (
            <p className="mt-3 text-xs text-white/40">Check your Gmail/Outlook Drafts folder</p>
          )}
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 rounded-lg bg-gray-700/50 text-white/60 hover:text-white text-sm transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="px-4 pb-3">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-400 mt-1">
              <AlertCircle size={10} />
              {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BatchEmailPanel;
