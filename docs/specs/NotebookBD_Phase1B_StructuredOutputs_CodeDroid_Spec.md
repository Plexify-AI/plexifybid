# NotebookBD Phase 1B: BID Agent Structured Outputs

## Code Droid Implementation Specification

**Version:** 1.0  
**Date:** December 29, 2025  
**Author:** Ken D'Amato / Plexify AI  
**Target:** Code Droid (Factory.ai)  
**Branch:** `feature/notebookbd-phase1b`  
**Prereq:** Phase 1A complete on `feature/notebookbd-phase1a`  
**Estimated Duration:** 2-3 days

---

## Executive Summary

Phase 1B transforms BID agent chips from **chat responses** into **structured documents** rendered in the Block Editor Canvas. This is the "wow factor" for enterprise demos:

> "Upload your BID documents, click one button, get a board-ready brief in 30 seconds — every claim linked to the source."

### The Transformation

| Phase 1A (Current) | Phase 1B (Target) |
|-------------------|-------------------|
| Click "Generate Board Brief" | Click "Generate Board Brief" |
| → Chat response with bullets | → **Formatted document** in editor |
| Plain text output | Sections, headers, tables, KPIs |
| Citations in chat only | Citations embedded in document |
| Copy/paste to use | **Export to DOCX/PDF** |

---

## Three BID Agents — Structured Output Definitions

### Agent 1: Generate Board Brief

**Purpose:** One-page executive summary for board meetings

**Output Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ BOARD BRIEF                                                 │
│ Golden Triangle Business Improvement District               │
│ Prepared: December 29, 2025                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ EXECUTIVE SUMMARY                                           │
│ [3-4 sentence overview with citations [1][2]]               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ KEY METRICS                                                 │
│ ┌─────────────┬─────────────┬─────────────┐                │
│ │ Assessment  │ Budget      │ Initiative  │                │
│ │ Collection  │ Status      │ Progress    │                │
│ │ 94.2% [1]   │ On Track [2]│ 3 of 5 [1]  │                │
│ └─────────────┴─────────────┴─────────────┘                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ACTION ITEMS FOR BOARD ATTENTION                            │
│ • Item 1 with context [citation]                            │
│ • Item 2 with context [citation]                            │
│ • Item 3 with context [citation]                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ UPCOMING DEADLINES                                          │
│ • Dec 15: Q4 assessment notices [1]                         │
│ • Jan 10: Annual report submission [2]                      │
│ • Feb 1: Budget hearing [1]                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Data Model:**
```typescript
interface BoardBrief {
  type: 'board-brief';
  metadata: {
    districtName: string;
    preparedDate: string;
    sourceCount: number;
  };
  sections: {
    executiveSummary: {
      content: string;
      citations: Citation[];
    };
    keyMetrics: {
      assessmentCollection: { value: string; citation?: Citation };
      budgetStatus: { value: string; citation?: Citation };
      initiativeProgress: { value: string; citation?: Citation };
    };
    actionItems: Array<{
      content: string;
      citation?: Citation;
    }>;
    upcomingDeadlines: Array<{
      date: string;
      description: string;
      citation?: Citation;
    }>;
  };
}
```

---

### Agent 2: Extract Assessment Trends

**Purpose:** Analysis of collection rates and revenue patterns

**Output Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ ASSESSMENT TRENDS ANALYSIS                                  │
│ Q3 2024 Collection Performance                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ COLLECTION SUMMARY                                          │
│ ┌──────────────────┬──────────┬──────────┬────────┐        │
│ │ Property Type    │ Billed   │ Collected│ Rate   │        │
│ ├──────────────────┼──────────┼──────────┼────────┤        │
│ │ Commercial       │ $1.2M    │ $1.15M   │ 96% [1]│        │
│ │ Retail           │ $800K    │ $728K    │ 91% [1]│        │
│ │ Residential      │ $440K    │ $387K    │ 88% [1]│        │
│ │ TOTAL            │ $2.44M   │ $2.27M   │ 93% [1]│        │
│ └──────────────────┴──────────┴──────────┴────────┘        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ DELINQUENCY AGING                                           │
│ • 30 days: $45,000 (12 properties) [2]                      │
│ • 60 days: $23,000 (5 properties) [2]                       │
│ • 90+ days: $12,000 (3 properties) [2]                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ TOP DELINQUENT ACCOUNTS                                     │
│ 1. 123 Main St - $8,500 (120 days) [2]                      │
│ 2. 456 Oak Ave - $4,200 (95 days) [2]                       │
│ 3. 789 Pine Rd - $3,800 (90 days) [2]                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS                                             │
│ • [AI-generated recommendation based on data]               │
│ • [AI-generated recommendation based on data]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Data Model:**
```typescript
interface AssessmentTrends {
  type: 'assessment-trends';
  metadata: {
    period: string;
    preparedDate: string;
  };
  sections: {
    collectionSummary: {
      rows: Array<{
        propertyType: string;
        billed: string;
        collected: string;
        rate: string;
        citation?: Citation;
      }>;
      total: {
        billed: string;
        collected: string;
        rate: string;
        citation?: Citation;
      };
    };
    delinquencyAging: Array<{
      bucket: string;
      amount: string;
      propertyCount: number;
      citation?: Citation;
    }>;
    topDelinquent: Array<{
      address: string;
      amount: string;
      daysOverdue: number;
      citation?: Citation;
    }>;
    recommendations: Array<{
      content: string;
    }>;
  };
}
```

