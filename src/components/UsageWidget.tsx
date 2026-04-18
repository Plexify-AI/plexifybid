/**
 * UsageWidget — current-month spend per worker (Sprint E / E4)
 *
 * Polls /api/tenant-usage/summary every 60s. Red band when Research Scanner
 * crosses 80% of its $15 cap.
 */

import React, { useEffect, useState } from 'react';
import { useSandbox } from '../contexts/SandboxContext';

interface WorkerUsage {
  cost_cents: number;
  tokens_in: number;
  tokens_out: number;
  count: number;
}

interface Summary {
  month_start: string;
  total_cost_cents: number;
  by_worker: Record<string, WorkerUsage>;
}

const SCANNER_CAP_CENTS = 1500;
const WARN_PCT = 0.8;

const PRETTY: Record<string, string> = {
  pipeline_analyst: 'Pipeline Analyst',
  research_scanner: 'Research Scanner',
  war_room_prep: 'War Room Prep',
  skill_run: 'Strategy Skills',
};

function cents(n: number): string {
  return `$${(n / 100).toFixed(2)}`;
}

const UsageWidget: React.FC = () => {
  const { token } = useSandbox();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/tenant-usage/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data?.error || `HTTP ${res.status}`);
        else {
          setSummary(data);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'fetch failed');
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [token]);

  if (!token) return null;

  const scanner = summary?.by_worker?.research_scanner;
  const scannerSpend = scanner?.cost_cents || 0;
  const scannerPct = Math.min(1, scannerSpend / SCANNER_CAP_CENTS);
  const nearCap = scannerPct >= WARN_PCT;

  return (
    <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Usage this month</h3>
        {summary && <span className="text-[10px] text-gray-500">total {cents(summary.total_cost_cents)}</span>}
      </div>

      {error && <div className="text-xs text-amber-300">{error}</div>}

      {!summary && !error && <div className="text-sm text-gray-500">Loading…</div>}

      {summary && (
        <div className="space-y-2">
          {Object.entries(summary.by_worker).length === 0 && (
            <div className="text-sm text-gray-500">No worker activity yet this month.</div>
          )}

          {Object.entries(summary.by_worker).map(([key, val]) => {
            const label = PRETTY[key] || key;
            const isScanner = key === 'research_scanner';
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs text-gray-300">
                  <span>{label}</span>
                  <span className="text-gray-400">{val.count} run{val.count === 1 ? '' : 's'} · {cents(val.cost_cents)}</span>
                </div>
                {isScanner && (
                  <div className="w-full h-1.5 rounded overflow-hidden bg-gray-700/60">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.round(scannerPct * 100)}%`,
                        backgroundColor: nearCap ? '#F59E0B' : '#10B981',
                      }}
                    />
                  </div>
                )}
                {isScanner && (
                  <div className="text-[10px] text-gray-500">
                    {cents(scannerSpend)} of {cents(SCANNER_CAP_CENTS)} monthly cap
                    {nearCap ? <span className="ml-1 text-amber-400">· approaching cap</span> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UsageWidget;
