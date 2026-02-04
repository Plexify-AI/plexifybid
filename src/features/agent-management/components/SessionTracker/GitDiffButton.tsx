import React from 'react';
import { GitBranch, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useGitDiff } from '../../useGitDiff';

export interface GitDiffButtonProps {
  /** Callback when files are detected - receives newline-separated file list */
  onFilesDetected: (filesText: string) => void;
  /** Whether to append to existing content or replace */
  appendMode?: boolean;
  /** Current files text (used in append mode) */
  currentFiles?: string;
}

/**
 * Button component for detecting changed files via git diff.
 * Shows loading state, success feedback, and error messages.
 */
export function GitDiffButton({
  onFilesDetected,
  appendMode = false,
  currentFiles = '',
}: GitDiffButtonProps) {
  const { loading, error, warning, detect } = useGitDiff();
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [lastCount, setLastCount] = React.useState(0);

  const handleDetect = async () => {
    setShowSuccess(false);
    const files = await detect();

    if (files.length > 0) {
      const filesText = files.join('\n');

      if (appendMode && currentFiles.trim()) {
        // Append to existing, avoiding duplicates
        const existingFiles = new Set(
          currentFiles.split('\n').map((f) => f.trim()).filter(Boolean)
        );
        const newFiles = files.filter((f) => !existingFiles.has(f));
        if (newFiles.length > 0) {
          onFilesDetected(currentFiles.trim() + '\n' + newFiles.join('\n'));
          setLastCount(newFiles.length);
        } else {
          setLastCount(0);
        }
      } else {
        onFilesDetected(filesText);
        setLastCount(files.length);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDetect}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                   text-gray-700 bg-white border border-gray-300 rounded-md
                   hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <GitBranch size={14} />
        )}
        <span>{loading ? 'Detecting...' : 'Detect from git'}</span>
      </button>

      {/* Success feedback */}
      {showSuccess && lastCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle size={14} />
          <span>{lastCount} file{lastCount !== 1 ? 's' : ''} added</span>
        </span>
      )}

      {/* Warning (e.g., no previous commit) */}
      {warning && !error && (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle size={14} />
          <span>{warning}</span>
        </span>
      )}

      {/* Error message */}
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={14} />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}

export default GitDiffButton;