---

### Agent 3: Draft OZRF Section

**Purpose:** Opportunity Zone Reporting Framework compliance content

**Output Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ OZRF COMPLIANCE SECTION                                     │
│ Reporting Period: Q3 2024                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ COMMUNITY IMPACT METRICS                                    │
│ • Jobs Created: 45 full-time positions [1]                  │
│ • Jobs Retained: 120 positions [1]                          │
│ • Local Hiring: 78% from census tract [2]                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ INVESTMENT FACILITATION                                     │
│ • Total Investment Attracted: $12.5M [1]                    │
│ • QOF Investments: 3 qualified funds [2]                    │
│ • Business Relocations: 2 new businesses [1]                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ENVIRONMENTAL & SOCIAL OUTCOMES                             │
│ • Brownfield Remediation: 2 acres [2]                       │
│ • Affordable Housing Units: 15 planned [1]                  │
│ • Community Programs: 4 active initiatives [1]              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ DISCLOSURE STATEMENT                                        │
│ This section prepared in accordance with OZRF guidelines.   │
│ Data sourced from district records and verified against     │
│ original documentation. [Auto-generated]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Data Model:**
```typescript
interface OZRFSection {
  type: 'ozrf-section';
  metadata: {
    reportingPeriod: string;
    preparedDate: string;
  };
  sections: {
    communityImpact: {
      jobsCreated: { value: number; citation?: Citation };
      jobsRetained: { value: number; citation?: Citation };
      localHiringRate: { value: string; citation?: Citation };
    };
    investmentFacilitation: {
      totalInvestment: { value: string; citation?: Citation };
      qofInvestments: { value: number; citation?: Citation };
      businessRelocations: { value: number; citation?: Citation };
    };
    environmentalSocial: Array<{
      metric: string;
      value: string;
      citation?: Citation;
    }>;
    disclosureStatement: string;
  };
}
```

---

## Architecture Overview

### Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User clicks    │────▶│  Agent Service   │────▶│  Structured     │
│  "Generate      │     │  generates       │     │  JSON output    │
│  Board Brief"   │     │  structured data │     │  with citations │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Export to      │◀────│  Block Editor    │◀────│  Renderer       │
│  DOCX/PDF       │     │  Canvas display  │     │  components     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### New Components Needed

```
src/
├── components/
│   ├── StructuredOutputs/
│   │   ├── index.tsx                    # Export barrel
│   │   ├── BoardBriefRenderer.tsx       # Renders BoardBrief type
│   │   ├── AssessmentTrendsRenderer.tsx # Renders AssessmentTrends type
│   │   ├── OZRFSectionRenderer.tsx      # Renders OZRFSection type
│   │   ├── MetricCard.tsx               # Reusable KPI card
│   │   ├── DataTable.tsx                # Reusable table component
│   │   ├── SectionHeader.tsx            # Styled section headers
│   │   └── CitationInline.tsx           # Inline citation [1] in docs
│   │
│   └── BlockEditor/
│       ├── StructuredBlock.tsx          # NEW: Renders structured outputs
│       └── ... (existing)
│
├── services/
│   ├── agentService.ts                  # NEW: Structured output generation
│   └── exportService.ts                 # NEW: DOCX/PDF export
│
├── types/
│   └── structuredOutputs.ts             # NEW: Type definitions
│
└── api/
    └── agents.ts                        # NEW: /api/agents/:agentId endpoint
```

---

## Backend Implementation

### Agent Service

