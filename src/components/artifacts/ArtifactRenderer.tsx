/**
 * ArtifactRenderer — Universal dispatcher for skill-generated artifacts.
 *
 * Accepts the artifact envelope from deal_room_artifacts and routes to
 * the correct sub-renderer based on artifact_type. Falls back to a
 * formatted JSON code block for unknown types (never crashes).
 */

import React from 'react';
import DealSummaryRenderer from './DealSummaryRenderer';
import CompetitiveAnalysisRenderer from './CompetitiveAnalysisRenderer';
import MeetingPrepRenderer from './MeetingPrepRenderer';
import OutreachSequenceRenderer from './OutreachSequenceRenderer';
import InfographicRenderer from './InfographicRenderer';
import BoardBriefRenderer from '../BoardBriefRenderer';
import OZRFSectionRenderer from '../OZRFSectionRenderer';

interface ArtifactRendererProps {
  artifactType: string;
  contentJson: any; // The full envelope ({ artifact_type, output, ... }) or raw output
  provenanceJson?: any;
  onCitationClick?: (sourceFileName: string, chunkIndex: number) => void;
}

/**
 * Extract the output object from either an envelope or raw content.
 * Handles both { output: {...} } envelopes and direct output objects.
 */
function extractOutput(contentJson: any): any {
  if (!contentJson) return null;
  if (contentJson.output && typeof contentJson.output === 'object') {
    return contentJson.output;
  }
  return contentJson;
}

export default function ArtifactRenderer({
  artifactType,
  contentJson,
  provenanceJson,
  onCitationClick,
}: ArtifactRendererProps) {
  const output = extractOutput(contentJson);

  if (!output) {
    return (
      <div className="p-4 text-sm text-gray-400">
        No content available for this artifact.
      </div>
    );
  }

  try {
    switch (artifactType) {
      case 'deal_summary':
        return <DealSummaryRenderer output={output} onCitationClick={onCitationClick} />;

      case 'competitive_analysis':
        return <CompetitiveAnalysisRenderer output={output} onCitationClick={onCitationClick} />;

      case 'meeting_prep':
        return <MeetingPrepRenderer output={output} onCitationClick={onCitationClick} />;

      case 'board_brief': {
        // BoardBriefRenderer expects BoardBriefEnvelope { agentId, output: {...} }
        // New generation endpoint produces { artifact_type, output: {...} }
        // Adapt to the expected shape if needed
        const briefEnvelope = contentJson.agentId
          ? contentJson
          : {
              agentId: 'board-brief' as const,
              schemaVersion: '1.0' as const,
              generatedAt: contentJson.generated_at || new Date().toISOString(),
              projectId: contentJson.deal_room_id || '',
              sourcesUsed: (contentJson.sources_used || []).map((s: any) => ({ id: s.id, label: s.file_name || s.id })),
              output: output,
            };
        return <BoardBriefRenderer brief={briefEnvelope} />;
      }

      case 'ozrf_section': {
        // OZRFSectionRenderer expects OZRFSectionEnvelope { agentId, output: {...} }
        const ozrfEnvelope = contentJson.agentId
          ? contentJson
          : {
              agentId: 'ozrf-section' as const,
              schemaVersion: '1.0' as const,
              generatedAt: contentJson.generated_at || new Date().toISOString(),
              projectId: contentJson.deal_room_id || '',
              sourcesUsed: (contentJson.sources_used || []).map((s: any) => ({ id: s.id, label: s.file_name || s.id })),
              output: output,
            };
        return <OZRFSectionRenderer section={ozrfEnvelope} />;
      }

      case 'outreach_sequence':
        return <OutreachSequenceRenderer output={output} onCitationClick={onCitationClick} />;

      case 'infographic':
        return <InfographicRenderer output={output} onCitationClick={onCitationClick} />;

      default:
        // Fallback: formatted JSON for unknown types
        return <FallbackRenderer artifactType={artifactType} output={output} />;
    }
  } catch (err) {
    console.error(`[ArtifactRenderer] Render error for type="${artifactType}":`, err);
    return <FallbackRenderer artifactType={artifactType} output={output} />;
  }
}

function FallbackRenderer({ artifactType, output }: { artifactType: string; output: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-gray-700/40 text-gray-400 border border-gray-600/30">
          {artifactType.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-gray-500">Raw output</span>
      </div>
      <pre className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-4 text-xs text-gray-400 overflow-x-auto max-h-96 overflow-y-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}
