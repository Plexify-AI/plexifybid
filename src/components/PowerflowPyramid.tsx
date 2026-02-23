/**
 * PowerflowPyramid — Display-only RIGHT pyramid (success logger shell)
 *
 * Shows daily BD progress. Inverted: Close It at top (widest),
 * Find It at bottom (narrowest). Completed stages use accent gradient.
 * Timezone-aware — resets at the tenant's local midnight.
 *
 * Only Stage 6 is interactive (manual win logging).
 * All other stages are display-only — a future task will add
 * encouragement quotes. For now it shows which stages are completed.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSandbox } from '../contexts/SandboxContext';

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
  const [state, setState] = useState<PowerflowState | null>(null);
  const [localDate, setLocalDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

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

  // Stage 6 manual win logging — the only interactive button
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
    <div className="bg-gray-800/40 rounded-xl border border-gray-700/40 p-6 flex flex-col">
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
      <div className="space-y-1.5 flex-1">
        {STAGES.map((stage, idx) => {
          const completed = state?.[`stage_${stage.num}_completed` as keyof PowerflowState];
          const width = WIDTHS[idx];
          const isStage6 = stage.num === 6;

          return (
            <div key={stage.num} className="flex flex-col items-center">
              <button
                onClick={() => isStage6 && !completed && handleManualComplete(6)}
                disabled={!isStage6 || !!completed}
                className={`relative rounded-lg px-3 py-2 transition-all text-left ${
                  completed
                    ? 'bg-gradient-to-r from-blue-600/80 to-indigo-600/80 border border-blue-500/30'
                    : isStage6
                    ? 'bg-gray-700/30 border border-gray-600/30 hover:border-amber-500/40 cursor-pointer'
                    : 'bg-gray-700/30 border border-gray-600/30 pointer-events-none'
                }`}
                style={{ width: `${width}%` }}
                title={isStage6 && !completed ? 'Click to log a win' : stage.trigger}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold ${completed ? 'text-blue-200' : 'text-gray-500'}`}>
                      {stage.num}
                    </span>
                    <span className={`text-sm font-medium truncate ${completed ? 'text-white' : 'text-gray-400'}`}>
                      {stage.label}
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
          Bloom-Maslow framework &middot; Resets at midnight local time
        </p>
      </div>
    </div>
  );
}