```typescript
// src/services/agentService.ts

import Anthropic from '@anthropic-ai/sdk';
import { BoardBrief, AssessmentTrends, OZRFSection } from '@/types/structuredOutputs';
import { retrieveRelevantChunks, RetrievedChunk } from './ragService';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type StructuredOutput = BoardBrief | AssessmentTrends | OZRFSection;

export async function generateStructuredOutput(
  agentId: string,
  projectId: string,
  selectedSourceIds: string[]
): Promise<StructuredOutput> {
  
  // Retrieve relevant chunks
  const chunks = await retrieveRelevantChunks(
    getQueryForAgent(agentId),
    projectId,
    selectedSourceIds,
    15 // More chunks for structured output
  );
  
  // Build context
  const context = buildContextFromChunks(chunks);
  
  // Get agent-specific prompt
  const systemPrompt = getAgentSystemPrompt(agentId);
  
  // Generate structured output
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Based on the following source documents, generate the structured output.\n\n${context}`
      }
    ]
  });
  
  // Parse JSON from response
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');
  
  const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  
  const output = JSON.parse(jsonMatch[1]) as StructuredOutput;
  
  // Enrich citations with source metadata
  return enrichCitations(output, chunks);
}

function getQueryForAgent(agentId: string): string {
  switch (agentId) {
    case 'board-brief':
      return 'executive summary board meeting metrics action items deadlines budget assessment';
    case 'assessment-trends':
      return 'assessment collection rate delinquency revenue property type billing';
    case 'ozrf-section':
      return 'opportunity zone jobs investment community impact environmental';
    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

function getAgentSystemPrompt(agentId: string): string {
  const basePrompt = `You are a BID (Business Improvement District) document specialist. 
Generate structured data based on the provided source documents.
IMPORTANT: Only include information found in the sources. Cite everything.
Output valid JSON wrapped in \`\`\`json code blocks.`;

  switch (agentId) {
    case 'board-brief':
      return `${basePrompt}

Generate a BoardBrief with this exact structure:
{
  "type": "board-brief",
  "metadata": {
    "districtName": "string - extract from sources or use 'Business Improvement District'",
    "preparedDate": "string - today's date",
    "sourceCount": number
  },
  "sections": {
    "executiveSummary": {
      "content": "string - 3-4 sentences summarizing key points",
      "citations": [{ "number": 1, "sourceId": "string", "sourceName": "string", "quote": "string" }]
    },
    "keyMetrics": {
      "assessmentCollection": { "value": "string like '94.2%'", "citation": {...} },
      "budgetStatus": { "value": "string like 'On Track'", "citation": {...} },
      "initiativeProgress": { "value": "string like '3 of 5 complete'", "citation": {...} }
    },
    "actionItems": [
      { "content": "string - action item description", "citation": {...} }
    ],
    "upcomingDeadlines": [
      { "date": "string", "description": "string", "citation": {...} }
    ]
  }
}

If data for a field is not in sources, use "Not available in sources" as the value.`;

    case 'assessment-trends':
      return `${basePrompt}

Generate an AssessmentTrends analysis with this exact structure:
{
  "type": "assessment-trends",
  "metadata": {
    "period": "string - e.g., 'Q3 2024'",
    "preparedDate": "string - today's date"
  },
  "sections": {
    "collectionSummary": {
      "rows": [
        { "propertyType": "Commercial", "billed": "$X", "collected": "$X", "rate": "X%", "citation": {...} }
      ],
      "total": { "billed": "$X", "collected": "$X", "rate": "X%", "citation": {...} }
    },
    "delinquencyAging": [
      { "bucket": "30 days", "amount": "$X", "propertyCount": N, "citation": {...} }
    ],
    "topDelinquent": [
      { "address": "string", "amount": "$X", "daysOverdue": N, "citation": {...} }
    ],
    "recommendations": [
      { "content": "string - AI recommendation based on data" }
    ]
  }
}`;

    case 'ozrf-section':
      return `${basePrompt}

Generate an OZRFSection with this exact structure:
{
  "type": "ozrf-section",
  "metadata": {
    "reportingPeriod": "string - e.g., 'Q3 2024'",
    "preparedDate": "string - today's date"
  },
  "sections": {
    "communityImpact": {
      "jobsCreated": { "value": N, "citation": {...} },
      "jobsRetained": { "value": N, "citation": {...} },
      "localHiringRate": { "value": "X%", "citation": {...} }
    },
    "investmentFacilitation": {
      "totalInvestment": { "value": "$X", "citation": {...} },
      "qofInvestments": { "value": N, "citation": {...} },
      "businessRelocations": { "value": N, "citation": {...} }
    },
    "environmentalSocial": [
      { "metric": "string", "value": "string", "citation": {...} }
    ],
    "disclosureStatement": "This section prepared in accordance with OZRF guidelines..."
  }
}`;

    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

function buildContextFromChunks(chunks: RetrievedChunk[]): string {
  return chunks.map((chunk, idx) => {
    const pageInfo = chunk.pageNumber ? `, Page ${chunk.pageNumber}` : '';
    return `[Source ${idx + 1}: ${chunk.sourceName}${pageInfo}]
${chunk.content}

---`;
  }).join('\n\n');
}

function enrichCitations(output: StructuredOutput, chunks: RetrievedChunk[]): StructuredOutput {
  // Walk through output and enrich citation objects with full source metadata
  // This is a simplified version - full implementation would recursively walk the object
  return output;
}
```

### API Endpoint

```typescript
// src/api/agents.ts (or pages/api/agents/[agentId].ts for Next.js)

import { NextRequest, NextResponse } from 'next/server';
import { generateStructuredOutput } from '@/services/agentService';

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { projectId, selectedSourceIds } = await request.json();
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }
    
    const output = await generateStructuredOutput(
      params.agentId,
      projectId,
      selectedSourceIds || []
    );
    
    return NextResponse.json(output);
    
  } catch (error) {
    console.error('Agent generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
```

---

## Frontend Components

### Board Brief Renderer

```tsx
// src/components/StructuredOutputs/BoardBriefRenderer.tsx

import React from 'react';
import { BoardBrief } from '@/types/structuredOutputs';
import { MetricCard } from './MetricCard';
import { SectionHeader } from './SectionHeader';
import { CitationInline } from './CitationInline';
import { FileText, Calendar, AlertCircle } from 'lucide-react';

interface BoardBriefRendererProps {
  data: BoardBrief;
  onCitationClick: (citation: Citation) => void;
}

export const BoardBriefRenderer: React.FC<BoardBriefRendererProps> = ({
  data,
  onCitationClick
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
        <div className="flex items-center gap-2 text-indigo-200 text-sm mb-1">
          <FileText size={16} />
          <span>Board Brief</span>
        </div>
        <h2 className="text-xl font-bold">{data.metadata.districtName}</h2>
        <p className="text-indigo-200 text-sm">
          Prepared: {data.metadata.preparedDate} • {data.metadata.sourceCount} sources analyzed
        </p>
      </div>
      
      {/* Executive Summary */}
      <div className="p-6 border-b border-slate-200">
        <SectionHeader icon={<FileText size={18} />} title="Executive Summary" />
        <p className="text-slate-700 leading-relaxed mt-3">
          {data.sections.executiveSummary.content}
          {data.sections.executiveSummary.citations.map(c => (
            <CitationInline 
              key={c.number} 
              citation={c} 
              onClick={onCitationClick} 
            />
          ))}
        </p>
      </div>
      
      {/* Key Metrics */}
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <SectionHeader title="Key Metrics" />
        <div className="grid grid-cols-3 gap-4 mt-4">
          <MetricCard
            label="Assessment Collection"
            value={data.sections.keyMetrics.assessmentCollection.value}
            citation={data.sections.keyMetrics.assessmentCollection.citation}
            onCitationClick={onCitationClick}
            color="green"
          />
          <MetricCard
            label="Budget Status"
            value={data.sections.keyMetrics.budgetStatus.value}
            citation={data.sections.keyMetrics.budgetStatus.citation}
            onCitationClick={onCitationClick}
            color="blue"
          />
          <MetricCard
            label="Initiative Progress"
            value={data.sections.keyMetrics.initiativeProgress.value}
            citation={data.sections.keyMetrics.initiativeProgress.citation}
            onCitationClick={onCitationClick}
            color="purple"
          />
        </div>
      </div>
      
      {/* Action Items */}
      <div className="p-6 border-b border-slate-200">
        <SectionHeader icon={<AlertCircle size={18} />} title="Action Items for Board Attention" />
        <ul className="mt-3 space-y-2">
          {data.sections.actionItems.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 
                             flex items-center justify-center text-sm font-medium flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-slate-700">
                {item.content}
                {item.citation && (
                  <CitationInline citation={item.citation} onClick={onCitationClick} />
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Upcoming Deadlines */}
      <div className="p-6">
        <SectionHeader icon={<Calendar size={18} />} title="Upcoming Deadlines" />
        <div className="mt-3 space-y-2">
          {data.sections.upcomingDeadlines.map((deadline, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="text-sm font-medium text-indigo-600 w-24">
                {deadline.date}
              </span>
              <span className="text-slate-700">
                {deadline.description}
                {deadline.citation && (
                  <CitationInline citation={deadline.citation} onClick={onCitationClick} />
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### Metric Card Component

```tsx
// src/components/StructuredOutputs/MetricCard.tsx

import React from 'react';
import { Citation } from '@/types/structuredOutputs';
import { CitationInline } from './CitationInline';

interface MetricCardProps {
  label: string;
  value: string;
  citation?: Citation;
  onCitationClick: (citation: Citation) => void;
  color: 'green' | 'blue' | 'purple' | 'amber';
}

const colorClasses = {
  green: 'bg-green-50 border-green-200 text-green-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700'
};

const valueColorClasses = {
  green: 'text-green-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
  amber: 'text-amber-600'
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  citation,
  onCitationClick,
  color
}) => {
  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-75">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${valueColorClasses[color]}`}>
        {value}
        {citation && (
          <CitationInline citation={citation} onClick={onCitationClick} />
        )}
      </p>
    </div>
  );
};
```

### Data Table Component

```tsx
// src/components/StructuredOutputs/DataTable.tsx

import React from 'react';
import { Citation } from '@/types/structuredOutputs';
import { CitationInline } from './CitationInline';

interface Column {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps {
  columns: Column[];
  rows: Array<Record<string, any>>;
  onCitationClick: (citation: Citation) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  rows,
  onCitationClick
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map(col => (
              <th 
                key={col.key}
                className={`py-3 px-4 font-semibold text-slate-600 
                           text-${col.align || 'left'}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr 
              key={rowIdx}
              className="border-b border-slate-100 hover:bg-slate-50"
            >
              {columns.map(col => (
                <td 
                  key={col.key}
                  className={`py-3 px-4 text-${col.align || 'left'}`}
                >
                  {row[col.key]}
                  {row.citation && col.key === columns[columns.length - 1].key && (
                    <CitationInline 
                      citation={row.citation} 
                      onClick={onCitationClick} 
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Citation Inline Component

```tsx
// src/components/StructuredOutputs/CitationInline.tsx

import React, { useState } from 'react';
import { Citation } from '@/types/structuredOutputs';

interface CitationInlineProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
}

export const CitationInline: React.FC<CitationInlineProps> = ({
  citation,
  onClick
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <span className="relative inline-block">
      <button
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 
                   text-[10px] font-bold rounded bg-indigo-100 text-indigo-700
                   hover:bg-indigo-200 transition-colors ml-1 align-super"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => onClick(citation)}
      >
        {citation.number}
      </button>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                       bg-slate-800 text-white text-xs rounded-lg p-3 w-64 shadow-lg">
          <p className="font-semibold text-indigo-300 mb-1">{citation.sourceName}</p>
          <p className="text-slate-300 line-clamp-3">"{citation.quote}"</p>
          <p className="text-slate-500 text-[10px] mt-2">Click to view in source</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 
                         border-8 border-transparent border-t-slate-800" />
        </div>
      )}
    </span>
  );
};
```

### Structured Block in Editor

```tsx
// src/components/BlockEditor/StructuredBlock.tsx

import React from 'react';
import { StructuredOutput } from '@/types/structuredOutputs';
import { BoardBriefRenderer } from '../StructuredOutputs/BoardBriefRenderer';
import { AssessmentTrendsRenderer } from '../StructuredOutputs/AssessmentTrendsRenderer';
import { OZRFSectionRenderer } from '../StructuredOutputs/OZRFSectionRenderer';
import { Download, RefreshCw, Trash2 } from 'lucide-react';

interface StructuredBlockProps {
  data: StructuredOutput;
  onCitationClick: (citation: Citation) => void;
  onExport: (format: 'docx' | 'pdf') => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export const StructuredBlock: React.FC<StructuredBlockProps> = ({
  data,
  onCitationClick,
  onExport,
  onRegenerate,
  onDelete
}) => {
  const renderContent = () => {
    switch (data.type) {
      case 'board-brief':
        return <BoardBriefRenderer data={data} onCitationClick={onCitationClick} />;
      case 'assessment-trends':
        return <AssessmentTrendsRenderer data={data} onCitationClick={onCitationClick} />;
      case 'ozrf-section':
        return <OZRFSectionRenderer data={data} onCitationClick={onCitationClick} />;
      default:
        return <div>Unknown output type</div>;
    }
  };
  
  return (
    <div className="group relative">
      {/* Action Bar */}
      <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 
                     transition-opacity flex items-center gap-2 bg-white rounded-lg 
                     shadow-md border border-slate-200 p-1">
        <button
          onClick={() => onExport('docx')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs 
                    font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Download size={14} />
          DOCX
        </button>
        <button
          onClick={() => onExport('pdf')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs 
                    font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Download size={14} />
          PDF
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs 
                    font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <RefreshCw size={14} />
          Regenerate
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      {/* Content */}
      {renderContent()}
    </div>
  );
};
```

---

## Export Service

```typescript
// src/services/exportService.ts

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } from 'docx';
import { StructuredOutput, BoardBrief, AssessmentTrends } from '@/types/structuredOutputs';

export async function exportToDocx(data: StructuredOutput): Promise<Blob> {
  const doc = new Document({
    sections: [{
      children: generateDocxContent(data)
    }]
  });
  
  return await Packer.toBlob(doc);
}

function generateDocxContent(data: StructuredOutput): (Paragraph | Table)[] {
  switch (data.type) {
    case 'board-brief':
      return generateBoardBriefDocx(data);
    case 'assessment-trends':
      return generateAssessmentTrendsDocx(data);
    case 'ozrf-section':
      return generateOZRFSectionDocx(data);
    default:
      return [];
  }
}

function generateBoardBriefDocx(data: BoardBrief): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];
  
  // Title
  content.push(
    new Paragraph({
      text: 'BOARD BRIEF',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 }
    }),
    new Paragraph({
      text: data.metadata.districtName,
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: `Prepared: ${data.metadata.preparedDate}`,
      spacing: { after: 400 }
    })
  );
  
  // Executive Summary
  content.push(
    new Paragraph({
      text: 'EXECUTIVE SUMMARY',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 400, after: 200 }
    }),
    new Paragraph({
      text: data.sections.executiveSummary.content,
      spacing: { after: 400 }
    })
  );
  
  // Key Metrics (as table)
  content.push(
    new Paragraph({
      text: 'KEY METRICS',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 400, after: 200 }
    }),
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Assessment Collection')] }),
            new TableCell({ children: [new Paragraph('Budget Status')] }),
            new TableCell({ children: [new Paragraph('Initiative Progress')] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(data.sections.keyMetrics.assessmentCollection.value)] }),
            new TableCell({ children: [new Paragraph(data.sections.keyMetrics.budgetStatus.value)] }),
            new TableCell({ children: [new Paragraph(data.sections.keyMetrics.initiativeProgress.value)] })
          ]
        })
      ]
    })
  );
  
  // Action Items
  content.push(
    new Paragraph({
      text: 'ACTION ITEMS FOR BOARD ATTENTION',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 400, after: 200 }
    })
  );
  
  data.sections.actionItems.forEach((item, idx) => {
    content.push(
      new Paragraph({
        text: `${idx + 1}. ${item.content}`,
        spacing: { after: 100 }
      })
    );
  });
  
  // Deadlines
  content.push(
    new Paragraph({
      text: 'UPCOMING DEADLINES',
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 400, after: 200 }
    })
  );
  
  data.sections.upcomingDeadlines.forEach(deadline => {
    content.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${deadline.date}: `, bold: true }),
          new TextRun({ text: deadline.description })
        ],
        spacing: { after: 100 }
      })
    );
  });
  
  return content;
}

// Similar functions for AssessmentTrends and OZRFSection...
```

---

## Integration with Chat Panel

Update the BID agent chips to trigger structured output generation:

```tsx
// In AskPlexi/BIDAgentChips.tsx or wherever chips are defined

const handleAgentClick = async (agentId: string) => {
  setIsGenerating(true);
  
  try {
    // Call structured output API
    const response = await fetch(`/api/agents/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        selectedSourceIds: sources.filter(s => s.isSelectedForContext).map(s => s.id)
      })
    });
    
    if (!response.ok) throw new Error('Generation failed');
    
    const structuredOutput = await response.json();
    
    // Add to editor canvas as a StructuredBlock
    addBlockToEditor({
      type: 'structured-output',
      data: structuredOutput
    });
    
    // Also add a chat message confirming generation
    addChatMessage({
      role: 'assistant',
      content: `I've generated a ${getAgentLabel(agentId)} based on your sources. You can see it in the editor canvas, export it to DOCX/PDF, or ask me to modify specific sections.`
    });
    
  } catch (error) {
    addChatMessage({
      role: 'assistant',
      content: `Sorry, I couldn't generate the ${getAgentLabel(agentId)}. Please try again or check that you have sources selected.`
    });
  } finally {
    setIsGenerating(false);
  }
};
```

---

## Type Definitions

```typescript
// src/types/structuredOutputs.ts

