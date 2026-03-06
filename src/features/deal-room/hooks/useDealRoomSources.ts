import { useState, useCallback } from 'react';
import { useSandbox } from '../../../contexts/SandboxContext';
import type { DealRoomSource } from '../../../types/dealRoom';

interface UseDealRoomSourcesReturn {
  uploading: boolean;
  uploadProgress: string;
  uploadFile: (file: File) => Promise<DealRoomSource | null>;
  deleteSource: (sourceId: string) => Promise<boolean>;
  toggleSelection: (sourceId: string, selected: boolean) => Promise<void>;
}

export function useDealRoomSources(
  dealRoomId: string | undefined,
  onSourcesChanged?: () => void,
): UseDealRoomSourcesReturn {
  const { token } = useSandbox();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const uploadFile = useCallback(async (file: File): Promise<DealRoomSource | null> => {
    if (!dealRoomId || !token) return null;

    // Validate
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'docx', 'txt', 'md', 'csv'];
    if (!ext || !allowed.includes(ext)) {
      alert(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`);
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum 10MB.');
      return null;
    }

    setUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/deal-rooms/${dealRoomId}/sources`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }

      const source = await res.json();
      setUploadProgress('');
      onSourcesChanged?.();
      return source;
    } catch (err: any) {
      setUploadProgress(`Error: ${err.message}`);
      setTimeout(() => setUploadProgress(''), 3000);
      return null;
    } finally {
      setUploading(false);
    }
  }, [dealRoomId, token, onSourcesChanged]);

  const deleteSource = useCallback(async (sourceId: string): Promise<boolean> => {
    if (!dealRoomId || !token) return false;

    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/sources/${sourceId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Delete failed');
      onSourcesChanged?.();
      return true;
    } catch (err) {
      console.error('[useDealRoomSources] Delete error:', err);
      return false;
    }
  }, [dealRoomId, token, onSourcesChanged]);

  const toggleSelection = useCallback(async (sourceId: string, selected: boolean) => {
    // Phase 1: local-only toggle (no API yet for source updates)
    // TODO: wire to PATCH /api/deal-rooms/:id/sources/:sourceId
  }, []);

  return { uploading, uploadProgress, uploadFile, deleteSource, toggleSelection };
}
