/**
 * PowerflowPyramid — RIGHT pyramid (Success Logger)
 *
 * Shows daily BD progress with encouragement quotes that expand
 * when stages are completed. Inverted shape: Close It at top
 * (widest), Find It at bottom (narrowest).
 *
 * Three visual states per capsule:
 *   A: Locked  — dimmed, no quote, non-interactive
 *   B: Activated — full opacity, quote expanded, amber ring
 *   C: Most Recent — State B + pulse animation + "Just completed" pill
 *
 * Stage 6 is the only interactive button (manual win logging).
 * Polls /api/powerflow/today every 15 seconds for live updates.
 * Timezone-aware — resets at the tenant's local midnight.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSandbox } from '../contexts/SandboxContext';
import { POWERFLOW_RIGHT_QUOTES } from '../constants/powerflowRightPyramidQuotes';

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

// Render order: Level 6 (widest) at top → Level 1 (narrowest) at bottom
const LEVELS_TOP_DOWN = [...POWERFLOW_RIGHT_QUOTES].reverse();

// Width percentages for the inverted pyramid (widest at top = Stage 6)
const WIDTHS = [100, 88, 76, 64, 52, 40];

/** Find the most recently completed stage by comparing timestamps. */
function getMostRecentStage(state: PowerflowState): number | null {
  let mostRecent: number | null = null;
  let mostRecentTime = 0;

  for (let n = 1; n <= 6; n++) {
    const completedAt = state[`stage_${n}_completed_at` as keyof PowerflowState] as string | null;
    if (completedAt) {
      const ts = new Date(completedAt).getTime();
      if (ts > mostRecentTime) {
        mostRecentTime = ts;
        mostRecent = n;
      }
    }
  }

  return mostRecent;
}

/** Check if a stage was completed within the last 60 minutes. */
function isJustCompleted(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const diff = Date.now() - new Date(completedAt).getTime();
  return diff < 60 * 60 * 1000;
}

export default function PowerflowPyramid() {
  const { token } = useSandbox();
  const [state, setState] = useState<PowerflowState | null>(null);
  const [localDate, setLocalDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // 15-second polling for live updates
  useEffect(() => {
    if (!token) return;
    intervalRef.current = setInterval(fetchState, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, fetchState]);

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

  const mostRecentStage = state ? getMostRecentStage(state) : null;

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
                  ? 'bg-amber-400'
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Inverted pyramid — Stage 6 at top (widest), Stage 1 at bottom (narrowest) */}
      <div className="space-y-1.5 flex-1">
        {LEVELS_TOP_DOWN.map((entry, idx) => {
          const level = entry.level;
          const completed = state?.[`stage_${level}_completed` as keyof PowerflowState];
          const completedAt = state?.[`stage_${level}_completed_at` as keyof PowerflowState] as string | null;
          const isMostRecent = mostRecentStage === level && !!completed;
          const justCompleted = isJustCompleted(completedAt);
          const isStage6 = level === 6;
          const width = WIDTHS[idx];

          // Three visual states
          let capsuleClasses: string;
          if (completed && isMostRecent) {
            // STATE C — Most recently activated
            capsuleClasses = 'bg-white/10 border border-white/20 ring-2 ring-amber-400/60 animate-pulse';
          } else if (completed) {
            // STATE B — Activated
            capsuleClasses = 'bg-white/10 border border-white/20 ring-1 ring-amber-400/30';
          } else if (isStage6) {
            // STATE A — Locked (Stage 6 exception: interactive)
            capsuleClasses = 'opacity-40 bg-white/5 border border-white/10 hover:opacity-70 hover:border-amber-500/40 cursor-pointer';
          } else {
            // STATE A — Locked (non-interactive)
            capsuleClasses = 'opacity-40 bg-white/5 border border-white/10 pointer-events-none';
          }

          return (
            <div key={level} className="flex flex-col items-center">
              <button
                onClick={() => isStage6 && !completed && handleManualComplete(6)}
                disabled={!isStage6 || !!completed}
                className={`relative rounded-lg px-3 py-2 transition-all duration-200 text-left ${capsuleClasses}`}
                style={{ width: `${width}%` }}
                title={isStage6 && !completed ? 'Click to log a win' : entry.capsuleLabel}
              >
                {/* Capsule header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Star icon for activated stages */}
                    {completed && (
                      <span className="text-amber-400 text-xs flex-shrink-0">&#9733;</span>
                    )}
                    <span className={`text-sm font-medium truncate ${completed ? 'text-white' : 'text-gray-400'}`}>
                      {entry.capsuleLabel}
                    </span>
                    {/* Activated label badge */}
                    {completed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 whitespace-nowrap">
                        {entry.activatedLabel}
                      </span>
                    )}
                    {/* "Just completed" micro-badge for most recent */}
                    {isMostRecent && justCompleted && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 whitespace-nowrap">
                        Just completed
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] hidden sm:inline ${completed ? 'text-amber-300/70' : 'text-gray-600'}`}>
                    {entry.bloom}
                  </span>
                </div>

                {/* Encouragement quote — expands on activation */}
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: completed ? '100px' : '0px' }}
                >
                  <p className="text-xs italic text-white/80 mt-1.5 leading-relaxed">
                    {entry.encouragementQuote}
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    {entry.quoteAttribution}
                  </p>
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