export interface Citation {
  number: number;
  sourceId: string;
  sourceName: string;
  quote: string;
  pageNumber?: number;
  charStart?: number;
  charEnd?: number;
}

export interface BoardBrief {
  type: 'board-brief';
  metadata: {
    districtName: string;
    preparedDate: string;
    sourceCount: number;
  };
  sections: {
    executiveSummary: {
      content: string;
      citations: Citation[];
    };
    keyMetrics: {
      assessmentCollection: { value: string; citation?: Citation };
      budgetStatus: { value: string; citation?: Citation };
      initiativeProgress: { value: string; citation?: Citation };
    };
    actionItems: Array<{
      content: string;
      citation?: Citation;
    }>;
    upcomingDeadlines: Array<{
      date: string;
      description: string;
      citation?: Citation;
    }>;
  };
}

export interface AssessmentTrends {
  type: 'assessment-trends';
  metadata: {
    period: string;
    preparedDate: string;
  };
  sections: {
    collectionSummary: {
      rows: Array<{
        propertyType: string;
        billed: string;
        collected: string;
        rate: string;
        citation?: Citation;
      }>;
      total: {
        billed: string;
        collected: string;
        rate: string;
        citation?: Citation;
      };
    };
    delinquencyAging: Array<{
      bucket: string;
      amount: string;
      propertyCount: number;
      citation?: Citation;
    }>;
    topDelinquent: Array<{
      address: string;
      amount: string;
      daysOverdue: number;
      citation?: Citation;
    }>;
    recommendations: Array<{
      content: string;
    }>;
  };
}

