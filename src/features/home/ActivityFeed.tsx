/**
 * ActivityFeed — Recent pipeline activity as compact text lines
 *
 * Shows last 10 events across all tenant opportunities.
 * Dot colors: green (positive), orange (neutral), red (risk/decay).
 * No click interaction Sprint 2 (Sprint 3: click to navigate).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSandbox } from '../../contexts/SandboxContext';

interface FeedEvent {
  id: string;
  event_type: string;
  payload?: any;
  created_at: string;
  opportunity_id: string;
  account_name: string;
  warmth_score: number;
}

// ---------------------------------------------------------------------------
// Event description formatter
// ---------------------------------------------------------------------------

function formatEventDescription(event: FeedEvent): string {
  const account = event.account_name;

  switch (event.event_type) {
    case 'MEETING_BOOKED':
      return `${account} — Meeting booked`;
    case 'MEETING_COMPLETED':
      return `${account} — Meeting completed`;
    case 'OUTREACH_SENT':
      return `${account} — Outreach email sent`;
    case 'OUTREACH_OPENED':
      return `${account} — Opened your email`;
    case 'OUTREACH_CLICKED':
      return `${account} — Clicked your link`;
    case 'OUTREACH_REPLIED': {
      const positive = event.payload?.sentiment === 'positive';
      return `${account} — Replied${positive ? ' positively' : ''}`;
    }
    case 'PROPOSAL_SENT':
      return `${account} — Proposal sent`;
    case 'SIGNAL_LOGGED':
      return `${account} — ${event.payload?.description || event.payload?.note || 'Signal logged'}`;
    case 'DEAL_WON':
      return `${account} — Deal won!`;
    case 'DEAL_LOST':
      return `${account} — Deal lost`;
    default:
      return `${account} — ${event.event_type.replace(/_/g, ' ').toLowerCase()}`;
  }
}

// ---------------------------------------------------------------------------
// Dot color logic
// ---------------------------------------------------------------------------

type DotColor = 'green' | 'orange' | 'red';

function getDotColor(event: FeedEvent): DotColor {
  // Red: explicit bad outcomes or very low warmth
  if (event.event_type === 'DEAL_LOST') return 'red';
  if (event.warmth_score < 20) return 'red';

  // Green: positive signals
  const greenTypes = [
    'MEETING_BOOKED',
    'MEETING_COMPLETED',
    'PROPOSAL_SENT',
    'DEAL_WON',
  ];
  if (greenTypes.includes(event.event_type)) return 'green';
  if (event.event_type === 'OUTREACH_REPLIED' && event.payload?.sentiment === 'positive') return 'green';

  // Orange: neutral / informational
  return 'orange';
}

const DOT_CLASSES: Record<DotColor, string> = {
  green: 'bg-green-400',
  orange: 'bg-amber-400',
  red: 'bg-red-400',
};

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return 'last week';
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-2.5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
          <div className="h-3.5 bg-gray-700/50 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityFeed component
// ---------------------------------------------------------------------------

const ActivityFeed: React.FC = () => {
  const { token } = useSandbox();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch('/api/activity-feed?limit=10', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      console.error('[ActivityFeed] Error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  if (loading) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>
        <ActivityFeedSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>
        <p className="text-xs text-gray-500">Unable to load activity</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>
        <p className="text-xs text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h2>
      <div className="space-y-2">
        {events.map((event) => {
          const dotColor = getDotColor(event);
          const description = formatEventDescription(event);
          const timeAgo = formatRelativeTime(event.created_at);

          return (
            <div key={event.id} className="flex items-center gap-2.5 text-sm">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_CLASSES[dotColor]}`} />
              <span className="text-gray-300 truncate">{description}</span>
              <span className="text-gray-600 text-xs whitespace-nowrap ml-auto flex-shrink-0">
                {timeAgo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
