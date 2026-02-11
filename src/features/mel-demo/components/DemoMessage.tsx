import { AgentIndicator } from './AgentIndicator';
import { ProspectCard } from './ProspectCard';
import { EmailPreview } from './EmailPreview';
import { WinProbabilityCard } from './WinProbabilityCard';
import type { DemoMessage as DemoMessageType } from '../MelDemo.types';

interface DemoMessageProps {
  message: DemoMessageType;
}

export function DemoMessage({ message }: DemoMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-md px-4 py-2.5 bg-primary-600 text-white text-sm rounded-2xl rounded-br-md shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-2xl w-full space-y-2">
        {message.agent && <AgentIndicator agent={message.agent} />}

        {/* Text content */}
        {message.text && (
          <div className="px-4 py-2.5 bg-white text-gray-800 text-sm rounded-2xl rounded-bl-md border border-gray-200 shadow-sm">
            {message.text}
          </div>
        )}

        {/* Prospect Query Response */}
        {message.contentType === 'prospect-query' && message.prospectQueryResponse && (
          <div className="space-y-3">
            <div className="px-4 py-2.5 bg-white text-sm text-gray-800 rounded-2xl rounded-bl-md border border-gray-200 shadow-sm">
              <span className="font-semibold">{message.prospectQueryResponse.totalMatches} projects</span> match your criteria.
              <span className="block mt-1 text-gray-500">Top 3 by warmth score:</span>
            </div>
            {message.prospectQueryResponse.topProspects.map((prospect, i) => (
              <ProspectCard key={prospect.project.id} prospect={prospect} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Outreach Response */}
        {message.contentType === 'outreach' && message.outreachResponse && (
          <EmailPreview data={message.outreachResponse} />
        )}

        {/* Win Probability Response */}
        {message.contentType === 'win-probability' && message.winProbabilityResponse && (
          <WinProbabilityCard data={message.winProbabilityResponse} />
        )}
      </div>
    </div>
  );
}
