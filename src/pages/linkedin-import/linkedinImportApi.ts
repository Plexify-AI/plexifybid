/**
 * LinkedIn Import — API client
 *
 * Uses XMLHttpRequest for upload progress tracking (fetch doesn't support upload progress).
 */

import type { UploadManifest, ImportJobStatus } from './LinkedInImport.types';

export function uploadLinkedInExport(
  file: File,
  token: string,
  onProgress?: (pct: number) => void,
): Promise<UploadManifest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as UploadManifest);
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error('Invalid server response'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', '/api/linkedin-import/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

/**
 * Start the import pipeline for a pending job.
 */
export async function startPipeline(
  jobId: string,
  token: string,
): Promise<{ jobId: string; status: string; message: string }> {
  const res = await fetch('/api/linkedin-import/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ jobId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Start failed (${res.status})`);
  }
  return data;
}

/**
 * Poll pipeline status for a job.
 */
export async function pollStatus(
  jobId: string,
  token: string,
): Promise<ImportJobStatus> {
  const res = await fetch(`/api/linkedin-import/status/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Status check failed (${res.status})`);
  }
  return data as ImportJobStatus;
}

/**
 * Cancel a running pipeline.
 */
export async function cancelPipeline(
  jobId: string,
  token: string,
): Promise<{ jobId: string; status: string; message: string }> {
  const res = await fetch(`/api/linkedin-import/cancel/${jobId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Cancel failed (${res.status})`);
  }
  return data;
}
