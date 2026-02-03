// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import NavigationSidebar from './components/NavigationSidebar';
import PlaceholderPage from './components/PlaceholderPage';
import AskPlexiInterface from './components/AskPlexiInterface';
import ExecutiveFeed from './features/executive/ExecutiveFeed';
import FieldView from './features/field/FieldView';
import { PlaceGraph } from './features/ecosystem';
import { AgentManagement } from './features/agent-management/AgentManagement';
import { AgentGrid, AgentDetail } from './features/agent-management/components/AgentRegistry';
import { SessionList, SessionStartForm, SessionDetail } from './features/agent-management/components/SessionTracker';
import { TemplateListPlaceholder, TemplateEditorPlaceholder } from './features/agent-management/components/PromptTemplates';
import OperationsDashboard from './pages/OperationsDashboard';
import AssessmentManagement from './pages/AssessmentManagement';
import BoardReporting from './pages/BoardReporting';
import ReportPrintView from './pages/ReportPrintView';
import IntegrationsPage from './pages/IntegrationsPage';
import { bidTheme } from './config/theme';
import { ReportEditorWorkspace, useWorkspaceStore } from 'plexify-shared-ui';
import { RealDocsProvider, useRealDocs } from './contexts/RealDocsContext';
import SourcesPanel from './components/SourcesPanel';
import {
  loadNotebookBDSources,
  notebookbdAnswer,
  type NotebookBDSourceDoc,
} from './services/notebookbdRag';
import { runNotebookBDAgent } from './services/agentService';
import { exportStructuredOutput, exportBoardReportDocx } from './services/exportService';
import { generateAudioFromContent } from './services/audioService';
import { generatePodcast } from './services/podcastService';
import BoardBriefRenderer from './components/BoardBriefRenderer';
import AssessmentTrendsRenderer from './components/AssessmentTrendsRenderer';
import OZRFSectionRenderer from './components/OZRFSectionRenderer';
import PodcastPlayerWidget from './components/PodcastPlayerWidget';

// Agent Management route wrappers
function SessionListWrapper() {
  const navigate = useNavigate();
  return (
    <SessionList
      onSessionClick={(id) => navigate(`/agents/sessions/${id}`)}
      onStartSession={() => navigate('/agents/sessions/new')}
    />
  );
}

function SessionStartFormWrapper() {
  const navigate = useNavigate();
  return (
    <SessionStartForm
      onBack={() => navigate('/agents/sessions')}
      onSessionStarted={(id) => navigate(`/agents/sessions/${id}`)}
    />
  );
}

function SessionDetailWrapper() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <SessionDetail
      sessionId={id}
      onBack={() => navigate('/agents/sessions')}
      onCompleted={() => navigate('/agents/sessions')}
    />
  );
}

function AgentDetailWrapper() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return null;
  return (
    <AgentDetail
      slug={slug}
      onBack={() => navigate('/agents')}
    />
  );
}

function AgentGridWrapper() {
  const navigate = useNavigate();
  return (
    <AgentGrid
      onAgentClick={(slug) => navigate(`/agents/${slug}`)}
      onNewAgent={() => navigate('/agents/new')}
    />
  );
}

class WorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: unknown }
> {
  state = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    // Ensure we still get a visible error even if the workspace crashes during render.
    // eslint-disable-next-line no-console
    console.error('Workspace crashed:', error);
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error);
      const stack =
        this.state.error instanceof Error ? this.state.error.stack : undefined;

      return (
        <div className="fixed inset-0 z-[9999] bg-white p-6 overflow-auto">
          <h2 className="text-lg font-semibold text-red-700">
            Workspace failed to render
          </h2>
          <p className="mt-2 text-sm text-gray-700">{message}</p>
          {stack ? (
            <pre className="mt-4 text-xs text-gray-800 whitespace-pre-wrap">{stack}</pre>
          ) : null}
        </div>
      );
    }

    return this.props.children;
  }
}

