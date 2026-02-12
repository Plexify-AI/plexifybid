/**
 * PlexifySOLO — Tool registry
 *
 * Exports all Claude tool definitions and executors.
 */

import * as searchProspects from './search-prospects.js';
import * as draftOutreach from './draft-outreach.js';
import * as analyzePipeline from './analyze-pipeline.js';

// Tool definitions for Claude API (passed to messages.create)
export const toolDefinitions = [
  searchProspects.definition,
  draftOutreach.definition,
  analyzePipeline.definition,
];

// Map of tool name → execute(input, tenantId)
export const toolExecutors = {
  search_prospects: searchProspects.execute,
  draft_outreach: draftOutreach.execute,
  analyze_pipeline: analyzePipeline.execute,
};
