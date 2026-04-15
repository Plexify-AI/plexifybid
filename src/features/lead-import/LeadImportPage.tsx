/**
 * Lead Import Page — Upload Excel/CSV, map columns, import into pipeline
 *
 * 3-step flow: Upload → Map/Preview → Import/Results
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileSpreadsheet, Check, AlertCircle,
  ChevronRight, Loader2, X, ArrowRight,
} from 'lucide-react';
import { useSandbox } from '../../contexts/SandboxContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParseResponse {
  success: boolean;
  filename: string;
  fileType: string;
  headers: string[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
  suggestedMapping: Record<string, string>;
  mappingSource?: 'keyword' | 'ai' | 'error';
  allData: Record<string, unknown>[] | null;
  truncated: boolean;
}

interface ImportResponse {
  success: boolean;
  imported: number;
  skippedNoEmail: number;
  skippedDuplicate: number;
  skippedError: number;
  total: number;
  errors?: { batch: number; error: string }[];
  message?: string;
}

// Target fields for column mapping dropdown
const TARGET_FIELDS = [
  { value: 'skip', label: '(Skip this column)' },
  { value: 'contact_first_name', label: 'First Name', required: true },
  { value: 'contact_last_name', label: 'Last Name', required: true },
  { value: 'contact_full_name', label: 'Full Name (auto-split into First + Last)' },
  { value: 'contact_email', label: 'Email', recommended: true },
  { value: 'contact_title', label: 'Job Title' },
  { value: 'company_name', label: 'Company Name', required: true },
  { value: 'industry', label: 'Industry' },
  { value: 'state', label: 'State / Region' },
  { value: 'source_campaign', label: 'Source Campaign' },
  { value: 'lifecycle_stage', label: 'Lifecycle Stage' },
  { value: 'mql_date', label: 'MQL Date' },
  { value: 'school_type', label: 'School Type' },
  { value: 'email_domain', label: 'Email Domain' },
  { value: 'notes', label: 'Notes' },
];

type Step = 'upload' | 'mapping' | 'importing' | 'results';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeadImportPage() {
  const navigate = useNavigate();
  const { token, tenant } = useSandbox();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<Step>('upload');

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);

  // Mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappingSource, setMappingSource] = useState<string>('keyword');

  // Import options
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [normalizeStates, setNormalizeStates] = useState(true);
  const [skipNoEmail, setSkipNoEmail] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [sourceType, setSourceType] = useState('');

  // Import state
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // File upload + parse
  // ---------------------------------------------------------------------------

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setParseError('Only .xlsx, .xls, and .csv files are accepted');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError('File too large (max 10 MB)');
      return;
    }

    setParsing(true);
    setParseError(null);
    setParseResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/leads/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse file');
      }

      setParseResult(data);
      setColumnMapping(data.suggestedMapping || {});
      setMappingSource(data.mappingSource || 'keyword');
      // Default source type from filename (strip extension, replace spaces/underscores)
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[\s]+/g, '_').toLowerCase();
      setSourceType(baseName);
      setStep('mapping');
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setParsing(false);
    }
  }, [token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so re-selecting same file works
    e.target.value = '';
  }, [handleFile]);

  // ---------------------------------------------------------------------------
  // Column mapping helpers
  // ---------------------------------------------------------------------------

  const updateMapping = (header: string, target: string) => {
    setColumnMapping(prev => ({ ...prev, [header]: target }));
  };

  // Get mapped preview: first 5 rows with target column names as headers
  const getMappedPreviewRows = () => {
    if (!parseResult) return [];
    const rows = parseResult.previewRows.slice(0, 5);
    return rows.map(row => {
      const mapped: Record<string, unknown> = {};
      for (const [header, target] of Object.entries(columnMapping)) {
        if (target && target !== 'skip') {
          mapped[target] = row[header];
        }
      }
      return mapped;
    });
  };

  const getMappedTargets = () => {
    return Object.values(columnMapping).filter(t => t && t !== 'skip');
  };

  // Count how many required fields are mapped
  const hasCompanyName = getMappedTargets().includes('company_name');

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  const handleImport = async () => {
    if (!parseResult?.allData) return;
    setStep('importing');
    setImportError(null);

    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: parseResult.allData,
          mapping: columnMapping,
          sourceType,
          options: {
            trimWhitespace,
            normalizeStates,
            skipNoEmail,
            skipDuplicates,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportResult(data);
      setStep('results');
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setStep('mapping'); // Go back so user can retry
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep('upload');
    setParseResult(null);
    setParseError(null);
    setColumnMapping({});
    setMappingSource('keyword');
    setImportResult(null);
    setImportError(null);
    setSourceType('');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      {/* Back nav */}
      <div className="max-w-4xl mx-auto mb-6">
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>
      </div>

      {/* Main card */}
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-gray-700/40 bg-gray-900/60 backdrop-blur-xl p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple-500/15 border border-purple-500/25">
              <FileSpreadsheet className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Import Leads</h1>
              <p className="text-sm text-gray-400">{tenant?.company || 'Your Pipeline'}</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8 mt-4 text-xs text-gray-500">
            <StepBadge label="Upload" active={step === 'upload'} done={step !== 'upload'} />
            <ChevronRight className="h-3 w-3" />
            <StepBadge label="Map & Preview" active={step === 'mapping'} done={step === 'importing' || step === 'results'} />
            <ChevronRight className="h-3 w-3" />
            <StepBadge label="Import" active={step === 'importing' || step === 'results'} done={step === 'results'} />
          </div>

          {/* ----- STEP 1: Upload ----- */}
          {step === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                  transition-all duration-200
                  ${dragOver
                    ? 'border-purple-400 bg-purple-500/10'
                    : 'border-gray-600/40 bg-gray-800/20 hover:border-purple-500/40 hover:bg-gray-800/30'}
                `}
              >
                {parsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-purple-400 animate-spin" />
                    <p className="text-gray-300 font-medium">Parsing file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-10 w-10 text-gray-500" />
                    <p className="text-gray-300 font-medium">
                      Drag and drop your file here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500">
                      Excel (.xlsx) and CSV supported. Google Sheets coming soon.
                    </p>
                  </div>
                )}
              </div>

              {/* Template download link */}
              <div className="flex items-center justify-center gap-2 mt-3" style={{ opacity: 0.7 }}>
                <span className="text-[13px] text-gray-500">
                  First time?
                </span>
                <a
                  href="/api/leads/template"
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="text-[13px] text-emerald-400 underline hover:text-emerald-300 transition-colors"
                >
                  Download our import template
                </a>
              </div>

              {parseError && (
                <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* ----- STEP 2: Mapping + Preview ----- */}
          {step === 'mapping' && parseResult && (
            <div>
              {/* File info */}
              <div className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3 mb-6 border border-gray-700/30">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-sm text-white font-medium">{parseResult.filename}</p>
                    <p className="text-xs text-gray-400">{parseResult.totalRows.toLocaleString()} rows detected</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title="Choose a different file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {importError && (
                <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {importError}
                </div>
              )}

              {/* Column mapping header with AI badge */}
              <div className="flex items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Column Mapping</h3>
                {mappingSource === 'ai' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded ml-2">
                    AI-mapped columns — verify before importing
                  </span>
                )}
              </div>
              <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-2">
                {parseResult.headers.map((header) => (
                  <div key={header} className="flex items-center gap-3 bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-700/20">
                    <span className="text-sm text-gray-300 w-48 truncate flex-shrink-0" title={header}>{header}</span>
                    <ArrowRight className="h-3 w-3 text-gray-600 flex-shrink-0" />
                    <select
                      value={columnMapping[header] || 'skip'}
                      onChange={(e) => updateMapping(header, e.target.value)}
                      className="flex-1 bg-gray-800 text-sm text-gray-200 rounded-md px-2 py-1.5 border border-gray-600/40 focus:border-purple-500 focus:outline-none"
                    >
                      {TARGET_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>
                          {f.label}{f.required ? ' *' : ''}{f.recommended ? ' (recommended)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Validation warning */}
              {!hasCompanyName && (
                <div className="mb-4 flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Company Name is required. Map at least one column to "Company Name".
                </div>
              )}

              {/* Preview table */}
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto mb-6 rounded-lg border border-gray-700/30">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800/60">
                      {getMappedTargets().map(t => {
                        const field = TARGET_FIELDS.find(f => f.value === t);
                        return (
                          <th key={t} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">
                            {field?.label || t}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {getMappedPreviewRows().map((row, i) => (
                      <tr key={i} className="border-t border-gray-700/20">
                        {getMappedTargets().map(t => (
                          <td key={t} className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[200px] truncate">
                            {row[t] != null ? String(row[t]) : <span className="text-gray-600 italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cleaning options */}
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Data Cleaning</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <CheckOption label="Auto-trim whitespace" checked={trimWhitespace} onChange={setTrimWhitespace} />
                <CheckOption label="Normalize state abbreviations" checked={normalizeStates} onChange={setNormalizeStates} />
                <CheckOption label="Skip rows with no email" checked={skipNoEmail} onChange={setSkipNoEmail} />
                <CheckOption label="Skip duplicate emails" checked={skipDuplicates} onChange={setSkipDuplicates} />
              </div>

              {/* Source tag */}
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Source Tag</h3>
              <input
                type="text"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                placeholder="e.g., zspace_tradeshow_2025_NE"
                className="w-full bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 border border-gray-600/40 focus:border-purple-500 focus:outline-none mb-6"
              />

              {/* Import button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  {parseResult.totalRows.toLocaleString()} rows ready
                  {parseResult.truncated && <span className="text-amber-400 ml-2">(file truncated at 5,000 rows)</span>}
                </p>
                <button
                  onClick={handleImport}
                  disabled={!hasCompanyName || !parseResult.allData}
                  className={`
                    flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all
                    ${hasCompanyName
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                  `}
                >
                  <Upload className="h-4 w-4" />
                  Import {parseResult.totalRows.toLocaleString()} Leads
                </button>
              </div>
            </div>
          )}

          {/* ----- STEP 3a: Importing (progress) ----- */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
              <p className="text-gray-300 font-medium">Importing leads...</p>
              <p className="text-sm text-gray-500">This may take a moment for large files.</p>
            </div>
          )}

          {/* ----- STEP 3b: Results ----- */}
          {step === 'results' && importResult && (
            <div>
              {/* Success banner */}
              <div className="flex items-center gap-3 bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20 mb-6">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/20">
                  <Check className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">
                    {importResult.imported.toLocaleString()} leads imported
                  </p>
                  <p className="text-sm text-gray-400">
                    into {tenant?.company || 'your pipeline'}
                  </p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <StatCard label="Total Rows" value={importResult.total} />
                <StatCard label="Imported" value={importResult.imported} color="emerald" />
                <StatCard label="Skipped (no email)" value={importResult.skippedNoEmail} color="amber" />
                <StatCard label="Skipped (duplicate)" value={importResult.skippedDuplicate} color="amber" />
              </div>

              {importResult.skippedError > 0 && (
                <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {importResult.skippedError} rows failed to insert. Check server logs for details.
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/home')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm bg-purple-600 hover:bg-purple-500 text-white transition-all"
                >
                  View Pipeline
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-lg font-medium text-sm text-gray-400 hover:text-gray-200 border border-gray-700/40 hover:border-gray-600/40 transition-all"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepBadge({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
        done
          ? 'bg-emerald-500/20 text-emerald-400'
          : active
            ? 'bg-purple-500/20 text-purple-300'
            : 'bg-gray-800/40 text-gray-500'
      }`}
    >
      {done && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}
      {label}
    </span>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 bg-gray-800/30 rounded-lg px-3 py-2.5 border border-gray-700/20 cursor-pointer hover:border-gray-600/30 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
      />
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClass = color === 'emerald'
    ? 'text-emerald-400'
    : color === 'amber'
      ? 'text-amber-400'
      : 'text-white';
  return (
    <div className="bg-gray-800/30 rounded-lg px-4 py-3 border border-gray-700/20">
      <p className={`text-xl font-semibold ${colorClass}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
