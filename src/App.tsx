// @ts-nocheck
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import NavigationSidebar from './components/NavigationSidebar';
import PlaceholderPage from './components/PlaceholderPage';
import AskPlexiInterface from './components/AskPlexiInterface';
import ExecutiveFeed from './features/executive/ExecutiveFeed';
import FieldView from './features/field/FieldView';
import OperationsDashboard from './pages/OperationsDashboard';
import AssessmentManagement from './pages/AssessmentManagement';
import BoardReporting from './pages/BoardReporting';
import ReportPrintView from './pages/ReportPrintView';
import { bidTheme } from './config/theme';
import { ReportEditorWorkspace, useWorkspaceStore } from 'plexify-shared-ui';

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

const App: React.FC = () => {
  const isOpen = useWorkspaceStore(s => s.isWorkspaceOpen);
  const currentProjectId = useWorkspaceStore(s => s.currentProject?.id);
  const closeWorkspace = useWorkspaceStore(s => s.closeWorkspace);
  const openWorkspace = useWorkspaceStore(s => s.openWorkspace);

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
            <Route path="/ask-plexi" element={<AskPlexiInterface />} />
            <Route path="/upload" element={<PlaceholderPage title="Upload" description="Upload and process district documents with AI." />} />
            <Route path="/library" element={<PlaceholderPage title="Library" description="Access your district document library." />} />
            <Route path="/resources" element={<PlaceholderPage title="Resources" description="BID resources and references." />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" description="Configure your PlexifyBID preferences." />} />
            <Route path="/analytics" element={<PlaceholderPage title="Analytics" description="Advanced initiative analytics and insights." />} />
            <Route path="/report/:projectId/print" element={<ReportPrintView />} />
            <Route path="/alerts" element={<PlaceholderPage title="Alerts" description="Real-time initiative alerts and notifications." />} />
            <Route path="/scorecards" element={<PlaceholderPage title="Scorecards" description="Initiative performance scorecards and KPIs." />} />
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
              />
            </WorkspaceErrorBoundary>
          </div>
        ) : null}

        <button onClick={openWorkspace} className="fixed bottom-4 right-4 z-[9999] bg-blue-600 text-white text-xs px-3 py-2 rounded shadow" style={{ opacity: 0.5 }}>Open WS</button>
        <div className="fixed top-2 right-2 z-[9999] bg-black text-white text-xs px-2 py-1 rounded">WS: {isOpen ? 'open' : 'closed'}</div>
      </div>
    </Router>
  );
};

export default App;