/**
 * LinkedIn Import — Results Section
 *
 * Phase C: Shows import results with summary stats, warmth/priority charts,
 * vertical distribution, top contacts table, and action buttons.
 */

import { Lock, Download, ArrowRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ImportResults, ImportJobStatus } from './LinkedInImport.types';
import { WarmthDistributionChart } from './WarmthDistributionChart';
import { PriorityChart } from './PriorityChart';
import { VerticalDistributionChart } from './VerticalDistributionChart';

interface ResultsSectionProps {
  isComplete: boolean;
  jobStatus: ImportJobStatus | null;
  onReset: () => void;
}

const WARMTH_BADGE_COLORS: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-300 border-red-500/30',
  strong: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  warm: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cold: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  P0: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  P1: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  P2: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  P3: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '--';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function ResultsSection({ isComplete, jobStatus, onReset }: ResultsSectionProps) {
  const navigate = useNavigate();

  if (!isComplete || !jobStatus?.results) {
    return (
      <div className="rounded-xl border border-gray-700/20 bg-gray-800/20 p-6 opacity-50">
        <div className="flex items-center gap-3">
          <Lock className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-500">Results will appear here after processing completes</span>
        </div>
      </div>
    );
  }

  const results: ImportResults = jobStatus.results;
  const duration = formatDuration(jobStatus.started_at, jobStatus.completed_at);

  return (
    <div className="space-y-6">
      {/* Zone 1: Summary Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Contacts Processed"
          value={results.total_processed.toLocaleString()}
          color="text-white"
        />
        <StatCard
          label="Opportunities Created"
          value={results.total_imported.toLocaleString()}
          color="text-emerald-400"
        />
        <StatCard
          label="Warmth Scored"
          value={results.total_processed.toLocaleString()}
          color="text-purple-400"
        />
        <StatCard
          label="Processing Time"
          value={duration}
          color="text-amber-400"
        />
      </div>

      {/* Zone 2: Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-5">
          <WarmthDistributionChart data={results.warmth_distribution} />
        </div>
        <div className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-5">
          <PriorityChart data={results.priority_breakdown} />
        </div>
      </div>

      {/* Vertical Distribution */}
      {results.vertical_distribution && Object.keys(results.vertical_distribution).length > 0 && (
        <div className="rounded-xl border border-gray-700/30 bg-gray-800/30 p-5">
          <VerticalDistributionChart data={results.vertical_distribution} />
        </div>
      )}

      {/* Zone 3: Top Contacts Table */}
      {results.top_contacts && results.top_contacts.length > 0 && (
        <div className="rounded-xl border border-gray-700/30 bg-gray-800/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700/20">
            <h4 className="text-sm font-medium text-gray-300">Top Contacts by Warmth</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Warmth</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/15">
                {results.top_contacts.slice(0, 10).map((contact, idx) => {
                  const warmthKey = (contact.warmth_label || '').toLowerCase();
                  const badgeClass = WARMTH_BADGE_COLORS[warmthKey] || WARMTH_BADGE_COLORS.cold;
                  const priorityClass = PRIORITY_BADGE_COLORS[contact.priority] || PRIORITY_BADGE_COLORS.P3;

                  return (
                    <tr key={idx} className="hover:bg-gray-700/10 transition-colors">
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-gray-200 font-medium">{contact.name}</div>
                        <div className="text-gray-500 text-xs">{contact.company}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${badgeClass}`}>
                          {contact.warmth_composite}
                          <span className="opacity-70">{contact.warmth_label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${priorityClass}`}>
                          {contact.priority}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Zone 4: Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={() => navigate(`/home?source=linkedin-import&jobId=${jobStatus.jobId}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          View Opportunities
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => downloadResultsCsv(results)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-600/40 bg-gray-800/40 hover:bg-gray-700/40 text-gray-300 text-sm transition-colors"
        >
          <Download className="h-4 w-4" />
          Download Summary
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Import Another Network
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-700/30 bg-gray-800/30 backdrop-blur-sm p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Download
// ---------------------------------------------------------------------------

function downloadResultsCsv(results: ImportResults) {
  const rows = [
    ['Rank', 'Name', 'Company', 'Warmth Score', 'Warmth Label', 'Priority'],
    ...results.top_contacts.map((c, i) => [
      String(i + 1),
      c.name,
      c.company,
      String(c.warmth_composite),
      c.warmth_label,
      c.priority,
    ]),
  ];

  const csvContent = rows.map(row =>
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `linkedin-import-results-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
