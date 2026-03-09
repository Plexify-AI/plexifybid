// @ts-nocheck
/**
 * LegacyProjectCards — Intelligence feed cards from ExecutiveFeed
 *
 * Renders project cards with executive summaries, RFIs, issues, work completed.
 * "View Full Report" opens the workspace editor via useWorkspaceStore.
 *
 * Data source: useReportStore (zustand) → mockDailyReports.
 * CSS classes: project-card, intelligence-card-* (defined in index.css).
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnifiedDailyIntelligence } from '../../types';
import useReportStore from '../../store/reportStore';
import { useWorkspaceStore, type Project } from 'plexify-shared-ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ---------------------------------------------------------------------------
// LegacyProjectCards
// ---------------------------------------------------------------------------

const LegacyProjectCards: React.FC = () => {
  const navigate = useNavigate();
  const executiveReports = useReportStore(state => state.executiveIntelligence);
  const [reports, setReports] = useState<UnifiedDailyIntelligence[]>(executiveReports);

  const openWorkspace = useWorkspaceStore(state => state.openWorkspace);
  const setCurrentProject = useWorkspaceStore(state => state.setCurrentProject);

  useEffect(() => {
    setReports(executiveReports);
  }, [executiveReports]);

  if (reports.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Project Intelligence
      </h2>

      <div className="space-y-6">
        {reports.map(report => (
          <div key={report.id} className="project-card">
            {/* Card Header */}
            <div className="intelligence-card-header">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{report.projectName}</h2>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="mr-2">{report.projectPhase}</span>
                  <span>&bull;</span>
                  <span className="ml-2">{report.superintendent.name}</span>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(report.reportDate)}
              </div>
            </div>

            {/* Card Body */}
            <div className="intelligence-card-body">
              {/* Flags */}
              {Object.entries(report.flags).some(([_, value]) => value) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {report.flags.scheduleImpact && (
                    <span className="status-flag status-flag-schedule">Schedule Impact</span>
                  )}
                  {report.flags.safetyIncident && (
                    <span className="status-flag status-flag-safety">Safety Incident</span>
                  )}
                  {report.flags.ownerNotification && (
                    <span className="status-flag status-flag-owner">Owner Notification</span>
                  )}
                  {report.flags.budgetImpact && (
                    <span className="status-flag status-flag-budget">Budget Impact</span>
                  )}
                  {report.flags.weatherDelay && (
                    <span className="status-flag status-flag-weather">Weather Delay</span>
                  )}
                </div>
              )}

              {/* Executive Summary */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Executive Summary</h3>
                <p className="text-gray-800">
                  {report.narratives.executive.length > 300
                    ? `${report.narratives.executive.substring(0, 300)}...`
                    : report.narratives.executive}
                </p>
              </div>

              {/* Context Items */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* RFIs */}
                {report.context.activeRFIs.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h4 className="text-xs font-medium text-blue-800 uppercase mb-2">Active RFIs</h4>
                    <ul className="space-y-2">
                      {report.context.activeRFIs.slice(0, 2).map(rfi => (
                        <li key={rfi.id} className="text-sm">
                          <span className="font-medium">{rfi.number}:</span> {rfi.title}
                          <div className="text-xs text-blue-600 mt-1">
                            {rfi.status === 'open' ? 'Open' : 'Answered'} &bull; Due: {formatDate(rfi.dateNeeded)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Issues */}
                {report.context.openIssues.length > 0 && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <h4 className="text-xs font-medium text-red-800 uppercase mb-2">Open Issues</h4>
                    <ul className="space-y-2">
                      {report.context.openIssues.slice(0, 2).map(issue => (
                        <li key={issue.id} className="text-sm">
                          <div className="flex items-start">
                            <div className={`w-2 h-2 rounded-full mt-1.5 mr-2 ${
                              issue.priority === 'critical' ? 'bg-red-600' :
                              issue.priority === 'high' ? 'bg-orange-500' :
                              issue.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}></div>
                            <div>
                              <div className="font-medium">{issue.title}</div>
                              <div className="text-xs text-red-600 mt-1">
                                {issue.status} &bull; {issue.priority} priority
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Work Completed */}
                {report.fieldReport.workCompleted.length > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <h4 className="text-xs font-medium text-green-800 uppercase mb-2">Work Completed</h4>
                    <ul className="space-y-2">
                      {report.fieldReport.workCompleted.slice(0, 2).map(work => (
                        <li key={work.id} className="text-sm">
                          <div className="font-medium">{work.description}</div>
                          <div className="text-xs text-green-600 mt-1">
                            {work.location} &bull; {work.status}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer */}
            <div className="intelligence-card-footer flex items-center gap-3">
              <button
                className="btn btn-secondary text-sm"
                onClick={() => navigate('/deal-rooms/a1b2c3d4-e5f6-7890-abcd-ef1234567890')}
              >
                View Deal Room
              </button>
              <button
                className="btn btn-secondary text-sm"
                onClick={() => {
                  const p: Project = {
                    id: report.projectId,
                    name: report.projectName,
                    phase: report.projectPhase,
                    budget: 0,
                    timeline: 'Demo',
                  };
                  setCurrentProject(p);
                  openWorkspace();
                }}
              >
                View Full Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LegacyProjectCards;
