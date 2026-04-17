/**
 * JobActivity — PlexiCoS Activity feed (Sprint E / E1)
 *
 * Polls /api/jobs?limit=10 every 30 seconds and renders the last 10 jobs
 * with status pills. SSE replaces polling in Task E4.
 *
 * Status pill colors follow Sprint E brand map:
 *   queued     -> Royal Purple   #6B2FD9
 *   running    -> Signal Teal    #10B981 (pulsing)
 *   succeeded  -> Signal Teal    #10B981 (solid)
 *   failed     -> Warm Amber     #F59E0B
 *   cancelled  -> gray
 */

import React, { useEffect, useState } from 'react';
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

const POLL_MS = 30_000;

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

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/jobs?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || `HTTP ${res.status}`);
          return;
        }
        setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        setError(null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'fetch failed');
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  if (!token) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B2FD9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 17 4 4 4-4" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
          <span className="text-xs text-gray-500">Autonomous work by PlexiCoS</span>
        </div>
        <span className="text-xs text-gray-400">Refreshes every 30s</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-amber-700 bg-amber-50 border-b border-amber-200">
            Activity feed unavailable: {error}
          </div>
        )}

        {jobs === null && !error && (
          <div className="p-4 text-sm text-gray-500">Loading activity…</div>
        )}

        {jobs && jobs.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">
            No autonomous work yet. Jobs kicked off by PlexiCoS will appear here.
          </div>
        )}

        {jobs && jobs.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {jobs.map((job) => {
              const s = STATUS_STYLES[job.status] || STATUS_STYLES.queued;
              const stageColor = job.revenue_loop_stage ? STAGE_COLORS[job.revenue_loop_stage] : null;
              return (
                <li key={job.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {humanKind(job.kind)}
                      </span>
                      {job.revenue_loop_stage && stageColor && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: stageColor }}
                          title={`Revenue loop stage: ${job.revenue_loop_stage}`}
                        >
                          {job.revenue_loop_stage}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{job.runtime}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatAge(job.created_at)}
                      {job.error ? <span className="ml-2 text-amber-700">{job.error}</span> : null}
                    </div>
                  </div>

                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
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
