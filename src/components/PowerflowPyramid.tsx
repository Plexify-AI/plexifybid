/**
 * PowerflowPyramid — Inverted pyramid showing daily BD progress
 *
 * Fills from Stage 1 (bottom, narrowest) to Stage 6 (top, widest).
 * Completed stages use accent gradient; incomplete stages are muted.
 * Timezone-aware — resets at the tenant's local midnight.
 *
 * All 6 capsule buttons are clickable:
 *   - Level 1: Fetches pipeline data, interpolates template, navigates to Ask Plexi
 *   - Levels 2-5: Navigate directly to Ask Plexi with prefill prompt
 *   - Level 6: Manual win logging (existing behavior)
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

const STAGES = [
  { num: 6, maslow: 'Transcendence', bloom: 'Create', label: 'Close It', trigger: 'Win manually logged' },
  { num: 5, maslow: 'Self-Actualization', bloom: 'Evaluate', label: 'Decide It', trigger: 'Artifact generated' },
  { num: 4, maslow: 'Esteem', bloom: 'Analyze', label: 'See It', trigger: 'Pipeline analysis run' },
  { num: 3, maslow: 'Belonging', bloom: 'Apply', label: 'Reach It', trigger: 'Outreach draft generated' },
  { num: 2, maslow: 'Safety', bloom: 'Understand', label: 'Know It', trigger: 'Deal Room RAG chat' },
  { num: 1, maslow: 'Physiological', bloom: 'Remember', label: 'Find It', trigger: 'Ask Plexi query' },
];

// Width percentages for the inverted pyramid (widest at top = Stage 6)
const WIDTHS = [100, 88, 76, 64, 52, 40];

export default function PowerflowPyramid() {
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
      console.error('[PowerflowPyramid] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleManualComplete = async (stage: number) => {
    if (!token) return;
    try {
      const res = await fetch('/api/powerflow/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage }),
      });
      if (res.ok) {
        const data = await res.json();
        setState(data.powerflow);
      }
    } catch (err) {
      console.error('[PowerflowPyramid] complete error:', err);
    }
  };

  /**
   * Handle capsule button click.
   * - Level 6: manual win logging (existing behavior)
   * - Level 1: fetch pipeline data, interpolate template, navigate to Ask Plexi
   * - Levels 2-5: navigate directly to Ask Plexi with prefill prompt
   */
  const handleCapsuleClick = async (level: number) => {
    if (!token) return;

    // Level 6 is manual complete only
    if (level === 6) {
      handleManualComplete(6);
      return;
    }

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
        console.error('[PowerflowPyramid] pipeline summary error:', err);
        // Fallback to empty pipeline prompt on error
        const fallback = promptEntry.emptyPipelineFallback || promptEntry.userPrompt;
        navigate(`/ask-plexi?prefill=${encodeURIComponent(fallback)}&level=${level}`);
      } finally {
        setLoadingLevel(null);
      }
      return;
    }

    // Levels 2-5: navigate directly with prompt text
    navigate(`/ask-plexi?prefill=${encodeURIComponent(promptEntry.userPrompt)}&level=${level}`);
  };

  const completedCount = state
    ? [1, 2, 3, 4, 5, 6].filter((n) => state[`stage_${n}_completed` as keyof PowerflowState]).length
    : 0;

  if (loading) {
    return (
      <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-700/30 rounded mx-auto" style={{ width: `${100 - i * 12}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Powerflow</h3>
          <p className="text-xs text-gray-400">{localDate} &middot; {completedCount}/6 stages</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`w-2 h-2 rounded-full ${
                state?.[`stage_${n}_completed` as keyof PowerflowState]
                  ? 'bg-blue-400'
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Inverted pyramid — Stage 6 at top (widest), Stage 1 at bottom (narrowest) */}
      <div className="space-y-1.5">
        {STAGES.map((stage, idx) => {
          const completed = state?.[`stage_${stage.num}_completed` as keyof PowerflowState];
          const width = WIDTHS[idx];
          const isLoading = loadingLevel === stage.num;

          return (
            <div key={stage.num} className="flex flex-col items-center">
              <button
                onClick={() => handleCapsuleClick(stage.num)}
                disabled={isLoading}
                className={`relative rounded-lg px-3 py-2 transition-all text-left ${
                  completed
                    ? 'bg-gradient-to-r from-blue-600/80 to-indigo-600/80 border border-blue-500/30 hover:from-blue-600 hover:to-indigo-600 cursor-pointer'
                    : stage.num === 6
                    ? 'bg-gray-700/30 border border-gray-600/30 hover:border-amber-500/40 cursor-pointer'
                    : 'bg-gray-700/30 border border-gray-600/30 hover:border-blue-500/40 hover:bg-gray-700/50 cursor-pointer'
                }`}
                style={{ width: `${width}%` }}
                title={
                  stage.num === 6 && !completed
                    ? 'Click to log a win'
                    : `Click to open Level ${stage.num} prompt`
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold ${completed ? 'text-blue-200' : 'text-gray-500'}`}>
                      {stage.num}
                    </span>
                    <span className={`text-sm font-medium truncate ${completed ? 'text-white' : 'text-gray-400'}`}>
                      {isLoading ? 'Loading pipeline...' : stage.label}
                    </span>
                  </div>
                  <span className={`text-[10px] hidden sm:inline ${completed ? 'text-blue-300/70' : 'text-gray-600'}`}>
                    {stage.bloom}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-700/40">
        <p className="text-[10px] text-gray-500 text-center">
          Bloom-Maslow framework &middot; Click any level to start &middot; Resets at midnight
        </p>
      </div>
    </div>
  );
}
