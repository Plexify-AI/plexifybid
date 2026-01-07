import type { RealDocsIndex, RealDocument } from '../types/realDocs';

const REAL_DOCS_BASE_PATH = '/real-docs';

export async function loadRealDocsIndex(
  districtSlug: string
): Promise<RealDocsIndex> {
  const response = await fetch(`${REAL_DOCS_BASE_PATH}/${districtSlug}/index.json`);
  if (!response.ok) {
    throw new Error(`Failed to load documents index: ${response.status}`);
  }
  return response.json();
}

export function getDocumentUrl(districtSlug: string, filename: string): string {
  return `${REAL_DOCS_BASE_PATH}/${districtSlug}/${filename}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDocumentTypeLabel(type: RealDocument['type']): string {
  const labels: Record<RealDocument['type'], string> = {
    strategic: 'Strategic',
    operations: 'Operations',
    demographics: 'Demographics',
    financial: 'Financial',
    'capital-project': 'Capital Project',
  };
  return labels[type] || type;
}

export function getDocumentTypeColor(type: RealDocument['type']): string {
  const colors: Record<RealDocument['type'], string> = {
    strategic: '#8B5CF6',
    operations: '#3B82F6',
    demographics: '#10B981',
    financial: '#F59E0B',
    'capital-project': '#EF4444',
  };
  return colors[type] || '#6B7280';
}
