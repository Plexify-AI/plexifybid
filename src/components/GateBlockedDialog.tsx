/**
 * GateBlockedDialog — surfaces Sprint E / E5 pre-export blockers.
 *
 * Used by DealRoomHeader's Export DOCX / Export PPTX flows. When the export
 * route returns 409 with { blockers: [...] }, this opens. User reads the
 * findings, optionally writes a justification, and overrides per-gate. Each
 * override creates a sticky gate_overrides row keyed on (artifact_id, gate_kind).
 */

import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useSandbox } from '../contexts/SandboxContext';

interface Finding {
  claim: string;
  rule: string;
  severity: 'block' | 'warn' | 'info';
  evidence: string;
  source?: string;
  jurisdiction?: string;
}

interface Blocker {
  gate: 'factual_auditor' | 'compliance_guard';
  audit_id: string | null;
  summary: string;
  findings: Finding[];
}

interface Props {
  artifactId: string;
  blockers: Blocker[];
  onClose: () => void;
  onOverridden: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  block: '#EF4444',
  warn: '#F59E0B',
  info: '#8B5CF6',
};

const GATE_LABEL: Record<string, string> = {
  factual_auditor: 'Factual Auditor',
  compliance_guard: 'Compliance Guard',
};

const GateBlockedDialog: React.FC<Props> = ({ artifactId, blockers, onClose, onOverridden }) => {
  const { token } = useSandbox();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [overriding, setOverriding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function override(gate: 'factual_auditor' | 'compliance_guard', findings: Finding[]) {
    if (!token) return;
    const reason = (reasons[gate] || '').trim();
    if (reason.length < 10) {
      setError('Reason must be at least 10 characters — this writes to the audit log.');
      return;
    }
    setError(null);
    setOverriding(gate);
    try {
      const res = await fetch('/api/gate-overrides', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifact_id: artifactId,
          gate_kind: gate,
          reason,
          original_findings: { findings },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Override failed (${res.status})`);
      } else {
        onOverridden();
      }
    } catch (err: any) {
      setError(err?.message || 'Override failed');
    } finally {
      setOverriding(null);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0E1A33] border border-amber-500/40 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/40 sticky top-0 bg-[#0E1A33]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-amber-400" />
            <h2 className="text-base font-semibold text-white">Export blocked by pre-export gates</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <p className="text-xs text-gray-400 leading-relaxed">
            One or more pre-export gates returned a <span className="text-red-400 font-medium">block</span> finding.
            Review each item below. To proceed anyway, write a documented reason and override —
            the override is logged with your user ID for compliance review.
          </p>

          {error && (
            <div className="p-3 text-sm text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded">
              {error}
            </div>
          )}

          {blockers.map((b) => (
            <div key={b.gate} className="bg-gray-900/50 border border-gray-700/40 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <h3 className="text-sm font-semibold text-white">{GATE_LABEL[b.gate]}</h3>
                <span className="text-[10px] uppercase tracking-wider text-gray-500">{b.findings.length} finding{b.findings.length === 1 ? '' : 's'}</span>
              </div>
              <p className="text-xs text-gray-300">{b.summary}</p>

              <ul className="space-y-2">
                {b.findings.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white self-start mt-0.5"
                      style={{ backgroundColor: SEVERITY_COLOR[f.severity] || '#6B7280' }}
                    >
                      {f.severity}
                    </span>
                    <div className="text-xs text-gray-200">
                      <div className="font-medium text-gray-100">{f.rule}</div>
                      <div className="mt-0.5">{f.claim}</div>
                      {f.evidence && <div className="text-gray-400 mt-0.5"><span className="text-gray-500">Evidence:</span> {f.evidence}</div>}
                      {(f.source || f.jurisdiction) && (
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
                          {f.source && <>source: {f.source}</>}
                          {f.source && f.jurisdiction && <span className="mx-1">·</span>}
                          {f.jurisdiction && <>jurisdiction: {f.jurisdiction}</>}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="pt-2 border-t border-gray-700/40 space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-gray-400">
                  Override reason (≥ 10 chars, written to audit log)
                </label>
                <textarea
                  value={reasons[b.gate] || ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [b.gate]: e.target.value }))}
                  placeholder="e.g. 'Past project verified manually with client; will attach signed reference in the SOQ.'"
                  rows={2}
                  className="w-full bg-gray-950/60 border border-gray-700/50 rounded px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  onClick={() => override(b.gate, b.findings)}
                  disabled={overriding === b.gate}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40"
                >
                  {overriding === b.gate ? 'Recording…' : `Override ${GATE_LABEL[b.gate]}`}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-700/40 sticky bottom-0 bg-[#0E1A33] flex justify-end">
          <button
            onClick={onClose}
            className="text-sm text-gray-300 hover:text-white px-3 py-1.5"
          >
            Cancel export
          </button>
        </div>
      </div>
    </div>
  );
};

export default GateBlockedDialog;
