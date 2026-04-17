/**
 * HomePage — Sprint 2 Home screen
 *
 * Command-bar-first interface that replaces pyramid-centric Home.
 * Composes: CommandBar + ActivityFeed + HomeOpportunityCards + LegacyProjectCards.
 *
 * Background: transparent — inherits .main-content background-image.
 * Answers one question: "What revenue move happens next?"
 */

import React from 'react';
import CommandBar from './CommandBar';
import ActivityFeed from './ActivityFeed';
import HomeOpportunityCards from './HomeOpportunityCards';
import LegacyProjectCards from './LegacyProjectCards';
import JobActivity from '../../components/JobActivity';
import UsageWidget from '../../components/UsageWidget';

const HomePage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Command Bar — greeting + input + chips */}
        <CommandBar />

        {/* Activity Feed — compact text lines */}
        <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-5">
          <ActivityFeed />
        </div>

        {/* PlexiCoS Activity (live via SSE since E4) */}
        <JobActivity />

        {/* Usage widget — per-worker spend with Research Scanner cap bar */}
        <UsageWidget />

        {/* Hot Opportunity Cards — promoted + warm */}
        <div>
          <HomeOpportunityCards />
        </div>
      </div>

      {/* Legacy Project Cards — full width, below narrow column */}
      <div className="mt-8">
        <LegacyProjectCards />
      </div>
    </div>
  );
};

export default HomePage;
