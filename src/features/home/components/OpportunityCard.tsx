import { Flame, ArrowUpRight, Calendar, User } from 'lucide-react';

interface OpportunityCardProps {
  project: string;
  gc: string;
  value: string;
  contact: string;
  warmthScore: number;
  warmthLabel: string;
  nextAction: string;
  daysInPipeline: number;
  source: string;
}

function warmthStyle(score: number) {
  if (score >= 85) return { flame: 'text-red-500', text: 'text-red-600' };
  return { flame: 'text-orange-500', text: 'text-orange-600' };
}

export function OpportunityCard({
  project,
  gc,
  value,
  contact,
  warmthScore,
  warmthLabel,
  nextAction,
  daysInPipeline,
  source,
}: OpportunityCardProps) {
  const warmth = warmthStyle(warmthScore);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
          {project}
        </h3>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
          Opportunity
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Key Details */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <div>
            <span className="text-gray-400">GC</span>
            <p className="font-medium text-gray-900">{gc}</p>
          </div>
          <div>
            <span className="text-gray-400">Value</span>
            <p className="font-semibold text-gray-900">{value}</p>
          </div>
          <div>
            <span className="text-gray-400">Warmth</span>
            <div className="flex items-center gap-1">
              <Flame size={12} className={warmth.flame} />
              <p className={`font-bold ${warmth.text}`}>{warmthScore} — {warmthLabel}</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg text-xs">
          <User size={14} className="text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-gray-900">{contact}</p>
          </div>
        </div>

        {/* Next Action */}
        <div className="flex items-start gap-2 p-2.5 bg-primary-50 border border-primary-100 rounded-lg text-xs">
          <ArrowUpRight size={14} className="text-primary-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-primary-800">Next Action</p>
            <p className="text-primary-700 mt-0.5">{nextAction}</p>
          </div>
        </div>

        {/* Pipeline Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{daysInPipeline} days in pipeline</span>
          </div>
          <span className="text-gray-400">{source}</span>
        </div>
      </div>
    </div>
  );
}
