export interface DialogueTurn {
  speaker: 'CASSIDY' | 'MARK';
  text: string;
}

export interface Podcast {
  podcastUrl: string;
  title: string;
  duration: number;
  script: DialogueTurn[];
}

type PodcastResponse = {
  success: boolean;
  podcast?: Podcast;
  error?: string;
};

export async function generatePodcast(
  documentIds: string[],
  projectId: string = 'golden-triangle'
): Promise<Podcast> {
  const response = await fetch('/api/podcast/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentIds, projectId }),
  });

  const data: PodcastResponse = await response.json().catch(() => ({
    success: false,
    error: 'Podcast generation failed',
  }));

  if (!response.ok || !data.success || !data.podcast) {
    throw new Error(data.error || 'Podcast generation failed');
  }

  return data.podcast;
}
