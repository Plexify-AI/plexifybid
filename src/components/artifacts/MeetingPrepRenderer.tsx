/**
 * MeetingPrepRenderer — Renders a MeetingPrep artifact.
 *
 * Agenda items with timing, talking points, objection handlers,
 * key questions, and background context block.
 */

import React from 'react';
import {
  Calendar, MessageCircle, Shield, HelpCircle, BookOpen, Clock, Users
} from 'lucide-react';
import { InlineCitation } from './CitationBadge';
import type { MeetingPrepOutput } from '../../types/artifacts';

interface Attendee {
  name: string;
  role: string;
  relationship_notes: string;
}

interface Props {
  output: MeetingPrepOutput & { attendees?: Attendee[] };
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}

const MeetingPrepRenderer: React.FC<Props> = ({ output, onCitationClick }) => {
  return (
    <div className="space-y-5">
      {/* Meeting Context */}
      <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Meeting Context</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed"><InlineCitation text={output.meeting_context} onCitationClick={onCitationClick} /></p>
      </section>

      {/* Attendees */}
      {output.attendees && output.attendees.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Attendees</h3>
          </div>
          <div className="space-y-2">
            {output.attendees.map((person, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-purple-400">{person.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{person.name}</p>
                  <p className="text-[11px] text-gray-500">{person.role}</p>
                  {person.relationship_notes && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      <InlineCitation text={person.relationship_notes} onCitationClick={onCitationClick} />
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Agenda */}
      {output.agenda && output.agenda.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Agenda</h3>
          </div>
          <div className="space-y-2">
            {output.agenda.map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-3 py-2.5">
                <div className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-cyan-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{item.topic}</p>
                  {item.owner && (
                    <p className="text-[11px] text-gray-500">Owner: {item.owner}</p>
                  )}
                </div>
                <span className="text-[11px] text-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 rounded-full shrink-0">
                  {item.duration_minutes} min
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Talking Points */}
      {output.talking_points && output.talking_points.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Talking Points</h3>
          </div>
          <div className="space-y-2">
            {output.talking_points.map((point, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-emerald-400/60 font-semibold shrink-0">{i + 1}.</span>
                <span><InlineCitation text={point} onCitationClick={onCitationClick} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Objection Handlers */}
      {output.objection_handlers && output.objection_handlers.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Objection Handlers</h3>
          </div>
          <div className="space-y-3">
            {output.objection_handlers.map((handler, i) => (
              <div key={i} className="bg-gray-900/30 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-[10px] font-medium text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                    OBJECTION
                  </span>
                  <p className="text-sm text-gray-300"><InlineCitation text={handler.objection} onCitationClick={onCitationClick} /></p>
                </div>
                <div className="flex items-start gap-2 pl-[72px]">
                  <span className="text-[10px] font-medium text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                    RESPONSE
                  </span>
                  <p className="text-sm text-gray-400"><InlineCitation text={handler.response} onCitationClick={onCitationClick} /></p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key Questions */}
      {output.key_questions && output.key_questions.length > 0 && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Key Questions to Ask</h3>
          </div>
          <div className="space-y-2">
            {output.key_questions.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-purple-400 shrink-0">?</span>
                <span><InlineCitation text={q} onCitationClick={onCitationClick} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Background Context */}
      {output.background_context && (
        <section className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-white">Background Context</h3>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed"><InlineCitation text={output.background_context} onCitationClick={onCitationClick} /></p>
        </section>
      )}
    </div>
  );
};

export default MeetingPrepRenderer;
