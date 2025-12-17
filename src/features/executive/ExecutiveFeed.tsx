// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnifiedDailyIntelligence } from '../../types';
import useReportStore from '../../store/reportStore';
import AudioPlayer from '../../components/AudioPlayer';

import { useWorkspaceStore, type Project } from 'plexify-shared-ui';
import AudioNarrationService from '../../services/AudioNarrationService';
/**
 * ExecutiveFeed Component
 * 
 * Displays real-time intelligence from construction sites in a feed format
 * designed for executive users to quickly assess project status.
 */
const ExecutiveFeed: React.FC = () => {
  const navigate = useNavigate();
  
  // Pull live executive intelligence from the shared store
  const executiveReports = useReportStore(state => state.executiveIntelligence);

  // Local state (kept so we can continue to simulate real-time updates without
  // mutating the global store in this demo component)
  const [reports, setReports] = useState<UnifiedDailyIntelligence[]>(executiveReports);
  const [filteredReports, setFilteredReports] = useState<UnifiedDailyIntelligence[]>(executiveReports);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [expandedReport, setExpandedReport] = useState<UnifiedDailyIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [audioService] = useState(() => new AudioNarrationService());
  
  const openWorkspace = useWorkspaceStore(state => state.openWorkspace);
  const setCurrentProject = useWorkspaceStore(state => state.setCurrentProject);
  
  // Refresh local reports whenever the store publishes new executive data
  useEffect(() => {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Operations Dashboard: Store updated with', executiveReports.length, 'reports');
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Initiative IDs in reports:', executiveReports.map(r => ({ id: r.projectId, name: r.projectName })));
    setReports(executiveReports);
  }, [executiveReports]);

  // Get unique project IDs for filtering
  const projectIds = Array.from(new Set(executiveReports.map(report => report.projectId)));
  
  // Filter reports based on selected project
  useEffect(() => {
    if (projectFilter === 'all') {
      setFilteredReports(reports);
    } else {
      setFilteredReports(reports.filter(report => report.projectId === projectFilter));
    }
  }, [projectFilter, reports]);
  
  // Simulate real-time updates
  useEffect(() => {
    const simulateRealTimeUpdates = () => {
      // Simulate loading state
      setIsLoading(true);
      
      // Update timestamp
      setLastUpdate(new Date());
      
      // Simulate a delay for the loading state
      setTimeout(() => {
        // Randomly update a report to simulate real-time changes
        const updatedReports = [...reports];
        const randomIndex = Math.floor(Math.random() * updatedReports.length);
        
        // Simulate different types of updates
        const updateTypes = ['narrative', 'flag', 'photo', 'issue'];
        const randomUpdate = updateTypes[Math.floor(Math.random() * updateTypes.length)];
        
        switch (randomUpdate) {
          case 'narrative':
            // Update executive narrative with timestamp
            updatedReports[randomIndex] = {
              ...updatedReports[randomIndex],
              narratives: {
                ...updatedReports[randomIndex].narratives,
                executive: `${updatedReports[randomIndex].narratives.executive} [Updated at ${new Date().toLocaleTimeString()}]`
              }
            };
            break;
          case 'flag':
            // Toggle a random flag
            const flags = ['scheduleImpact', 'safetyIncident', 'ownerNotification', 'budgetImpact', 'weatherDelay'];
            const randomFlag = flags[Math.floor(Math.random() * flags.length)] as keyof typeof updatedReports[0]['flags'];
            
            updatedReports[randomIndex] = {
              ...updatedReports[randomIndex],
              flags: {
                ...updatedReports[randomIndex].flags,
                [randomFlag]: !updatedReports[randomIndex].flags[randomFlag]
              }
            };
            break;
          case 'photo':
            // Simulate a new photo being added
            if (updatedReports[randomIndex].media.photos.length > 0) {
              const newPhoto = {
                ...updatedReports[randomIndex].media.photos[0],
                id: `photo-new-${Date.now()}`,
                dateTime: new Date(),
                caption: `New site progress photo [${new Date().toLocaleTimeString()}]`
              };
              
              updatedReports[randomIndex] = {
                ...updatedReports[randomIndex],
                media: {
                  ...updatedReports[randomIndex].media,
                  photos: [newPhoto, ...updatedReports[randomIndex].media.photos]
                }
              };
            }
            break;
          case 'issue':
            // Simulate an issue status change
            if (updatedReports[randomIndex].context.openIssues.length > 0) {
              const issueIndex = 0;
              const updatedIssues = [...updatedReports[randomIndex].context.openIssues];
              
              updatedIssues[issueIndex] = {
                ...updatedIssues[issueIndex],
                status: updatedIssues[issueIndex].status === 'open' ? 'in-progress' : 'open',
                priority: updatedIssues[issueIndex].priority === 'high' ? 'critical' : 'high'
              };
              
              updatedReports[randomIndex] = {
                ...updatedReports[randomIndex],
                context: {
                  ...updatedReports[randomIndex].context,
                  openIssues: updatedIssues
                }
              };
            }
            break;
        }
        
        setReports(updatedReports);
        setIsLoading(false);
      }, 1500);
    };
    
    // Set up periodic updates every 30 seconds
    const intervalId = setInterval(simulateRealTimeUpdates, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [reports]);
  
  // Handle expanding a report
  const handleExpandReport = useCallback((report: UnifiedDailyIntelligence) => {
    setExpandedReport(report);
  }, []);
  
  // Handle closing expanded report
  const handleCloseExpandedReport = useCallback(() => {
    setExpandedReport(null);
  }, []);
  
  // Handle project filter change
  const handleProjectFilterChange = useCallback((projectId: string) => {
    setProjectFilter(projectId);
  }, []);
  
  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Count total flags across all filtered reports
  const countTotalFlags = useCallback(() => {
    return filteredReports.reduce((total, report) => {
      const flags = report.flags;
      return total + Object.values(flags).filter(Boolean).length;
    }, 0);
  }, [filteredReports]);
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header with status */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Operations Dashboard</h1>
          <div className="flex items-center mt-2 md:mt-0 gap-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isLoading ? 'Updating...' : 'Live'}
              </span>
            </div>
            <button
              onClick={() => navigate('/field')}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Field Report</span>
            </button>
            <div className="text-sm text-gray-500">
              Last updated: {formatDate(lastUpdate)}
            </div>
          </div>
        </div>
        
        {/* Initiative filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Filter by initiative:</span>
          <button
            className={`px-3 py-1 text-sm rounded-full ${
              projectFilter === 'all'
                ? 'bg-primary-100 text-primary-800 font-medium'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => handleProjectFilterChange('all')}
          >
            All Initiatives
          </button>
          {projectIds.map(id => (
            <button
              key={id}
              className={`px-3 py-1 text-sm rounded-full ${
                projectFilter === id 
                  ? 'bg-primary-100 text-primary-800 font-medium' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => handleProjectFilterChange(id)}
            >
              {reports.find(r => r.projectId === id)?.projectName || id}
            </button>
          ))}
        </div>
        
        {/* Status summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{filteredReports.length}</div>
              <div className="text-sm text-gray-600">Active Initiatives</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {filteredReports.filter(r => r.flags.scheduleImpact).length}
              </div>
              <div className="text-sm text-gray-600">Schedule Impacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredReports.filter(r => r.flags.safetyIncident).length}
              </div>
              <div className="text-sm text-gray-600">Safety Incidents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {countTotalFlags()}
              </div>
              <div className="text-sm text-gray-600">Total Flags</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Intelligence Feed */}
      <div className="space-y-6">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No reports match your filter criteria.</p>
          </div>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} className="intelligence-card">
              {/* Card Header */}
              <div className="intelligence-card-header">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{report.projectName}</h2>
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="mr-2">{report.projectPhase}</span>
                    <span>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</span>
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
                              {rfi.status === 'open' ? 'Open' : 'Answered'} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Due: {formatDate(rfi.dateNeeded)}
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
                                  {issue.status} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {issue.priority} priority
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
                              {work.location} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {work.status}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Card Footer */}
              <div className="intelligence-card-footer">
                <button 
                  className="btn btn-secondary text-sm"
                  onClick={() => { const p: Project = { id: report.projectId, name: report.projectName, phase: report.projectPhase, budget: 0, timeline: "Demo" }; setCurrentProject(p); openWorkspace(); }}
                >
                  View Full Report
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Expanded Report Modal */}
      {expandedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            {/* Audio Player Header */}
            <AudioPlayer report={expandedReport} audioService={audioService} />
            
            <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">{expandedReport.projectName}</h2>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={handleCloseExpandedReport}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Project Info */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                    {expandedReport.projectPhase}
                  </div>
                  <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                    {formatDate(expandedReport.reportDate)}
                  </div>
                  <div className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                    Superintendent: {expandedReport.superintendent.name}
                  </div>
                </div>
                
                {/* Flags */}
                {Object.entries(expandedReport.flags).some(([_, value]) => value) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {expandedReport.flags.scheduleImpact && (
                      <span className="status-flag status-flag-schedule">Schedule Impact</span>
                    )}
                    {expandedReport.flags.safetyIncident && (
                      <span className="status-flag status-flag-safety">Safety Incident</span>
                    )}
                    {expandedReport.flags.ownerNotification && (
                      <span className="status-flag status-flag-owner">Owner Notification</span>
                    )}
                    {expandedReport.flags.budgetImpact && (
                      <span className="status-flag status-flag-budget">Budget Impact</span>
                    )}
                    {expandedReport.flags.weatherDelay && (
                      <span className="status-flag status-flag-weather">Weather Delay</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Narratives */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Narratives</h3>
                
                <div className="space-y-6">
                  {/* Executive Narrative */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-2">Executive Summary</h4>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-gray-800 whitespace-pre-line">{expandedReport.narratives.executive}</p>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-xs text-gray-600">
                          [Updated at {formatDate(lastUpdate).split(', ')[1]}]
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Technical Narrative */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-2">Technical Details</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-800 whitespace-pre-line">{expandedReport.narratives.technical}</p>
                    </div>
                  </div>
                  
                  {/* Owner Narrative */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-2">Owner Update</h4>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-gray-800 whitespace-pre-line">{expandedReport.narratives.owner}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Photos - Show only latest 3 photos */}
              {expandedReport.media.photos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Site Photos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {expandedReport.media.photos
                      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
                      .slice(0, 3)
                      .map(photo => (
                      <div key={photo.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-100 h-40 flex items-center justify-center">
                          {/* Placeholder for actual image */}
                          <div className="text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium">{photo.caption}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(photo.dateTime)} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ {photo.location}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Issues and RFIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Issues */}
                {expandedReport.context.openIssues.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Open Issues</h3>
                    <div className="space-y-4">
                      {expandedReport.context.openIssues.map(issue => (
                        <div key={issue.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <div className={`w-3 h-3 rounded-full mt-1.5 mr-2 ${
                              issue.priority === 'critical' ? 'bg-red-600' : 
                              issue.priority === 'high' ? 'bg-orange-500' : 
                              issue.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}></div>
                            <div className="flex-1">
                              <h4 className="text-md font-medium">{issue.title}</h4>
                              <p className="text-sm text-gray-700 mt-1">{issue.description}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  Status: {issue.status}
                                </span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  Priority: {issue.priority}
                                </span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                  Created: {formatDate(issue.createdDate)}
                                </span>
                              </div>
                              {issue.resolution && (
                                <div className="mt-2 text-sm">
                                  <span className="font-medium">Resolution:</span> {issue.resolution}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* RFIs */}
                {expandedReport.context.activeRFIs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Active RFIs</h3>
                    <div className="space-y-4">
                      {expandedReport.context.activeRFIs.map(rfi => (
                        <div key={rfi.id} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="text-md font-medium">{rfi.number}: {rfi.title}</h4>
                          <p className="text-sm text-gray-700 mt-1">{rfi.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              Status: {rfi.status}
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              Submitted: {formatDate(rfi.dateSubmitted)}
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              Needed by: {formatDate(rfi.dateNeeded)}
                            </span>
                          </div>
                          {rfi.response && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                              <span className="font-medium">Response:</span> {rfi.response}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Work Completed */}
              {expandedReport.fieldReport.workCompleted.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Work Completed</h3>
                  <div className="space-y-4">
                    {expandedReport.fieldReport.workCompleted.map(work => (
                      <div key={work.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-md font-medium">{work.description}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Location:</span> {work.location}
                            </p>
                            {work.quantity && work.unit && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Quantity:</span> {work.quantity} {work.unit}
                              </p>
                            )}
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Status:</span> {work.status}
                            </p>
                          </div>
                          <div>
                            {work.trades && work.trades.length > 0 && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Trades:</span> {work.trades.join(', ')}
                              </p>
                            )}
                            {work.equipment && work.equipment.length > 0 && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Equipment:</span> {work.equipment.join(', ')}
                              </p>
                            )}
                            {work.materials && work.materials.length > 0 && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Materials:</span> {work.materials.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        {work.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                            <span className="font-medium">Notes:</span> {work.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Safety Observations */}
              {expandedReport.fieldReport.safetyObservations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Safety Observations</h3>
                  <div className="space-y-4">
                    {expandedReport.fieldReport.safetyObservations.map(safety => (
                      <div key={safety.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className={`w-3 h-3 rounded-full mt-1.5 mr-2 ${
                            safety.type === 'incident' ? 'bg-red-600' : 
                            safety.type === 'near-miss' ? 'bg-orange-500' : 
                            safety.type === 'violation' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                          <div className="flex-1">
                            <h4 className="text-md font-medium capitalize">{safety.type}: {safety.description}</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                Location: {safety.location}
                              </span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                Time: {formatDate(safety.dateTime)}
                              </span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                Severity: {safety.severity}
                              </span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                Status: {safety.status}
                              </span>
                            </div>
                            {safety.correctiveAction && (
                              <div className="mt-2 text-sm">
                                <span className="font-medium">Corrective Action:</span> {safety.correctiveAction}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="sticky bottom-0 bg-white p-4 border-t border-gray-200 flex justify-end">
              <button 
                className="btn btn-primary"
                onClick={handleCloseExpandedReport}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveFeed;


