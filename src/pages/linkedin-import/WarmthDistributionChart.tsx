/**
 * Warmth Distribution — horizontal stacked bar chart
 *
 * Brand colors: Hot=#EF4444, Strong=#8B5CF6, Warm=#10B981, Cold=#6B7280
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import type { WarmthDistribution } from './LinkedInImport.types';

interface WarmthDistributionChartProps {
  data: WarmthDistribution;
}

const WARMTH_COLORS: Record<string, string> = {
  hot: '#EF4444',
  strong: '#8B5CF6',
  warm: '#10B981',
  cold: '#6B7280',
};

const WARMTH_LABELS: Record<string, string> = {
  hot: 'Hot',
  strong: 'Strong',
  warm: 'Warm',
  cold: 'Cold',
};

export function WarmthDistributionChart({ data }: WarmthDistributionChartProps) {
  // Build stacked data — single row with all warmth tiers
  const chartData = [
    {
      name: 'Warmth',
      hot: data.hot || 0,
      strong: data.strong || 0,
      warm: data.warm || 0,
      cold: data.cold || 0,
    },
  ];

  const total = (data.hot || 0) + (data.strong || 0) + (data.warm || 0) + (data.cold || 0);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-3">Warmth Distribution</h4>
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={chartData} layout="vertical" barSize={28}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            cursor={false}
            contentStyle={{
              background: '#1F2937',
              border: '1px solid rgba(107,114,128,0.3)',
              borderRadius: '8px',
              color: '#E5E7EB',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => {
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return [`${value.toLocaleString()} (${pct}%)`, WARMTH_LABELS[name] || name];
            }}
          />
          {Object.keys(WARMTH_COLORS).map((key) => (
            <Bar key={key} dataKey={key} stackId="warmth" fill={WARMTH_COLORS[key]} radius={0} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend with counts */}
      <div className="flex flex-wrap gap-4 mt-3">
        {Object.entries(WARMTH_COLORS).map(([key, color]) => {
          const count = (data as any)[key] || 0;
          if (count === 0 && key === 'hot') return null; // Hide hot if 0
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-gray-400">{WARMTH_LABELS[key]}</span>
              <span className="text-gray-300 font-medium">{count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
