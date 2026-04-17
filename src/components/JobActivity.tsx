/**
 * JobActivity — PlexiCoS Activity feed (Sprint E / E4)
 *
 * E1 polled /api/jobs every 30s. E4 subscribes to SSE at /api/jobs/events
 * for live updates (token passed in query string; EventSource can't set
 * auth headers). A single REST GET on mount seeds recent history.
 *
 * Status pill colors follow Sprint E brand map.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useSandbox } from '../contexts/SandboxContext';

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface Job {
  id: string;
  kind: string;
  status: JobStatus;
  runtime: 'inline' | 'managed_agent';
  revenue_loop_stage: string | null;
  input: unknown;
  output: unknown;
  cost_cents: number | null;
  error: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<JobStatus, { bg: string; text: string; label: string; pulse: boolean }> = {
  queued:    { bg: '#6B2FD9', text: '#FFFFFF', label: 'Queued',    pulse: false },
  running:   { bg: '#10B981', text: '#FFFFFF', label: 'Running',   pulse: true  },
  succeeded: { bg: '#10B981', text: '#FFFFFF', label: 'Succeeded', pulse: false },
  failed:    { bg: '#F59E0B', text: '#0D1B3E', label: 'Failed',    pulse: false },
  cancelled: { bg: '#6B7280', text: '#FFFFFF', label: 'Cancelled', pulse: false },
};

const STAGE_COLORS: Record<string, string> = {
  identify:    '#6B2FD9',
  enrich:      '#8B5CF6',
  personalize: '#10B981',
  automate:    '#F59E0B',
  close:       '#0D1B3E',
};

function formatAge(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function humanKind(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const JobActivity: React.FC = () => {
  const { token } = useSandbox();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Seed history once
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/jobs?limit=10', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setJobs(Array.isArray(d.jobs) ? d.jobs : []);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err?.message || 'fetch failed'); });
    return () => { cancelled = true; };
  }, [token]);

  // SSE live updates
  useEffect(() => {
    if (!token) return;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource(`/api/jobs/events?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    const handle = (raw: MessageEvent) => {
      try {
        const payload = JSON.parse(raw.data);
        const job: Job | undefined = payload.job;
        if (!job || !job.id) return;
        setJobs((prev) => {
          const arr = prev ? [...prev] : [];
          const idx = arr.findIndex((j) => j.id === job.id);
          if (idx === -1) arr.unshift(job);
          else arr[idx] = { ...arr[idx], ...job };
          return arr.slice(0, 20);
        });
      } catch {}
    };

    for (const t of ['job.queued', 'job.running', 'job.succeeded', 'job.failed']) {
      es.addEventListener(t, handle as EventListener);
    }
    es.onerror = () => {
      // Browser will auto-reconnect. Flag briefly; no user-facing error unless persistent.
    };

    return () => { es.close(); esRef.current = null; };
  }, [token]);

  async function handleRescore() {
    if (!token || rescoring) return;
    setRescoring(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'pipeline_analyst', input: { mode: 'on_demand' } }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error || `Rescore failed (${res.status})`);
    } catch (err: any) {
      setError(err?.message || 'rescore failed');
    } finally {
      setRescoring(false);
    }
  }

  if (!token) return null;

  return (
    <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 17 4 4 4-4" />
          </svg>
          <h3 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">PlexiCoS Activity</h3>
          <span className="text-[10px] text-gray-600">live</span>
        </div>
        <button
          onClick={handleRescore}
          disabled={rescoring}
          className="text-[11px] font-medium px-2.5 py-1 rounded bg-purple-700/40 hover:bg-purple-700/60 text-purple-100 border border-purple-500/40 disabled:opacity-50"
          title="Rescore pipeline now"
        >
          {rescoring ? 'Queueing…' : 'Rescore pipeline'}
        </button>
      </div>

      <div>
        {error && (
          <div className="p-3 text-sm text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded">
            {error}
          </div>
        )}

        {jobs === null && !error && (
          <div className="py-3 text-sm text-gray-500">Loading activity…</div>
        )}

        {jobs && jobs.length === 0 && (
          <div className="py-4 text-sm text-gray-500">
            No autonomous work yet. Jobs kicked off by PlexiCoS will appear here.
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <ul className="divide-y divide-gray-700/40">
            {jobs.map((job) => {
              const s = STATUS_STYLES[job.status] || STATUS_STYLES.queued;
              const stageColor = job.revenue_loop_stage ? STAGE_COLORS[job.revenue_loop_stage] : null;
              return (
                <li key={job.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-100 truncate">{humanKind(job.kind)}</span>
                      {job.revenue_loop_stage && stageColor && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: stageColor }}
                          title={`Revenue loop stage: ${job.revenue_loop_stage}`}
                        >
                          {job.revenue_loop_stage}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">{job.runtime}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatAge(job.created_at)}
                      {job.error ? <span className="ml-2 text-amber-400">{job.error}</span> : null}
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{
                      backgroundColor: s.bg,
                      color: s.text,
                      animation: s.pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
                    }}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default JobActivity;
