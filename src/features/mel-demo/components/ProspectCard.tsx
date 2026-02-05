import {
  User,
  Linkedin,
  AlertTriangle,
  Lightbulb,
  Handshake,
  Flame,
  MessageCircle,
} from 'lucide-react';
import type { EnrichedProspect } from '../MelDemo.types';

interface ProspectCardProps {
  prospect: EnrichedProspect;
  rank: number;
}

function warmthColor(score: number) {
  if (score >= 70) return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', bar: 'bg-green-500' };
  if (score >= 50) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', bar: 'bg-yellow-500' };
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', bar: 'bg-red-500' };
}

function linkedInBadge(connected: boolean, degree?: 1 | 2 | 3) {
  if (connected && degree === 1) return { label: '1st degree connection', color: 'text-green-600' };
  if (degree === 2) return { label: '2nd degree', color: 'text-blue-600' };
  return { label: 'Not connected', color: 'text-gray-400' };
}

export function ProspectCard({ prospect, rank }: ProspectCardProps) {
  const { project, contact, connection, caseStudy } = prospect;
  const warmth = warmthColor(project.warmthScore);
  const linkedin = linkedInBadge(contact.linkedInConnected, contact.linkedInDegree);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold">
            {rank}
          </span>
          <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
            {project.name}
          </h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${warmth.bg} ${warmth.text} ${warmth.border} border`}>
          <Flame size={12} />
          Warmth: {project.warmthScore}/100
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Dodge Data Grid */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <div>
            <span className="text-gray-400">Dodge #</span>
            <p className="font-mono text-gray-700">{project.dodgeNumber}</p>
          </div>
          <div>
            <span className="text-gray-400">Type</span>
            <p className="text-gray-700">{project.type}</p>
          </div>
          <div>
            <span className="text-gray-400">SF</span>
            <p className="text-gray-700">{project.squareFeetDisplay}</p>
          </div>
          <div>
            <span className="text-gray-400">Floors</span>
            <p className="text-gray-700">{project.floors}</p>
          </div>
          <div>
            <span className="text-gray-400">Value</span>
            <p className="font-semibold text-gray-900">{project.valueDisplay}</p>
          </div>
          <div>
            <span className="text-gray-400">Stage</span>
            <p className="text-gray-700">{project.stageDetail}</p>
          </div>
        </div>

        {/* Key Players */}
        <div className="flex gap-4 text-xs pt-1 border-t border-gray-100">
          <div>
            <span className="text-gray-400">Owner</span>
            <p className="text-gray-700">{project.owner}</p>
          </div>
          <div>
            <span className="text-gray-400">GC</span>
            <p className="font-medium text-gray-900">{project.gc}</p>
          </div>
          <div>
            <span className="text-gray-400">Architect</span>
            <p className="text-gray-700">{project.architect}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg text-xs">
          <User size={14} className="text-gray-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              {contact.name}, {contact.title}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Linkedin size={11} className={linkedin.color} />
              <span className={linkedin.color}>
                {linkedin.label}
                {contact.linkedInMutualName && ` (via ${contact.linkedInMutualName} @ ${contact.linkedInMutualCompany})`}
              </span>
            </div>
          </div>
        </div>

        {/* Pain Point */}
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">{project.primaryPainPoint}</p>
            <p className="text-amber-700 mt-0.5">{project.painPointDetail}</p>
          </div>
        </div>

        {/* Warm Intro (if exists) */}
        {connection && (
          <div className="flex items-start gap-2 p-2.5 bg-orange-50 border border-orange-100 rounded-lg text-xs">
            <Handshake size={14} className="text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-orange-800">
                {connection.name} — you've closed {connection.dealsClosedVia} deal{connection.dealsClosedVia !== 1 ? 's' : ''} via {connection.name.split(' ')[0]}
              </p>
            </div>
          </div>
        )}

        {/* Engagement signal (if contact has engagements) */}
        {!connection && contact.engagements.length > 0 && (
          <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs">
            <MessageCircle size={14} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-800">
              {contact.engagements[0].description}
              {contact.engagements[0].count ? ` (${contact.engagements[0].count}x)` : ''}
            </p>
          </div>
        )}

        {/* Suggested Service */}
        <div className="flex items-start gap-2 p-2.5 bg-primary-50 border border-primary-100 rounded-lg text-xs">
          <Lightbulb size={14} className="text-primary-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-primary-800">
              Lead with: {project.suggestedService}
            </p>
            <p className="text-primary-700 mt-0.5">
              {caseStudy.clientName} {caseStudy.projectName} — {caseStudy.roiDisplay} {caseStudy.roiType}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