export interface OZRFSection {
  type: 'ozrf-section';
  metadata: {
    reportingPeriod: string;
    preparedDate: string;
  };
  sections: {
    communityImpact: {
      jobsCreated: { value: number; citation?: Citation };
      jobsRetained: { value: number; citation?: Citation };
      localHiringRate: { value: string; citation?: Citation };
    };
    investmentFacilitation: {
      totalInvestment: { value: string; citation?: Citation };
      qofInvestments: { value: number; citation?: Citation };
      businessRelocations: { value: number; citation?: Citation };
    };
    environmentalSocial: Array<{
      metric: string;
      value: string;
      citation?: Citation;
    }>;
    disclosureStatement: string;
  };
}

export type StructuredOutput = BoardBrief | AssessmentTrends | OZRFSection;
```

---

## Success Criteria Checklist

### Agent Generation
- [ ] Clicking "Generate Board Brief" chip calls `/api/agents/board-brief`
- [ ] Clicking "Extract Assessment Trends" chip calls `/api/agents/assessment-trends`
- [ ] Clicking "Draft OZRF Section" chip calls `/api/agents/ozrf-section`
- [ ] API returns structured JSON matching type definitions
- [ ] Citations are included in structured output

### Rendering
- [ ] BoardBriefRenderer displays all sections correctly
- [ ] AssessmentTrendsRenderer displays tables and lists
- [ ] OZRFSectionRenderer displays compliance format
- [ ] MetricCard components show KPIs with colors
- [ ] DataTable renders collection summary
- [ ] CitationInline shows tooltip on hover, opens source on click

### Editor Integration
- [ ] Structured output appears in Block Editor Canvas
- [ ] Hover shows action bar (Export DOCX, Export PDF, Regenerate, Delete)
- [ ] Multiple structured blocks can exist in one document

### Export
- [ ] Export to DOCX generates valid Word document
- [ ] Export to PDF generates valid PDF
- [ ] Exported documents include all sections and data

### Polish
- [ ] Loading state while generating
- [ ] Error handling with user-friendly messages
- [ ] Responsive design for different screen sizes

---

## Demo Documents Update

Enhance demo documents in `public/demo-data/` with more structured data for testing:

### Golden_Triangle_BID_Annual_Report_2024.txt
```
Golden Triangle Business Improvement District
Annual Report 2024

