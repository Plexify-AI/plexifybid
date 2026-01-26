// @ts-nocheck
import React, { useMemo, useState } from 'react';

type PropertyType = 'Office' | 'Retail' | 'Mixed';
type Status = 'Paid' | 'Pending' | 'Overdue';

interface PropertyRow {
  id: number;
  address: string;
  owner: string;
  sqft: number;
  assessedAmount: number; // USD
  collectedAmount: number; // USD
  dueDate: string; // ISO date
  paidDate?: string; // ISO date
  type: PropertyType;
}

const DOLLAR = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const RATE_PER_SQFT = 0.18; // Golden Triangle BID rate

const sample: PropertyRow[] = [
  { id: 1, address: '1850 K Street NW', owner: 'Capitol Properties LLC', sqft: 125000, assessedAmount: 125000, collectedAmount: 125000, dueDate: '2025-10-01', paidDate: '2025-09-28', type: 'Office' },
  { id: 2, address: '1800 K Street NW', owner: 'Midtown Holdings Inc.', sqft: 98500, assessedAmount: 98500, collectedAmount: 98500, dueDate: '2025-10-01', paidDate: '2025-09-25', type: 'Office' },
  { id: 3, address: '1776 K Street NW', owner: 'National Liberty Partners', sqft: 112000, assessedAmount: 112000, collectedAmount: 0, dueDate: '2025-10-01', type: 'Office' },
  { id: 4, address: '1900 L Street NW', owner: 'Beacon Square REIT', sqft: 87500, assessedAmount: 87500, collectedAmount: 87500, dueDate: '2025-10-01', paidDate: '2025-09-29', type: 'Office' },
  { id: 5, address: '1700 K Street NW', owner: 'Cityline Retail Group', sqft: 54000, assessedAmount: 54000, collectedAmount: 27000, dueDate: '2025-10-15', type: 'Retail' },
  { id: 6, address: '1600 I Street NW', owner: 'District Mixed Ventures', sqft: 102000, assessedAmount: 102000, collectedAmount: 102000, dueDate: '2025-10-01', paidDate: '2025-09-27', type: 'Mixed' },
  { id: 7, address: '1500 I Street NW', owner: 'Federal Square Estates', sqft: 96000, assessedAmount: 96000, collectedAmount: 96000, dueDate: '2025-10-01', paidDate: '2025-09-28', type: 'Office' },
  { id: 8, address: '2000 Pennsylvania Ave NW', owner: 'Penn Ave Holdings', sqft: 130000, assessedAmount: 130000, collectedAmount: 0, dueDate: '2025-10-01', type: 'Office' },
  { id: 9, address: 'Connecticut Ave NW 1701', owner: 'Northeast Capital', sqft: 88000, assessedAmount: 88000, collectedAmount: 44000, dueDate: '2025-10-10', type: 'Office' },
  { id: 10, address: '1901 L Street NW', owner: 'Beacon Square REIT', sqft: 74000, assessedAmount: 74000, collectedAmount: 74000, dueDate: '2025-10-01', paidDate: '2025-09-30', type: 'Office' },
  // Duplicate patterns to reach 25 demo rows
  { id: 11, address: '1725 K Street NW', owner: 'Capital Ridge Partners', sqft: 82000, assessedAmount: 82000, collectedAmount: 82000, dueDate: '2025-10-01', paidDate: '2025-09-29', type: 'Office' },
  { id: 12, address: '1101 19th St NW', owner: 'Urban Retail Trust', sqft: 51000, assessedAmount: 51000, collectedAmount: 25500, dueDate: '2025-10-15', type: 'Retail' },
  { id: 13, address: '1717 Pennsylvania Ave NW', owner: 'Penn Ave Holdings', sqft: 120000, assessedAmount: 120000, collectedAmount: 120000, dueDate: '2025-10-01', paidDate: '2025-09-24', type: 'Office' },
  { id: 14, address: '1601 K Street NW', owner: 'Midtown Holdings Inc.', sqft: 91000, assessedAmount: 91000, collectedAmount: 91000, dueDate: '2025-10-01', paidDate: '2025-09-28', type: 'Office' },
  { id: 15, address: '1401 I Street NW', owner: 'Cityline Retail Group', sqft: 47000, assessedAmount: 47000, collectedAmount: 0, dueDate: '2025-10-20', type: 'Retail' },
  { id: 16, address: '2001 K Street NW', owner: 'District Mixed Ventures', sqft: 101000, assessedAmount: 101000, collectedAmount: 101000, dueDate: '2025-10-01', paidDate: '2025-09-29', type: 'Mixed' },
  { id: 17, address: '1999 K Street NW', owner: 'Beacon Square REIT', sqft: 88000, assessedAmount: 88000, collectedAmount: 88000, dueDate: '2025-10-01', paidDate: '2025-09-28', type: 'Office' },
  { id: 18, address: '1501 K Street NW', owner: 'Northeast Capital', sqft: 86000, assessedAmount: 86000, collectedAmount: 43000, dueDate: '2025-10-10', type: 'Office' },
  { id: 19, address: '1750 Pennsylvania Ave NW', owner: 'Penn Ave Holdings', sqft: 135000, assessedAmount: 135000, collectedAmount: 0, dueDate: '2025-10-01', type: 'Office' },
  { id: 20, address: '1099 18th St NW', owner: 'Urban Retail Trust', sqft: 60000, assessedAmount: 60000, collectedAmount: 60000, dueDate: '2025-10-01', paidDate: '2025-09-26', type: 'Retail' },
  { id: 21, address: '1750 K Street NW', owner: 'Capital Ridge Partners', sqft: 90000, assessedAmount: 90000, collectedAmount: 90000, dueDate: '2025-10-01', paidDate: '2025-09-30', type: 'Office' },
  { id: 22, address: '1001 17th St NW', owner: 'Cityline Retail Group', sqft: 45000, assessedAmount: 45000, collectedAmount: 22500, dueDate: '2025-10-15', type: 'Retail' },
  { id: 23, address: '1701 L Street NW', owner: 'District Mixed Ventures', sqft: 99000, assessedAmount: 99000, collectedAmount: 99000, dueDate: '2025-10-01', paidDate: '2025-09-27', type: 'Mixed' },
  { id: 24, address: '1200 18th St NW', owner: 'Midtown Holdings Inc.', sqft: 78000, assessedAmount: 78000, collectedAmount: 78000, dueDate: '2025-10-01', paidDate: '2025-09-29', type: 'Office' },
  { id: 25, address: '1100 19th St NW', owner: 'Northeast Capital', sqft: 83000, assessedAmount: 83000, collectedAmount: 0, dueDate: '2025-10-01', type: 'Office' },
];

