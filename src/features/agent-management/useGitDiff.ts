import { useState, useCallback } from 'react';

interface GitDiffResult {
  files: string[];
  warning?: string;
  error?: string;
}

interface UseGitDiffReturn {
  /** List of changed files from last detection */
  files: string[];
  /** Whether detection is in progress */
  loading: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Warning message (e.g., no previous commit) */
  warning: string | null;
  /** Trigger git diff detection */
  detect: () => Promise<string[]>;
  /** Clear current state */
  reset: () => void;
}

/**
 * Hook for detecting changed files via git diff.
 * Calls the /api/agent-management/utils/git-diff endpoint.
 */
export function useGitDiff(): UseGitDiffReturn {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const detect = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      const response = await fetch('/api/agent-management/utils/git-diff');
      const data: GitDiffResult = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || 'Failed to detect changed files';
        setError(errorMsg);
        setFiles([]);
        return [];
      }

      if (data.warning) {
        setWarning(data.warning);
      }

      setFiles(data.files || []);
      return data.files || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);
      setFiles([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFiles([]);
    setError(null);
    setWarning(null);
  }, []);

  return {
    files,
    loading,
    error,
    warning,
    detect,
    reset,
  };
}

export default useGitDiff;
