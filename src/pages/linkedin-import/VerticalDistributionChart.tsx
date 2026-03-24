/**
 * Vertical Distribution — horizontal bar chart sorted by count descending
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface VerticalDistributionChartProps {
  data: Record<string, number>;
}

// Cycle through brand colors for bars
const BAR_COLORS = ['#10B981', '#8B5CF6', '#F59E0B', '#6B2FD9', '#EF4444', '#3B82F6', '#6B7280'];

export function VerticalDistributionChart({ data }: VerticalDistributionChartProps) {
  const chartData = Object.entries(data)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (chartData.length === 0) return null;

  const barHeight = 28;
  const chartHeight = Math.max(chartData.length * (barHeight + 8) + 20, 100);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-3">Vertical Distribution</h4>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" barSize={barHeight - 4} margin={{ left: 0, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(107,114,128,0.1)' }}
            contentStyle={{
              background: '#1F2937',
              border: '1px solid rgba(107,114,128,0.3)',
              borderRadius: '8px',
              color: '#E5E7EB',
              fontSize: '12px',
            }}
            formatter={(value: number) => [value.toLocaleString(), 'Contacts']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
