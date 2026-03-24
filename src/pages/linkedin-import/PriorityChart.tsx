/**
 * Priority Tiers — donut chart
 *
 * Brand colors: P0=#10B981, P1=#8B5CF6, P2=#F59E0B, P3=#6B7280
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface PriorityChartProps {
  data: Record<string, number>;
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#10B981',
  P1: '#8B5CF6',
  P2: '#F59E0B',
  P3: '#6B7280',
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: 'P0 — Highest',
  P1: 'P1 — High',
  P2: 'P2 — Medium',
  P3: 'P3 — Low',
};

export function PriorityChart({ data }: PriorityChartProps) {
  const chartData = Object.entries(PRIORITY_COLORS)
    .map(([key]) => ({
      name: key,
      label: PRIORITY_LABELS[key] || key,
      value: data[key] || 0,
    }))
    .filter(d => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-300 mb-3">Priority Tiers</h4>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#6B7280'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1F2937',
                border: '1px solid rgba(107,114,128,0.3)',
                borderRadius: '8px',
                color: '#E5E7EB',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return [`${value.toLocaleString()} (${pct}%)`, PRIORITY_LABELS[name] || name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-col gap-2">
          {Object.entries(PRIORITY_COLORS).map(([key, color]) => {
            const count = data[key] || 0;
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-gray-400 w-10">{key}</span>
                <span className="text-gray-300 font-medium">{count.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
