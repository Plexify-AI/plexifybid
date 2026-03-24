/**
 * LinkedIn Import — State machine hook
 *
 * States: idle → uploading → validating → mapping → processing → complete
 * Phase B: processing state with polling, cancel, and resume-on-mount.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ImportState, ImportContext, ImportJobStatus, UploadManifest } from './LinkedInImport.types';
import {
  uploadLinkedInExport,
  startPipeline as apiStartPipeline,
  pollStatus as apiPollStatus,
  cancelPipeline as apiCancelPipeline,
} from './linkedinImportApi';

const SESSION_KEY = 'plexify_linkedin_import_jobId';
const POLL_INTERVAL_MS = 3000;

export function useLinkedInImport(token: string) {
  const [state, setState] = useState<ImportState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [manifest, setManifest] = useState<UploadManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ImportJobStatus | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling ──────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((jid: string) => {
    stopPolling();

    const poll = async () => {
      try {
        const status = await apiPollStatus(jid, token);
        setJobStatus(status);

        if (status.status === 'complete') {
          setState('complete');
          stopPolling();
          sessionStorage.removeItem(SESSION_KEY);
        } else if (status.status === 'error') {
          setState('error');
          setError(status.error_message || 'Pipeline failed');
          stopPolling();
          sessionStorage.removeItem(SESSION_KEY);
        } else if (status.status === 'cancelled') {
          setState('error');
          setError('Import was cancelled');
          stopPolling();
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {
        // Network error — keep polling, it may recover
      }
    };

    // Poll immediately, then on interval
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [token, stopPolling]);

  // ── Resume on mount ─────────────────────────────────────────────────
  // If user navigated away during processing, resume polling on return.

  useEffect(() => {
    if (!token) return;

    const savedJobId = sessionStorage.getItem(SESSION_KEY);
    if (savedJobId) {
      setJobId(savedJobId);
      setState('processing');
      startPolling(savedJobId);
    }

    return () => { stopPolling(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Upload ──────────────────────────────────────────────────────────

  const startUpload = useCallback(async (file: File) => {
    setState('uploading');
    setUploadProgress(0);
    setError(null);
    setManifest(null);
    setJobId(null);
    setJobStatus(null);

    try {
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

  // ── Start pipeline ──────────────────────────────────────────────────

  const startPipeline = useCallback(async () => {
    if (!jobId) return;

    try {
      setError(null);
      setState('processing');
      await apiStartPipeline(jobId, token);

      // Save jobId for resume-on-mount
      sessionStorage.setItem(SESSION_KEY, jobId);
      startPolling(jobId);
    } catch (err: any) {
      setError(err.message || 'Failed to start pipeline');
      setState('error');
    }
  }, [jobId, token, startPolling]);

  // ── Cancel pipeline ─────────────────────────────────────────────────

  const cancelImport = useCallback(async () => {
    if (!jobId) return;

    try {
      await apiCancelPipeline(jobId, token);
      stopPolling();
      sessionStorage.removeItem(SESSION_KEY);
      setState('error');
      setError('Import was cancelled');
      setJobStatus(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err: any) {
      // Even if cancel API fails, stop polling
      stopPolling();
      setError(err.message || 'Failed to cancel');
    }
  }, [jobId, token, stopPolling]);

  // ── Reset ───────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    stopPolling();
    sessionStorage.removeItem(SESSION_KEY);
    setState('idle');
    setJobId(null);
    setUploadProgress(0);
    setManifest(null);
    setError(null);
    setJobStatus(null);
  }, [stopPolling]);

  return {
    state,
    jobId,
    uploadProgress,
    manifest,
    error,
    jobStatus,
    startUpload,
    startPipeline,
    cancelImport,
    reset,
  };
}
