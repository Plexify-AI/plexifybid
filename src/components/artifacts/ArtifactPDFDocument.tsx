/**
 * ArtifactPDFDocument — @react-pdf/renderer document for artifact PDF export.
 *
 * Single component handles all 3 artifact types with conditional sections.
 * Exports a downloadArtifactPDF() helper that renders to blob and triggers download.
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type {
  ArtifactContent,
  DealSummaryArtifact,
  CompetitiveAnalysisArtifact,
  MeetingPrepArtifact,
} from '../../types/artifacts';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a2e',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    marginTop: 16,
    color: '#1e3a5f',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  bulletItem: {
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.5,
    paddingLeft: 10,
  },
  numberedItem: {
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.5,
    paddingLeft: 10,
  },
  metricRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 4,
  },
  metricLabel: {
    width: '50%',
    fontSize: 10,
    color: '#6b7280',
  },
  metricValue: {
    width: '50%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeHigh: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
  },
  badgeMedium: {
    backgroundColor: '#fffbeb',
    color: '#d97706',
  },
  badgeLow: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
  },
  riskBlock: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  riskDescription: {
    fontSize: 10,
    marginTop: 4,
    lineHeight: 1.4,
  },
  riskMitigation: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
    fontStyle: 'italic',
  },
  competitorCard: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  competitorName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  competitorDiff: {
    fontSize: 9,
    color: '#3b82f6',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    width: '50%',
  },
  columnTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  columnItem: {
    fontSize: 9,
    color: '#4b5563',
    marginBottom: 2,
    paddingLeft: 6,
  },
  objectionBlock: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  objectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
    marginBottom: 2,
  },
  responseLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
    marginTop: 4,
    marginBottom: 2,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 4,
  },
  agendaNum: {
    width: 20,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#3b82f6',
  },
  agendaTopic: {
    flex: 1,
    fontSize: 10,
  },
  agendaTime: {
    width: 50,
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#374151',
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
  },
});

function badgeStyle(level: string) {
  switch (level) {
    case 'high': return styles.badgeHigh;
    case 'medium': return styles.badgeMedium;
    case 'low': return styles.badgeLow;
    default: return {};
  }
}

// ---------------------------------------------------------------------------
// Section renderers (per artifact type)
// ---------------------------------------------------------------------------

const DealSummarySections: React.FC<{ artifact: DealSummaryArtifact }> = ({ artifact }) => {
  const o = artifact.output;
  return (
    <>
      <Text style={styles.sectionTitle}>Executive Summary</Text>
      {o.executive_summary.map((item, i) => (
        <Text key={i} style={styles.bulletItem}>• {item}</Text>
      ))}

      {o.key_metrics?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          {o.key_metrics.map((m, i) => (
            <View key={i} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricValue}>{m.value}</Text>
            </View>
          ))}
        </>
      )}

      {o.key_players?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Key Players</Text>
          {o.key_players.map((p, i) => (
            <Text key={i} style={styles.bulletItem}>
              • {p.name} — {p.role}{p.organization ? ` (${p.organization})` : ''}
            </Text>
          ))}
        </>
      )}

      {o.timeline?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {o.timeline.map((t, i) => (
            <Text key={i} style={styles.numberedItem}>{i + 1}. {t}</Text>
          ))}
        </>
      )}

      {o.risks?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Risks</Text>
          {o.risks.map((r, i) => (
            <View key={i} style={styles.riskBlock}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.badge, badgeStyle(r.severity)]}>{r.severity.toUpperCase()}</Text>
              </View>
              <Text style={styles.riskDescription}>{r.description}</Text>
              {r.mitigation && <Text style={styles.riskMitigation}>Mitigation: {r.mitigation}</Text>}
            </View>
          ))}
        </>
      )}

      {o.next_steps?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Next Steps</Text>
          {o.next_steps.map((s, i) => (
            <Text key={i} style={styles.numberedItem}>{i + 1}. {s}</Text>
          ))}
        </>
      )}
    </>
  );
};

const CompetitiveAnalysisSections: React.FC<{ artifact: CompetitiveAnalysisArtifact }> = ({ artifact }) => {
  const o = artifact.output;
  return (
    <>
      <Text style={styles.sectionTitle}>Market Position</Text>
      <Text style={styles.bodyText}>{o.market_position}</Text>

      <Text style={styles.sectionTitle}>Competitors</Text>
      {o.competitors.map((c, i) => (
        <View key={i} style={styles.competitorCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={styles.competitorName}>{c.name}</Text>
            <Text style={[styles.badge, badgeStyle(c.threat_level), { marginLeft: 8 }]}>
              {c.threat_level.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.competitorDiff}>{c.differentiator}</Text>
          <View style={styles.columnsRow}>
            <View style={styles.column}>
              <Text style={[styles.columnTitle, { color: '#16a34a' }]}>Strengths</Text>
              {c.strengths.map((s, j) => (
                <Text key={j} style={styles.columnItem}>+ {s}</Text>
              ))}
            </View>
            <View style={styles.column}>
              <Text style={[styles.columnTitle, { color: '#dc2626' }]}>Weaknesses</Text>
              {c.weaknesses.map((w, j) => (
                <Text key={j} style={styles.columnItem}>− {w}</Text>
              ))}
            </View>
          </View>
        </View>
      ))}

      {o.strategy_recommendations?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Strategy Recommendations</Text>
          {o.strategy_recommendations.map((r, i) => (
            <Text key={i} style={styles.numberedItem}>{i + 1}. {r}</Text>
          ))}
        </>
      )}
    </>
  );
};

const MeetingPrepSections: React.FC<{ artifact: MeetingPrepArtifact }> = ({ artifact }) => {
  const o = artifact.output;
  return (
    <>
      <Text style={styles.sectionTitle}>Meeting Context</Text>
      <Text style={styles.bodyText}>{o.meeting_context}</Text>

      {o.agenda?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Agenda</Text>
          {o.agenda.map((a, i) => (
            <View key={i} style={styles.agendaRow}>
              <Text style={styles.agendaNum}>{i + 1}.</Text>
              <Text style={styles.agendaTopic}>
                {a.topic}{a.owner ? ` (${a.owner})` : ''}
              </Text>
              <Text style={styles.agendaTime}>{a.duration_minutes} min</Text>
            </View>
          ))}
        </>
      )}

      {o.talking_points?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Talking Points</Text>
          {o.talking_points.map((tp, i) => (
            <Text key={i} style={styles.numberedItem}>{i + 1}. {tp}</Text>
          ))}
        </>
      )}

      {o.objection_handlers?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Objection Handlers</Text>
          {o.objection_handlers.map((oh, i) => (
            <View key={i} style={styles.objectionBlock}>
              <Text style={styles.objectionLabel}>OBJECTION</Text>
              <Text style={styles.bodyText}>{oh.objection}</Text>
              <Text style={styles.responseLabel}>RESPONSE</Text>
              <Text style={styles.bodyText}>{oh.response}</Text>
            </View>
          ))}
        </>
      )}

      {o.key_questions?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Key Questions</Text>
          {o.key_questions.map((q, i) => (
            <Text key={i} style={styles.bulletItem}>? {q}</Text>
          ))}
        </>
      )}

      {o.background_context && (
        <>
          <Text style={styles.sectionTitle}>Background Context</Text>
          <Text style={styles.bodyText}>{o.background_context}</Text>
        </>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Main PDF Document
// ---------------------------------------------------------------------------

interface ArtifactPDFDocumentProps {
  artifact: ArtifactContent;
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  deal_summary: 'Deal Summary',
  competitive_analysis: 'Competitive Analysis',
  meeting_prep: 'Meeting Prep Brief',
};

const ArtifactPDFDocument: React.FC<ArtifactPDFDocumentProps> = ({ artifact }) => {
  const title = artifact.output?.title || ARTIFACT_TYPE_LABELS[artifact.artifact_type] || 'Artifact';
  const dateStr = artifact.generated_at
    ? new Date(artifact.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {ARTIFACT_TYPE_LABELS[artifact.artifact_type]} • Generated {dateStr} • PlexifySOLO
        </Text>

        {artifact.artifact_type === 'deal_summary' && (
          <DealSummarySections artifact={artifact as DealSummaryArtifact} />
        )}
        {artifact.artifact_type === 'competitive_analysis' && (
          <CompetitiveAnalysisSections artifact={artifact as CompetitiveAnalysisArtifact} />
        )}
        {artifact.artifact_type === 'meeting_prep' && (
          <MeetingPrepSections artifact={artifact as MeetingPrepArtifact} />
        )}

        <View style={styles.footer} fixed>
          <Text>PlexifySOLO — Deal Intelligence</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadArtifactPDF(artifact: ArtifactContent): Promise<void> {
  const title = artifact.output?.title || artifact.artifact_type;
  const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').substring(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${safeTitle}-${date}.pdf`;

  const blob = await pdf(<ArtifactPDFDocument artifact={artifact} />).toBlob();
  downloadBlob(blob, filename);
}

export default ArtifactPDFDocument;