EXECUTIVE SUMMARY
The Golden Triangle BID achieved a 94.2% assessment collection rate in 2024, 
exceeding our 92% target. Total assessments billed: $2.44M. Total collected: $2.30M.

Budget status: On track with 98% of planned expenditures executed.
Initiative progress: 3 of 5 major initiatives completed ahead of schedule.

KEY METRICS
- Assessment Collection: 94.2%
- Operating Budget: $1.8M (98% utilized)
- Capital Projects: $650K invested
- New Businesses: 12 opened in district

2025 PRIORITIES
1. Improve assessment collections and delinquency follow-up
2. Launch wayfinding signage program
3. Expand stakeholder engagement with property owners and the board

ACTION ITEMS FOR BOARD
- Approve Q1 2025 budget amendment ($45K for signage)
- Review delinquency escalation policy
- Confirm annual meeting date (March 15)

UPCOMING DEADLINES
- December 15: Q4 assessment notices mailed
- January 10: Annual report submission to city
- February 1: Budget hearing with city council
```

### Q3_Assessment_Collection_Summary.txt
```
Q3 2024 Assessment Collection Summary
Golden Triangle Business Improvement District

COLLECTION BY PROPERTY TYPE
Commercial: Billed $1,200,000 | Collected $1,152,000 | Rate 96%
Retail: Billed $800,000 | Collected $728,000 | Rate 91%
Residential: Billed $440,000 | Collected $387,200 | Rate 88%
TOTAL: Billed $2,440,000 | Collected $2,267,200 | Rate 93%

