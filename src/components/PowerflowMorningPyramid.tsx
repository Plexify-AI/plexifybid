/**
 * PowerflowMorningPyramid — Interactive LEFT inverted pyramid
 *
 * The daily "morning coffee" sales catalyst. Inverted shape:
 * widest capsule at top (Level 6), narrowest at bottom (Level 1).
 *
 * All 6 capsules are clickable:
 *   - Level 1: Fetches pipeline data, interpolates template, navigates to Ask Plexi
 *   - Levels 2-5: Navigate directly to Ask Plexi with prefill prompt
 *   - Level 6: Navigate with closing strategy prompt
 *
 * Timezone-aware — resets at the tenant's local midnight.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSandbox } from '../contexts/SandboxContext';
import { POWERFLOW_LEFT_PROMPTS } from '../constants/powerflowLeftPyramidPrompts';
import { getPipelineSummary, interpolatePrompt } from '../services/pipelineDataSource';

interface PowerflowState {
  stage_1_completed: boolean;
  stage_2_completed: boolean;
  stage_3_completed: boolean;
  stage_4_completed: boolean;
  stage_5_completed: boolean;
  stage_6_completed: boolean;
  stage_1_completed_at: string | null;
  stage_2_completed_at: string | null;
  stage_3_completed_at: string | null;
  stage_4_completed_at: string | null;
  stage_5_completed_at: string | null;
  stage_6_completed_at: string | null;
}

// Ordered top-to-bottom: Level 6 (widest) → Level 1 (narrowest)
const LEVELS = [6, 5, 4, 3, 2, 1];

// Width percentages — inverted pyramid tapers down
const WIDTHS: Record<number, string> = {
  6: '100%',
  5: '90%',
  4: '80%',
  3: '70%',
  2: '60%',
  1: '50%',
};

export default function PowerflowMorningPyramid() {
  const { token } = useSandbox();
  const navigate = useNavigate();
  const [state, setState] = useState<PowerflowState | null>(null);
  const [localDate, setLocalDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);

  const fetchState = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/powerflow/today', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.powerflow);
        setLocalDate(data.local_date);
      }
    } catch (err) {
      console.error('[MorningPyramid] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  /**
   * Handle capsule click.
   * - Level 1: fetch pipeline data → interpolate → navigate
   * - Levels 2-6: navigate directly with prompt text
   */
  const handleCapsuleClick = async (level: number) => {
    if (!token) return;

    const promptEntry = POWERFLOW_LEFT_PROMPTS.find((p) => p.level === level);
    if (!promptEntry) return;

    // Level 1 needs pipeline data for template interpolation
    if (level === 1) {
      setLoadingLevel(1);
      try {
        const summary = await getPipelineSummary(token);
        const promptText =
          summary.activeOpportunityCount === 0 && promptEntry.emptyPipelineFallback
            ? promptEntry.emptyPipelineFallback
            : interpolatePrompt(promptEntry.userPrompt, summary);
        navigate(`/ask-plexi?prefill=${encodeURIComponent(promptText)}&level=${level}`);
      } catch (err) {
        console.error('[MorningPyramid] pipeline summary error:', err);
        const fallback = promptEntry.emptyPipelineFallback || promptEntry.userPrompt;
        navigate(`/ask-plexi?prefill=${encodeURIComponent(fallback)}&level=${level}`);
      } finally {
        setLoadingLevel(null);
      }
      return;
    }

    // Levels 2-6: navigate directly
    navigate(`/ask-plexi?prefill=${encodeURIComponent(promptEntry.userPrompt)}&level=${level}`);
  };

  const completedCount = state
    ? [1, 2, 3, 4, 5, 6].filter((n) => state[`stage_${n}_completed` as keyof PowerflowState]).length
    : 0;

  if (loading) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-green-800/40 to-slate-800/60 border border-white/10 p-6">
        <div className="animate-pulse space-y-3">
          {LEVELS.map((level) => (
            <div
              key={level}
              className="h-10 bg-white/5 rounded-lg mx-auto"
              style={{ width: WIDTHS[level] }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-green-800/40 to-slate-800/60 border border-white/10 p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Powerflow</h3>
          <p className="text-xs text-white/40">{localDate} &middot; {completedCount}/6 stages</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`w-2 h-2 rounded-full ${
                state?.[`stage_${n}_completed` as keyof PowerflowState]
                  ? 'bg-blue-400'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Inverted pyramid — Level 6 at top (widest), Level 1 at bottom (narrowest) */}
      <div className="space-y-2 flex-1">
        {LEVELS.map((level) => {
          const promptEntry = POWERFLOW_LEFT_PROMPTS.find((p) => p.level === level);
          if (!promptEntry) return null;

          const completed = state?.[`stage_${level}_completed` as keyof PowerflowState];
          const isLoading = loadingLevel === level;

          return (
            <div key={level} className="flex justify-center">
              <button
                onClick={() => handleCapsuleClick(level)}
                disabled={isLoading}
                className={`rounded-lg px-4 py-2.5 transition-all duration-200 text-left ${
                  completed
                    ? 'bg-gradient-to-r from-blue-600/60 to-indigo-600/60 border border-blue-400/30'
                    : 'bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20'
                } cursor-pointer`}
                style={{ width: WIDTHS[level] }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {completed && (
                      <svg className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className={`text-sm font-medium ${completed ? 'text-white' : 'text-white/80'} ${isLoading ? 'animate-pulse' : ''}`}>
                      {isLoading ? 'Loading pipeline...' : promptEntry.label}
                    </span>
                  </div>
                  <span className={`text-xs whitespace-nowrap ${completed ? 'text-blue-300/70' : 'text-white/30'}`}>
                    {promptEntry.maslow}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-5 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/30">Morning Bloom-Maslow Sales Start</p>
          <span className="text-white/30 text-sm">&#10022;</span>
        </div>
      </div>
    </div>
  );
}
