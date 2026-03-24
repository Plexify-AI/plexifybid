/**
 * LinkedIn Import — Upload Section
 *
 * Drag-and-drop zone for ZIP files, upload progress, and manifest display.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertTriangle, FileText, BarChart3 } from 'lucide-react';
import type { UploadManifest } from './LinkedInImport.types';

interface UploadSectionProps {
  state: string;
  uploadProgress: number;
  manifest: UploadManifest | null;
  error: string | null;
  onFileSelected: (file: File) => void;
  onReset: () => void;
}

export function UploadSection({
  state,
  uploadProgress,
  manifest,
  error,
  onFileSelected,
  onReset,
}: UploadSectionProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setFileTypeError('Only .zip files from LinkedIn Data Export are accepted.');
        return;
      }
      setFileTypeError(null);
      setSelectedFile(file);
      onFileSelected(file);
    }
  }, [onFileSelected]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setFileTypeError('Only .zip files from LinkedIn Data Export are accepted.');
        return;
      }
      setFileTypeError(null);
      setSelectedFile(file);
      onFileSelected(file);
    }
  }, [onFileSelected]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Idle — show drop zone
  if (state === 'idle') {
    return (
      <div>
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-12
            transition-all duration-300 text-center
            ${isDragOver
              ? 'border-purple-400 bg-purple-500/10 shadow-[0_0_30px_rgba(107,47,217,0.3)]'
              : 'border-purple-500/40 bg-gray-800/30 hover:border-purple-400/60 hover:bg-gray-800/50'
            }
          `}
        >
          <Upload className={`mx-auto h-12 w-12 mb-4 transition-colors ${isDragOver ? 'text-purple-300' : 'text-purple-400/60'}`} />
          <p className="text-lg font-medium text-gray-200">Drop your LinkedIn export ZIP here</p>
          <p className="mt-2 text-sm text-gray-400">or click to browse</p>
          <p className="mt-4 text-xs text-gray-500">Accepts .zip files from LinkedIn Data Export</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className="hidden"
        />
        {fileTypeError && (
          <div className="mt-3 rounded-lg bg-red-900/20 border border-red-500/20 px-4 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-300">{fileTypeError}</span>
          </div>
        )}
      </div>
    );
  }

  // Uploading — progress bar
  if (state === 'uploading') {
    return (
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-8 text-center">
        <div className="mb-4 text-sm text-gray-300">
          Uploading {selectedFile?.name} ({((selectedFile?.size || 0) / 1024 / 1024).toFixed(1)} MB)
        </div>
        <div className="mx-auto max-w-md">
          <div className="h-2 rounded-full bg-gray-700/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-gray-400">{uploadProgress}%</div>
        </div>
      </div>
    );
  }

  // Validating — spinner
  if (state === 'validating') {
    return (
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent mb-4" />
        <p className="text-sm text-gray-300">Validating your export...</p>
      </div>
    );
  }

  // Error
  if (state === 'error') {
    const isNetworkError = error?.toLowerCase().includes('network') || error?.toLowerCase().includes('failed to fetch');
    const isMissingCsv = error?.toLowerCase().includes('connections.csv');
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-300">{error}</p>
            {isNetworkError && (
              <p className="text-xs text-red-400/70 mt-1">Check your internet connection and try again.</p>
            )}
            {isMissingCsv && (
              <p className="text-xs text-red-400/70 mt-1">
                This file is required. Make sure you exported your data from LinkedIn Settings &gt; Get a copy of your data.
              </p>
            )}
            <button
              onClick={onReset}
              className="mt-4 px-4 py-1.5 text-sm bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-colors"
            >
              {isNetworkError ? 'Retry Upload' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mapping (manifest received) — show results
  if (state === 'mapping' && manifest) {
    return <ManifestDisplay manifest={manifest} onReset={onReset} />;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Manifest Display
// ---------------------------------------------------------------------------

function ManifestDisplay({ manifest, onReset }: { manifest: UploadManifest; onReset: () => void }) {
  return (
    <div className="space-y-6">
      {/* Contact Count */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-6 text-center">
        <div className="text-4xl font-bold text-white mb-1">
          {manifest.contact_count.toLocaleString()}
        </div>
        <div className="text-sm text-gray-400">contacts found in your LinkedIn export</div>
      </div>

      {/* Files Found / Missing */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Export Files</h3>
        <div className="grid grid-cols-2 gap-3">
          {manifest.files_found.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="text-gray-300">{f}</span>
            </div>
          ))}
          {manifest.files_missing.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span className="text-gray-500">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring Dimensions */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-6">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="h-5 w-5 text-purple-400" />
          <h3 className="text-sm font-medium text-gray-300">Warmth Scoring Dimensions</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-700/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all"
              style={{ width: `${(manifest.scoring_dimensions_available / manifest.scoring_dimensions_max) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-400 whitespace-nowrap">
            {manifest.scoring_dimensions_available} of {manifest.scoring_dimensions_max} available
          </span>
        </div>
      </div>

      {/* Column Mapping */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-800/40 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            Column Mapping {manifest.auto_mapped && <span className="text-emerald-400 ml-2">(auto-detected)</span>}
          </h3>
        </div>
        <div className="space-y-2">
          {Object.entries(manifest.column_mapping).map(([key, col]) => (
            <div key={key} className="flex items-center text-sm">
              <span className="w-32 text-gray-500">{key}</span>
              <span className="text-gray-500 mx-2">&rarr;</span>
              <span className="text-gray-300">{col}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
        >
          Upload different file
        </button>
        <button
          disabled
          className="px-6 py-2.5 rounded-lg bg-purple-600/50 text-gray-400 cursor-not-allowed text-sm font-medium"
          title="Available in Phase B"
        >
          Start Import
        </button>
      </div>
    </div>
  );
}
