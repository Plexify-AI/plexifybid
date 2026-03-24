/**
 * LinkedIn Import — State machine hook
 *
 * Phase A states: idle → uploading → validating → mapping
 * Phase B/C states (defined, not wired): processing, complete
 */

import { useState, useCallback } from 'react';
import type { ImportState, ImportContext, UploadManifest } from './LinkedInImport.types';
import { uploadLinkedInExport } from './linkedinImportApi';

export function useLinkedInImport(token: string): ImportContext & {
  startUpload: (file: File) => void;
  reset: () => void;
} {
  const [state, setState] = useState<ImportState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [manifest, setManifest] = useState<UploadManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startUpload = useCallback(async (file: File) => {
    setState('uploading');
    setUploadProgress(0);
    setError(null);
    setManifest(null);
    setJobId(null);

    try {
      setState('uploading');
      const result = await uploadLinkedInExport(file, token, (pct) => {
        setUploadProgress(pct);
        if (pct >= 100) {
          setState('validating');
        }
      });

      setManifest(result);
      setJobId(result.jobId);
      setState('mapping');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setState('error');
    }
  }, [token]);

  const reset = useCallback(() => {
    setState('idle');
    setJobId(null);
    setUploadProgress(0);
    setManifest(null);
    setError(null);
  }, []);

  return {
    state,
    jobId,
    uploadProgress,
    manifest,
    error,
    startUpload,
    reset,
  };
}