type SortKey = keyof Pick<PropertyRow, 'address' | 'owner' | 'assessedAmount' | 'collectedAmount'>;

const AssessmentManagement: React.FC = () => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All');
  const [sortKey, setSortKey] = useState<SortKey>('address');
  const [sortAsc, setSortAsc] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcSqft, setCalcSqft] = useState<number>(100000);
  const [calcType, setCalcType] = useState<PropertyType>('Office');
  const [detailId, setDetailId] = useState<number | null>(null);

  const today = new Date();

  const statusOf = (row: PropertyRow): Status => {
    if (row.collectedAmount >= row.assessedAmount) return 'Paid';
    const due = new Date(row.dueDate);
    return due.getTime() < today.getTime() ? 'Overdue' : 'Pending';
  };

  const rows = useMemo(() => {
    const base = sample
      .filter(r =>
        [r.address, r.owner].some(x => x.toLowerCase().includes(query.toLowerCase()))
      )
      .filter(r => (statusFilter === 'All' ? true : statusOf(r) === statusFilter));
    const sorted = [...base].sort((a, b) => {
      const A = a[sortKey];
      const B = b[sortKey];
      const res = typeof A === 'number' && typeof B === 'number'
        ? A - B
        : String(A).localeCompare(String(B));
      return sortAsc ? res : -res;
    });
    return sorted;
  }, [query, statusFilter, sortKey, sortAsc]);

  const totals = useMemo(() => {
    const billed = 8200000; // Q4 billed (from spec)
    const collected = 7800000;
    const outstanding = billed - collected;
    const rate = (collected / billed) * 100;
    return { billed, collected, outstanding, rate };
  }, []);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const calcAmount = Math.max(0, Math.round(calcSqft * RATE_PER_SQFT));

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Assessment Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalcOpen(true)}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            Assessment Calculator
          </button>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-sm text-gray-500">Total Billed (Q4 2025)</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{DOLLAR(totals.billed)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-sm text-gray-500">Collected</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{DOLLAR(totals.collected)}</div>
          <div className="mt-3">
            <div className="w-full h-2 bg-gray-200 rounded">
              <div className="h-2 rounded bg-green-500" style={{ width: `${totals.rate}%` }} />
            </div>
            <div className="text-xs text-gray-600 mt-1">{totals.rate.toFixed(1)}% collection rate</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-sm text-gray-500">Outstanding</div>
          <div className="text-3xl font-bold text-amber-600 mt-1">{DOLLAR(totals.outstanding)}</div>
          <div className="text-xs text-gray-600 mt-1">4.9% outstanding</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex-1">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by address or owner..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option>All</option>
              <option>Paid</option>
              <option>Pending</option>
              <option>Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort('address')}>Property {sortKey==='address' && (sortAsc ? 'â–²' : 'â–¼')}</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort('owner')}>Owner {sortKey==='owner' && (sortAsc ? 'â–²' : 'â–¼')}</th>
                <th className="px-4 py-3">Sq Ft</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort('assessedAmount')}>Assessed {sortKey==='assessedAmount' && (sortAsc ? 'â–²' : 'â–¼')}</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => changeSort('collectedAmount')}>Collected {sortKey==='collectedAmount' && (sortAsc ? 'â–²' : 'â–¼')}</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => {
                const status = statusOf(r);
                const statusClass = status === 'Paid' ? 'text-green-700 bg-green-100' : status === 'Pending' ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailId(r.id)}>
                    <td className="px-4 py-3 text-sm text-gray-600">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.address}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.owner}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.sqft.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{DOLLAR(r.assessedAmount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{DOLLAR(r.collectedAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
          <div>Showing 1â€“25 of 800 properties</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded bg-gray-100 text-gray-600 cursor-not-allowed">â†</button>
            <span className="px-2 py-1 rounded bg-primary-600 text-white">1</span>
            <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">2</button>
            <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">3</button>
            <button className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">â†’</button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detailId !== null && (() => {
        const r = sample.find(x => x.id === detailId)!;
        const status = statusOf(r);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailId(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{r.address}</h3>
                  <div className="text-sm text-gray-600">{r.owner}</div>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setDetailId(null)}>âœ•</button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Assessed</div>
                    <div className="text-lg font-semibold">{DOLLAR(r.assessedAmount)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Collected</div>
                    <div className="text-lg font-semibold">{DOLLAR(r.collectedAmount)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Due Date</div>
                    <div className="text-lg font-semibold">{new Date(r.dueDate).toLocaleDateString()}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="text-lg font-semibold">{status}</div>
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  <div className="font-medium mb-1">Payment History (demo)</div>
                  <ul className="list-disc ml-5 space-y-1">
                    {r.paidDate ? (
                      <li>Payment received on {new Date(r.paidDate).toLocaleDateString()} â€” {DOLLAR(r.collectedAmount)}</li>
                    ) : (
                      <li>No payments recorded yet.</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end">
                <button className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700" onClick={() => setDetailId(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Calculator modal */}
      {calcOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCalcOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Assessment Calculator</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setCalcOpen(false)}>âœ•</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Square Footage</label>
                  <input
                    type="number"
                    value={calcSqft}
                    onChange={e => setCalcSqft(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Property Type</label>
                  <select
                    value={calcType}
                    onChange={e => setCalcType(e.target.value as PropertyType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option>Office</option>
                    <option>Retail</option>
                    <option>Mixed</option>
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-600">Estimated Annual Assessment</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{DOLLAR(calcAmount)}</div>
                <div className="text-xs text-gray-500 mt-1">Rate: ${RATE_PER_SQFT.toFixed(2)}/sq ft â€¢ Type: {calcType}</div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50" onClick={() => setCalcOpen(false)}>Close</button>
              <button className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700" onClick={() => setCalcOpen(false)}>Save Estimate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentManagement;

