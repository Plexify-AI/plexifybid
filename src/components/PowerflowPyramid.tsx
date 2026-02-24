/**
 * PowerflowPyramid — LEFT pyramid (Close It / Sales Funnel)
 *
 * Shows daily BD progress as a normal sales funnel:
 * Level 1 "Find It" widest at top → Level 6 "Close It" narrowest at bottom.
 *
 * All capsules are clickable:
 *   - Click increments a counter (shown upper-right badge, persisted in localStorage)
 *   - Click marks the stage complete via API (idempotent)
 *   - Click shows the encouragement quote as a 3-second popup overlay
 *
 * Three visual states per capsule:
 *   A: Not yet completed — slightly dimmed, interactive
 *   B: Activated — full opacity, amber ring
 *   C: Most Recent — State B + pulse animation + "Just completed" pill
 *
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

// Render order: Level 1 (widest) at top → Level 6 (narrowest) at bottom — normal sales funnel
const LEVELS_TOP_DOWN = POWERFLOW_RIGHT_QUOTES;

// Width percentages for the funnel (widest at top = Level 1)
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

  // Click counter state — persisted per tenant per date in localStorage
  const [clickCounts, setClickCounts] = useState<Record<number, number>>({});

  // Quote popup state
  const [popupQuote, setPopupQuote] = useState<{
    level: number;
    quote: string;
    attribution: string;
  } | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Load click counts from localStorage when localDate is known
  useEffect(() => {
    if (!localDate || !token) return;
    try {
      const key = `powerflow_clicks_${token}_${localDate}`;
      const stored = localStorage.getItem(key);
      if (stored) setClickCounts(JSON.parse(stored));
    } catch {
      // Ignore parse errors
    }
  }, [localDate, token]);

  // Cleanup popup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  // Mark a stage complete via API (idempotent — second call is a no-op server-side)
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

  // Capsule click handler — increments counter, shows popup, marks stage
  const handleCapsuleClick = async (level: number) => {
    const entry = POWERFLOW_RIGHT_QUOTES.find((e) => e.level === level);

    // Increment local counter + persist to localStorage
    const newCounts = { ...clickCounts, [level]: (clickCounts[level] || 0) + 1 };
    setClickCounts(newCounts);
    if (localDate && token) {
      try {
        localStorage.setItem(
          `powerflow_clicks_${token}_${localDate}`,
          JSON.stringify(newCounts)
        );
      } catch {
        // localStorage full or unavailable — non-critical
      }
    }

    // Show quote popup with 3-second auto-dismiss
    if (entry) {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      setPopupQuote({
        level: entry.level,
        quote: entry.encouragementQuote,
        attribution: entry.quoteAttribution,
      });
      popupTimerRef.current = setTimeout(() => {
        setPopupQuote(null);
        popupTimerRef.current = null;
      }, 3000);
    }

    // Mark stage complete via API (idempotent)
    await handleManualComplete(level);
  };

  const completedCount = state
    ? [1, 2, 3, 4, 5, 6].filter((n) => state[`stage_${n}_completed` as keyof PowerflowState]).length
    : 0;

  const mostRecentStage = state ? getMostRecentStage(state) : null;

  if (loading) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-amber-800/40 to-slate-800/60 border border-white/10 p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 bg-white/10 rounded mx-auto" style={{ width: `${100 - i * 12}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl bg-gradient-to-br from-amber-800/40 to-slate-800/60 border border-white/10 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
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
                  ? 'bg-amber-400'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Sales funnel — Level 1 at top (widest), Level 6 at bottom (narrowest) */}
      <div className="space-y-1.5 flex-1">
        {LEVELS_TOP_DOWN.map((entry, idx) => {
          const level = entry.level;
          const completed = state?.[`stage_${level}_completed` as keyof PowerflowState];
          const completedAt = state?.[`stage_${level}_completed_at` as keyof PowerflowState] as string | null;
          const isMostRecent = mostRecentStage === level && !!completed;
          const justCompleted = isJustCompleted(completedAt);
          const width = WIDTHS[idx];
          const count = clickCounts[level] || 0;

          // Three visual states
          let capsuleClasses: string;
          if (completed && isMostRecent) {
            // STATE C — Most recently activated
            capsuleClasses = 'bg-white/10 border border-white/20 ring-2 ring-amber-400/60 animate-pulse';
          } else if (completed) {
            // STATE B — Activated
            capsuleClasses = 'bg-white/10 border border-white/20 ring-1 ring-amber-400/30';
          } else {
            // STATE A — Not yet completed (interactive — click to log)
            capsuleClasses = 'opacity-60 bg-white/5 border border-white/10 hover:opacity-80 hover:border-amber-500/40 cursor-pointer';
          }

          return (
            <div key={level} className="flex flex-col items-center">
              <button
                onClick={() => handleCapsuleClick(level)}
                disabled={!!completed}
                className={`relative rounded-lg px-3 py-2 transition-all duration-200 text-left ${capsuleClasses}`}
                style={{ width: `${width}%` }}
                title={!completed ? `Click to complete ${entry.capsuleLabel}` : entry.capsuleLabel}
              >
                {/* Click counter badge — upper right */}
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-gray-900 px-1">
                    {count}
                  </span>
                )}

                {/* Capsule header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Star icon for activated stages */}
                    {completed && (
                      <span className="text-amber-400 text-xs flex-shrink-0">&#9733;</span>
                    )}
                    <span className={`text-sm font-medium truncate ${completed ? 'text-white' : 'text-white/50'}`}>
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
                  <span className={`text-[10px] hidden sm:inline ${completed ? 'text-amber-300/70' : 'text-white/30'}`}>
                    {entry.bloom}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Quote popup overlay — centered over pyramid, auto-dismisses in 3 seconds */}
      {popupQuote && (
        <div
          className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-10 bg-gray-900/95 backdrop-blur-sm border border-amber-400/40 rounded-xl p-5 shadow-2xl cursor-pointer"
          onClick={() => {
            setPopupQuote(null);
            if (popupTimerRef.current) {
              clearTimeout(popupTimerRef.current);
              popupTimerRef.current = null;
            }
          }}
        >
          <p className="text-sm italic text-white/90 leading-relaxed">
            &ldquo;{popupQuote.quote}&rdquo;
          </p>
          <p className="text-xs text-amber-300/70 mt-2">
            {popupQuote.attribution}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="text-[10px] text-white/30 text-center">
          Bloom-Maslow framework &middot; Resets at midnight local time
        </p>
      </div>
    </div>
  );
}