const AppBody: React.FC = () => {
  const isOpen = useWorkspaceStore(s => s.isWorkspaceOpen);
  const currentProjectId = useWorkspaceStore(s => s.currentProject?.id);
  const closeWorkspace = useWorkspaceStore(s => s.closeWorkspace);

  const { state: realDocsState } = useRealDocs();

  const [notebookDocs, setNotebookDocs] = useState<NotebookBDSourceDoc[]>([]);
  const [audioBriefing, setAudioBriefing] = useState(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [latestBoardBrief, setLatestBoardBrief] = useState(null);
  const [podcast, setPodcast] = useState(null);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  useEffect(() => {
    loadNotebookBDSources()
      .then(setNotebookDocs)
      .catch((err) => console.error('Failed to load NotebookBD demo sources:', err));
  }, []);

  const sourceMaterials = useMemo(
    () => notebookDocs.map((d) => d.material),
    [notebookDocs]
  );

  const handleSourceMaterialsChange = (materials) => {
    setNotebookDocs((prev) => {
      const nextById = new Map(materials.map((m) => [m.id, m]));
      return prev.map((d) => ({
        ...d,
        material: nextById.get(d.material.id) ?? d.material,
      }));
    });
  };

  const handleAIMessage = async (message: string) => {
    return notebookbdAnswer({ query: message, docs: notebookDocs });
  };

  const handleRunAgent = async (
    agentId: string,
    args: { projectId: string; documentIds: string[] }
  ) => {
    const result = await runNotebookBDAgent(agentId as any, {
      projectId: 'golden-triangle',
      documentIds: args.documentIds,
    });

    if (result?.agentId === 'board-brief') {
      setLatestBoardBrief(result);
    }

    return result;
  };

  const handleExportStructuredOutput = async (
    data: unknown,
    format: 'docx' | 'pdf'
  ) => {
    await exportStructuredOutput(data, format);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const boardBriefToTtsContent = (brief) => {
    const o = brief.output;
    const subtitle = [o.districtName, o.reportingPeriod].filter(Boolean).join(' • ');
    return {
      title: o.title,
      subtitle: subtitle || undefined,
      sections: [
        { heading: 'Executive Summary', items: o.executiveSummary },
        {
          heading: 'Key Metrics',
          items: o.keyMetrics.map((m) => `${m.label}: ${m.value}`),
        },
        { heading: 'Highlights', items: o.highlights },
        { heading: 'Risks', items: o.risks },
        { heading: 'Recommendations', items: o.recommendations },
      ],
    };
  };

  const boardBriefToDocxContent = (brief) => {
    const o = brief.output;
    const subtitle = [o.districtName, o.reportingPeriod].filter(Boolean).join(' • ');
    return {
      title: o.title,
      subtitle: subtitle || undefined,
      sections: [
        { heading: 'Executive Summary', items: o.executiveSummary },
        { heading: 'Key Metrics', metrics: o.keyMetrics },
        { heading: 'Highlights', items: o.highlights },
        { heading: 'Risks', items: o.risks },
        { heading: 'Recommendations', items: o.recommendations },
      ],
      citations: Array.isArray(brief.sourcesUsed)
        ? brief.sourcesUsed.map((s) => ({ source: s.label || s.id }))
        : undefined,
    };
  };

  const handleExportDocx = async (editorHtml: string) => {
    if (isExportingDocx) return;

    const hasNotes = Boolean(editorHtml && editorHtml.trim());
    const hasBrief = Boolean(latestBoardBrief);
    if (!hasNotes && !hasBrief) {
      alert('Nothing to export yet. Generate a Board Brief or add notes in the editor.');
      return;
    }

    setIsExportingDocx(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await exportBoardReportDocx({
        boardBrief: latestBoardBrief ? boardBriefToDocxContent(latestBoardBrief) : null,
        editorContent: hasNotes ? editorHtml : null,
        filename: `board-report-${date}`,
      });
    } catch (err) {
      console.error('DOCX export failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to export DOCX');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleGenerateBoardBriefAudio = async (brief) => {
    if (isGeneratingAudio) return;
    setIsGeneratingAudio(true);
    try {
      const content = boardBriefToTtsContent(brief);
      const outputId = `board-brief-${brief.generatedAt}`;
      const result = await generateAudioFromContent(content, outputId);
      setAudioBriefing(result);
    } catch (err) {
      console.error('Audio generation failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate audio briefing');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateFromLatestBoardBrief = async () => {
    if (!latestBoardBrief) return;
    await handleGenerateBoardBriefAudio(latestBoardBrief);
  };

  const handleGeneratePodcast = async () => {
    if (isGeneratingPodcast) return;
    const documentIds = realDocsState.selectedDocuments ?? [];
    if (!documentIds.length) {
      alert('Select at least one document to generate a Deep Dive Podcast.');
      return;
    }

    setIsGeneratingPodcast(true);
    try {
      const result = await generatePodcast(documentIds, 'golden-triangle');
      setPodcast(result);
    } catch (err) {
      console.error('Podcast generation failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate podcast');
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const renderStructuredOutputBlock = (block) => {
    const data = block?.data;
    if (data?.agentId === 'board-brief') {
      return (
        <BoardBriefRenderer
          brief={data}
          onGenerateAudio={handleGenerateBoardBriefAudio}
          isGeneratingAudio={isGeneratingAudio}
          hasAudio={Boolean(audioBriefing?.audioUrl)}
        />
      );
    }

    if (data?.agentId === 'assessment-trends') {
      return <AssessmentTrendsRenderer trends={data} />;
    }

    if (data?.agentId === 'ozrf-section') {
      return <OZRFSectionRenderer section={data} />;
    }

    return (
      <div className="text-sm text-slate-500">
        Unsupported structured output.
      </div>
    );
  };

  return (
    <Router>
      <div className="app-container">
        <NavigationSidebar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<ExecutiveFeed />} />
              <Route path="/operations" element={<OperationsDashboard />} />
              <Route path="/assessments" element={<AssessmentManagement />} />
              <Route path="/board-reports" element={<BoardReporting />} />
              <Route path="/executive" element={<ExecutiveFeed />} />
              <Route path="/field" element={<FieldView />} />
              <Route path="/ecosystem" element={<PlaceGraph />} />
              <Route path="/agents" element={<AgentManagement />}>
                <Route index element={<AgentGridWrapper />} />
                <Route path=":slug" element={<AgentDetailWrapper />} />
                <Route path="templates" element={<TemplateListPlaceholder />} />
                <Route path="templates/:slug" element={<TemplateEditorPlaceholder />} />
                <Route path="sessions" element={<SessionListWrapper />} />
                <Route path="sessions/new" element={<SessionStartFormWrapper />} />
                <Route path="sessions/:id" element={<SessionDetailWrapper />} />
              </Route>
              <Route path="/ask-plexi" element={<AskPlexiInterface />} />
              <Route
                path="/upload"
                element={
                  <PlaceholderPage
                    title="Upload"
                    description="Upload and process district documents with AI."
                  />
                }
              />
              <Route
                path="/library"
                element={
                  <PlaceholderPage
                    title="Library"
                    description="Access your district document library."
                  />
                }
              />
              <Route
                path="/resources"
                element={
                  <PlaceholderPage
                    title="Resources"
                    description="BID resources and references."
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <PlaceholderPage
                    title="Settings"
                    description="Configure your PlexifyBID preferences."
                  />
                }
              />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route
                path="/analytics"
                element={
                  <PlaceholderPage
                    title="Analytics"
                    description="Advanced initiative analytics and insights."
                  />
                }
              />
              <Route path="/report/:projectId/print" element={<ReportPrintView />} />
              <Route
                path="/alerts"
                element={
                  <PlaceholderPage
                    title="Alerts"
                    description="Real-time initiative alerts and notifications."
                  />
                }
              />
              <Route
                path="/scorecards"
                element={
                  <PlaceholderPage
                    title="Scorecards"
                    description="Initiative performance scorecards and KPIs."
                  />
                }
              />
            </Routes>
          </main>

        {isOpen ? (
          <div className="fixed inset-0 z-[9999]">
            <WorkspaceErrorBoundary>
              <ReportEditorWorkspace
                isOpen={true}
                projectId={currentProjectId || 'project-001'}
                onClose={closeWorkspace}
                theme={bidTheme}
                terminology="bid"
                sourceMaterials={sourceMaterials}
                onSourceMaterialsChange={handleSourceMaterialsChange}
                onAIMessage={handleAIMessage}
                onRunAgent={handleRunAgent}
                onExportStructuredOutput={handleExportStructuredOutput}
                renderStructuredOutputBlock={renderStructuredOutputBlock}
                renderSourcesPanel={<SourcesPanel />}
                selectedDocumentIds={realDocsState.selectedDocuments}
                audioUrl={audioBriefing?.audioUrl}
                audioDuration={
                  audioBriefing ? formatTime(audioBriefing.totalDuration) : undefined
                }
                audioChapters={
                  audioBriefing
                    ? audioBriefing.chapters.map((c) => ({
                        label: c.title,
                        timestamp: c.startTime,
                      }))
                    : []
                }
                audioIsGenerating={isGeneratingAudio}
                audioCanGenerate={Boolean(latestBoardBrief)}
                onGenerateAudioBriefing={handleGenerateFromLatestBoardBrief}
                podcastCanGenerate={Boolean(realDocsState.selectedDocuments?.length)}
                podcastHasContent={Boolean(podcast?.podcastUrl)}
                podcastIsGenerating={isGeneratingPodcast}
                onGeneratePodcast={handleGeneratePodcast}
                renderPodcastPlayer={
                  <PodcastPlayerWidget podcast={podcast} isGenerating={isGeneratingPodcast} />
                }
                onExportDocx={handleExportDocx}
                exportDocxBusy={isExportingDocx}
              />
            </WorkspaceErrorBoundary>
          </div>
        ) : null}
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <RealDocsProvider>
      <AppBody />
    </RealDocsProvider>
  );
};

export default App;