DELINQUENCY AGING
30 days: $45,000 (12 properties)
60 days: $23,000 (5 properties)
90+ days: $12,000 (3 properties)

TOP DELINQUENT ACCOUNTS
1. 123 Main Street - $8,500 (120 days overdue)
2. 456 Oak Avenue - $4,200 (95 days overdue)
3. 789 Pine Road - $3,800 (90 days overdue)

RECOMMENDATIONS
- Increase early outreach on 30-day delinquency accounts
- Provide property owners with clear payment options and deadlines
- Coordinate with the board on consistent escalation pathways
```

### Board_Meeting_Minutes_Oct_2024.txt
```
Board Meeting Minutes
Golden Triangle Business Improvement District
October 10, 2024

ATTENDEES
Present: J. Smith (Chair), M. Johnson, R. Williams, T. Davis, L. Anderson
Absent: K. Brown (excused)
Quorum: Confirmed

AGENDA ITEMS

1. Approval of September Minutes
   Motion: M. Johnson | Second: R. Williams | Passed unanimously

2. Executive Director Report
   - Q3 collection rate: 93% ($2.27M of $2.44M)
   - Holiday lighting program RFP issued
   - Wayfinding signage design approved

3. Budget Amendment Discussion
   - Proposed $45K amendment for additional signage
   - Funding from reserve fund
   - Vote scheduled for November meeting

