/**
 * PlexifyAEC — Tool registry
 *
 * Exports all Claude tool definitions and executors.
 * Legacy tools (search_prospects, draft_outreach, analyze_pipeline) query the prospects table.
 * Sprint 0 tools (search_opportunities, etc.) query the opportunities table.
 */

import * as searchProspects from './search-prospects.js';
import * as draftOutreach from './draft-outreach.js';
import * as analyzePipeline from './analyze-pipeline.js';
import * as searchOpportunities from './search-opportunities.js';
import * as analyzeOpportunityPipeline from './analyze-opportunity-pipeline.js';
import * as draftOpportunityOutreach from './draft-opportunity-outreach.js';

// Tool definitions for Claude API (passed to messages.create)
export const toolDefinitions = [
  // Legacy prospect tools (Mel's AEC data)
  searchProspects.definition,
  draftOutreach.definition,
  analyzePipeline.definition,
  // Sprint 0 opportunity tools (Ken's LinkedIn + Ben's SunnAx data)
  searchOpportunities.definition,
  analyzeOpportunityPipeline.definition,
  draftOpportunityOutreach.definition,
];

// Map of tool name → execute(input, tenantId)
export const toolExecutors = {
  // Legacy
  search_prospects: searchProspects.execute,
  draft_outreach: draftOutreach.execute,
  analyze_pipeline: analyzePipeline.execute,
  // Sprint 0
  search_opportunities: searchOpportunities.execute,
  analyze_opportunity_pipeline: analyzeOpportunityPipeline.execute,
  draft_opportunity_outreach: draftOpportunityOutreach.execute,
};
