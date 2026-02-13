/**
 * ProspectCardList — Renders a grid/list of ProspectCards from search_prospects results
 *
 * Shows total match count, query context, and expandable list.
 */

import React, { useState } from 'react';
import { Target, ChevronDown, ChevronUp } from 'lucide-react';
import ProspectCard, { Prospect } from './ProspectCard';

interface SearchProspectsResult {
  total_matches: number;
  query: string;
  filters_applied?: Record<string, any>;
  prospects: Prospect[];
}

interface ProspectCardListProps {
  data: SearchProspectsResult;
  onDraftOutreach?: (prospectName: string, refId: string) => void;
}

const INITIAL_SHOW = 3;

const ProspectCardList: React.FC<ProspectCardListProps> = ({ data, onDraftOutreach }) => {
  const [showAll, setShowAll] = useState(false);

  const { prospects, total_matches, query } = data;
  const displayProspects = showAll ? prospects : prospects.slice(0, INITIAL_SHOW);
  const hasMore = prospects.length > INITIAL_SHOW;

  return (
    <div className="mt-3 mb-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/25 rounded-full">
          <Target size={13} className="text-blue-400" />
          <span className="text-xs font-medium text-blue-300">
            {total_matches} prospect{total_matches !== 1 ? 's' : ''} found
          </span>
        </div>
      </div>

      {/* Cards grid — 1 col on narrow, 2 on wider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {displayProspects.map((prospect) => (
          <ProspectCard
            key={prospect.ref_id}
            prospect={prospect}
            onDraftOutreach={onDraftOutreach}
          />
        ))}
      </div>

      {/* Show more / less toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1.5 mx-auto mt-3 px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800/40 border border-gray-700/50 rounded-full hover:border-gray-600 transition-all"
        >
          {showAll ? (
            <>Show less <ChevronUp size={13} /></>
          ) : (
            <>Show {prospects.length - INITIAL_SHOW} more <ChevronDown size={13} /></>
          )}
        </button>
      )}
    </div>
  );
};

export default ProspectCardList;