4. New Business
   - OZRF compliance report due Q4
   - Jobs created: 45 positions
   - Jobs retained: 120 positions
   - Total investment attracted: $12.5M

NEXT MEETING
November 14, 2024 at 3:00 PM
```

---

## Git Workflow

```bash
# Create feature branch from Phase 1A
git checkout feature/notebookbd-phase1a
git pull origin feature/notebookbd-phase1a
git checkout -b feature/notebookbd-phase1b

# Commit structure (suggested order):
git commit -m "feat(types): add structured output type definitions"
git commit -m "feat(api): add /api/agents endpoint for structured generation"
git commit -m "feat(services): implement agentService with Claude structured prompts"
git commit -m "feat(components): add BoardBriefRenderer component"
git commit -m "feat(components): add AssessmentTrendsRenderer component"
git commit -m "feat(components): add OZRFSectionRenderer component"
git commit -m "feat(components): add MetricCard, DataTable, CitationInline"
git commit -m "feat(components): add StructuredBlock for editor integration"
git commit -m "feat(services): implement DOCX export service"
git commit -m "feat(ui): integrate agent chips with structured output generation"
git commit -m "chore: enhance demo documents with structured data"
git commit -m "test: verify end-to-end structured output flow"

# Push and create PR
git push origin feature/notebookbd-phase1b
```

---

## Estimated Timeline

| Day | Tasks |
|-----|-------|
| Day 1 | Types, API endpoint, agentService, BoardBriefRenderer |
| Day 2 | AssessmentTrendsRenderer, OZRFSectionRenderer, shared components |
| Day 3 | Editor integration, export service, testing, polish |

---

**End of Phase 1B Specification**

*After Phase 1B, the demo story is complete: Upload → Generate → Export. Every claim linked to sources. Ready for accounting firm presentations.*
