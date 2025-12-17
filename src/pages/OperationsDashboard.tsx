// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertTriangle, Wrench, Calendar, Filter } from 'lucide-react';

type RequestType = 'Security' | 'Maintenance' | 'Events' | 'Other';
type Priority = 'high' | 'medium' | 'low';

interface ServiceRequest {
  id: number;
  type: RequestType;
  priority: Priority;
  title: string;
  location: string;
  timestamp: Date;
  assignedTo: string;
  status: 'New' | 'Dispatched' | 'In Progress' | 'Completed';
  details?: string;
}

interface PatrolMarker {
  id: string;
  x: number; // 0-100 as percentage of width
  y: number; // 0-100 as percentage of height
  label: string;
  type: 'patrol' | 'incident';
}

const nowMinus = (mins: number) => new Date(Date.now() - mins * 60 * 1000);

const initialRequests: ServiceRequest[] = [
  { id: 1, type: 'Security', priority: 'high', title: 'Unattended package reported', location: 'K St NW & 16th St', timestamp: nowMinus(12), assignedTo: 'Unit 3', status: 'In Progress' },
  { id: 2, type: 'Maintenance', priority: 'medium', title: 'Sidewalk damage - trip hazard', location: '1800 block of I St NW', timestamp: nowMinus(65), assignedTo: 'Maintenance Team B', status: 'Dispatched' },
  { id: 3, type: 'Security', priority: 'low', title: 'Wellness check requested', location: 'Connecticut Ave & L St NW', timestamp: nowMinus(5), assignedTo: 'Unit 1', status: 'In Progress' },
  { id: 4, type: 'Events', priority: 'low', title: 'Street performance permit inquiry', location: 'Farragut Square', timestamp: nowMinus(140), assignedTo: 'Events Team', status: 'Completed' },
  { id: 5, type: 'Maintenance', priority: 'medium', title: 'Graffiti reported on utility box', location: '1700 K St NW', timestamp: nowMinus(28), assignedTo: 'Maintenance Team A', status: 'Dispatched' },
  { id: 6, type: 'Security', priority: 'high', title: 'Traffic obstruction - delivery truck', location: '19th St NW & I St', timestamp: nowMinus(9), assignedTo: 'Unit 2', status: 'In Progress' },
  { id: 7, type: 'Other', priority: 'low', title: 'Streetlight flickering', location: 'Pennsylvania Ave NW & 20th St', timestamp: nowMinus(210), assignedTo: 'DC DDOT', status: 'Dispatched' },
  { id: 8, type: 'Events', priority: 'medium', title: 'Stage setup coordination', location: 'Golden Triangle Plaza', timestamp: nowMinus(33), assignedTo: 'Events Team', status: 'In Progress' },
  { id: 9, type: 'Maintenance', priority: 'low', title: 'Litter pickup request', location: 'Connecticut Ave median', timestamp: nowMinus(7), assignedTo: 'Maintenance Team C', status: 'In Progress' },
  { id: 10, type: 'Security', priority: 'medium', title: 'Loitering complaint', location: '1800 Penn Ave NW', timestamp: nowMinus(52), assignedTo: 'Unit 4', status: 'Dispatched' },
];

const patrolMarkers: PatrolMarker[] = [
  { id: 'p1', x: 25, y: 35, label: 'Unit 1', type: 'patrol' },
  { id: 'p2', x: 60, y: 40, label: 'Unit 2', type: 'patrol' },
  { id: 'p3', x: 45, y: 65, label: 'Unit 3', type: 'patrol' },
  { id: 'i1', x: 52, y: 48, label: 'Incident', type: 'incident' },
  { id: 'i2', x: 30, y: 58, label: 'Incident', type: 'incident' },
];

