// @ts-nocheck
import React, { useMemo, useState } from 'react';

type Period = 'Q3 2025' | 'Q4 2025' | 'Year to Date';

const boardMetrics = {
  q3: {
    safetyIncidents: 23,
    revenue: 7900000,
    expenses: 7650000,
    serviceRequests: 892,
    events: 42,
    attendance: 11200,
    mix: { security: 0.45, maintenance: 0.3, events: 0.15, other: 0.1 },
    responseMins: 13,
  },
  q4: {
    safetyIncidents: 18,
    revenue: 8200000,
    expenses: 7900000,
    serviceRequests: 924,
    events: 47,
    attendance: 12500,
    mix: { security: 0.45, maintenance: 0.3, events: 0.15, other: 0.1 },
    responseMins: 12,
  },
};

const DOLLAR = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const Slide: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
  <section className="h-screen snap-start px-6 py-6 flex flex-col">
    <header className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
    </header>
    <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 overflow-auto">
      {children}
    </div>
  </section>
);

const BoardReporting: React.FC = () => {
  const [period, setPeriod] = useState<Period>('Q4 2025');
  const [present, setPresent] = useState(false);
  const m = useMemo(() => (period === 'Q3 2025' ? boardMetrics.q3 : boardMetrics.q4), [period]);

  const barPct = (value: number, max: number) => `${Math.min(100, Math.max(0, (value / max) * 100))}%`;

  const pieStyle = {
    background: `conic-gradient(#3b82f6 0 ${m.mix.security * 360}deg, #10b981 ${m.mix.security * 360}deg ${(m.mix.security + m.mix.maintenance) * 360}deg, #f59e0b ${(m.mix.security + m.mix.maintenance) * 360}deg ${(m.mix.security + m.mix.maintenance + m.mix.events) * 360}deg, #94a3b8 ${(m.mix.security + m.mix.maintenance + m.mix.events) * 360}deg 360deg)`
  } as React.CSSProperties;

  return (
    <div className={`px-6 ${present ? 'pt-0' : 'pt-6'} max-w-[1400px] mx-auto`}>
      {/* Top controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Board Reporting</h1>
        <div className="flex items-center gap-2">
          {(['Q3 2025','Q4 2025','Year to Date'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-sm ${period===p ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
          <div className="mx-2" />
          <button className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-50">Export PDF</button>
          <button className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-sm hover:bg-gray-50">Export PPT</button>
          <button className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700" onClick={() => setPresent(!present)}>
            {present ? 'Exit Present Mode' : 'Present Mode'}
          </button>
        </div>
      </div>

      {/* Slides container */}
      <div className="snap-y snap-mandatory h-[calc(100vh-120px)] overflow-y-auto rounded-2xl">
        {/* Slide 1: Executive Summary */}
        <Slide title="Slide 1 â€” Executive Summary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Golden Triangle BID â€” {period}</h3>
              <p className="text-gray-700 leading-relaxed">
                Q4 performance remained strong across operations, programming, and financials.
                Safety incidents declined 15% quarter-over-quarter, events and attendance grew,
                and assessment collections achieved a 95.1% rate.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"/>Safety Incidents: â†“ 15%</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"/>Property Values: â†‘ 8% (market trend)</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"/>Events Hosted: {m.events}</li>
                <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"/>Assessment Collection: 95.1%</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <div className="text-xs text-blue-800">Service Requests</div>
                <div className="text-3xl font-bold text-blue-900">{m.serviceRequests}</div>
                <div className="text-xs text-blue-700 mt-1">Quarter total</div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <div className="text-xs text-green-800">Avg Response Time</div>
                <div className="text-3xl font-bold text-green-900">{m.responseMins} min</div>
                <div className="text-xs text-green-700 mt-1">Quarter average</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl">
                <div className="text-xs text-amber-800">Events</div>
                <div className="text-3xl font-bold text-amber-900">{m.events}</div>
                <div className="text-xs text-amber-700 mt-1">Hosted</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl">
                <div className="text-xs text-indigo-800">Attendance</div>
                <div className="text-3xl font-bold text-indigo-900">{m.attendance.toLocaleString()}</div>
                <div className="text-xs text-indigo-700 mt-1">Total</div>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 2: Financial Overview */}
        <Slide title="Slide 2 â€” Financial Overview (Budget vs Actual)">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <div className="mb-4 text-sm text-gray-600">Revenue and Expenses</div>
              <div className="space-y-4">
                {/* Revenue Bar */}
                <div>
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
                    <span>Revenue</span>
                    <span>{DOLLAR(m.revenue)} (102%)</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded">
                    <div className="h-4 rounded bg-green-500" style={{ width: barPct(m.revenue, 8050000) }} />
                  </div>
                </div>
                {/* Expenses Bar */}
                <div>
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-1">
                    <span>Expenses</span>
                    <span>{DOLLAR(m.expenses)} (97%)</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded">
                    <div className="h-4 rounded bg-blue-500" style={{ width: barPct(m.expenses, 8150000) }} />
                  </div>
                </div>
                {/* Surplus */}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm text-gray-700">
                  <span>Surplus</span>
                  <span className="font-semibold text-gray-900">{DOLLAR(m.revenue - m.expenses)}</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500">Simple bars for demo; replace with charting lib later if needed.</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Legend</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500"/> Revenue (Actual vs Budget)</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500"/> Expenses (Actual vs Budget)</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-gray-300"/> Budget baseline</li>
              </ul>
            </div>
          </div>
        </Slide>

        {/* Slide 3: Operations Metrics */}
        <Slide title="Slide 3 â€” Operations Metrics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <div className="w-56 h-56 rounded-full mx-auto" style={pieStyle} />
              <div className="grid grid-cols-2 gap-3 mt-6 max-w-sm mx-auto text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500"/> Security 45%</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500"/> Maintenance 30%</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-500"/> Events 15%</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-400"/> Other 10%</div>
              </div>
            </div>
            <div>
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-600 mb-2">Avg Response Time (minutes)</div>
                <div className="h-32 flex items-end gap-3">
                  <div className="flex-1 bg-primary-100 rounded-t" style={{ height: `${m.responseMins * 3}px` }} />
                </div>
                <div className="text-xs text-gray-500 mt-2">Lower is better. Current: {m.responseMins} min</div>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 4: Events & Programming */}
        <Slide title="Slide 4 â€” Events & Programming">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="mb-3 text-sm text-gray-700">Mini Calendar (demo)</div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className={`p-3 rounded border ${[2,5,9,14,20,26].includes(i) ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-200'}`}>
                    {i + 1}
                    {[2,5,9,14,20,26].includes(i) && (
                      <div className="mt-1 text-[10px] text-primary-700">Event</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="text-sm text-gray-600">Quarter Attendance</div>
                <div className="text-3xl font-bold text-gray-900">{m.attendance.toLocaleString()}</div>
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Top Events</h4>
                  <ul className="text-sm space-y-1">
                    <li>Farragut Fridays Concert â€” 2,300</li>
                    <li>Holiday Lighting Ceremony â€” 3,100</li>
                    <li>Outdoor Fitness Series â€” 1,800</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Slide>

        {/* Slide 5: Strategic Initiatives */}
        <Slide title="Slide 5 â€” Strategic Initiatives">
          <div className="space-y-4 max-w-2xl">
            {[{label:'K Street Beautification',pct:75,color:'bg-green-500'},
              {label:'Public WiFi Expansion',pct:100,color:'bg-blue-500'},
              {label:'Wayfinding Signage',pct:40,color:'bg-amber-500'}].map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800">{item.label}</span>
                    <span className="text-gray-600">{item.pct}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded">
                    <div className={`h-3 rounded ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
            ))}
            <div className="mt-4 text-xs text-gray-600">Estimated completion timelines are illustrative for demo.</div>
          </div>
        </Slide>
      </div>
    </div>
  );
};

export default BoardReporting;