const classNames = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [filter, setFilter] = useState<RequestType | 'All'>('All');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Simulate live timestamps by forcing a re-render every 60s
  useEffect(() => {
    const t = setInterval(() => setRequests(r => [...r]), 60000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    return filter === 'All' ? requests : requests.filter(r => r.type === filter);
  }, [requests, filter]);

  const stat = {
    activeTeams: 15,
    openRequests: requests.filter(r => r.status !== 'Completed').length,
    responseMins: 12,
    todaysActivity: 47,
  };

  const timeAgo = (d: Date) => {
    const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center text-sm text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2 animate-pulse" />
            Live
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <Filter size={16} />
            <div className="flex gap-2">
              {(['All','Security','Maintenance','Events'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t as any)}
                  className={classNames(
                    'px-3 py-1 rounded-full transition-colors',
                    filter === t
                      ? 'bg-primary-100 text-primary-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map + Metrics (span 2) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Map Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Golden Triangle BID â€“ District Map</h2>
                <p className="text-sm text-gray-500">Boundaries: Connecticut Ave â†” 16th St NW, K St â†” Pennsylvania Ave</p>
              </div>
              <div className="hidden md:flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Patrol</span>
                <span className="inline-flex items-center gap-1 text-gray-600"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Incident</span>
              </div>
            </div>
            <div className="relative bg-gradient-to-br from-blue-50 to-blue-100">
              <svg viewBox="0 0 100 70" className="w-full aspect-[100/70]">
                {/* Background grid for subtle map feel */}
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="100" height="70" fill="url(#grid)" />
                {/* Golden Triangle-ish polygon */}
                <polygon points="15,55 30,20 55,10 85,20 80,55 45,60" fill="#bfdbfe" stroke="#1e40af" strokeWidth="1.2" opacity="0.6" />
                {/* Simple patrol routes */}
                <path d="M25,45 L45,30 L70,35" stroke="#3b82f6" strokeWidth="1.2" fill="none" strokeDasharray="2,2" />
                <path d="M35,55 L50,40 L75,50" stroke="#3b82f6" strokeWidth="1.2" fill="none" strokeDasharray="2,2" />
                {/* Markers */}
                {patrolMarkers.map(m => (
                  <g key={m.id} transform={`translate(${m.x}, ${m.y})`}>
                    <circle r={2.2} fill={m.type === 'patrol' ? '#3b82f6' : '#ef4444'} />
                    <text x={3.5} y={2} fontSize={3} fill="#1f2937">{m.label}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs text-gray-500">Active Field Teams</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stat.activeTeams}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs text-gray-500">Open Service Requests</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{stat.openRequests}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs text-gray-500">Avg Response Time</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stat.responseMins} min</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs text-gray-500">Today's Activity</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{stat.todaysActivity}</div>
            </div>
          </div>
        </div>

        {/* Service Request Feed */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Service Request Feed</h2>
              <button
                className="text-sm text-primary-700 hover:text-primary-800 hover:underline"
                onClick={() => setFilter('All')}
              >
                View All
              </button>
            </div>
            <ul className="divide-y divide-gray-100 max-h-[620px] overflow-auto">
              {filtered.map(req => {
                const color = req.priority === 'high' ? 'bg-red-500' : req.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500';
                const icon = req.type === 'Security' ? AlertTriangle : req.type === 'Maintenance' ? Wrench : Calendar;
                const Icon = icon;
                const isExpanded = expandedId === req.id;
                return (
                  <li key={req.id} className="hover:bg-gray-50 transition-colors">
                    <button
                      className="w-full text-left px-4 py-3 flex items-start gap-3"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    >
                      <span className={classNames('w-1.5 h-8 rounded-full mt-0.5', color)} />
                      <span className="mt-0.5"><Icon size={18} className="text-gray-500" /></span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">
                            {req.title}
                          </div>
                          <div className="text-xs text-gray-500">{timeAgo(req.timestamp)}</div>
                        </div>
                        <div className="mt-0.5 text-sm text-gray-600 flex items-center gap-2">
                          <MapPin size={14} />
                          <span>{req.location}</span>
                          <span className="mx-1">â€¢</span>
                          <span className="text-gray-500">{req.type}</span>
                          <span className="mx-1">â€¢</span>
                          <span className="text-gray-500">{req.status}</span>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">Assigned: {req.assignedTo}</span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">Priority: {req.priority}</span>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">ID: #{req.id}</span>
                            </div>
                            <p>
                              {req.details || 'Details: Field coordinator en route. MPD notified if required. Status will update upon resolution.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Ask Plexi integration */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Ask Plexi</h3>
              <button
                className="text-sm text-primary-700 hover:text-primary-800 hover:underline"
                onClick={() => navigate('/ask-plexi')}
              >
                Open Full Assistant â†’
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const fd = new FormData(form);
                const q = String(fd.get('q') || '').trim();
                navigate(q ? `/ask-plexi?q=${encodeURIComponent(q)}` : '/ask-plexi');
              }}
              className="flex gap-2"
            >
              <input
                name="q"
                placeholder="Search district ops, assessments, or incidents..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="submit" className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors">Ask</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;

