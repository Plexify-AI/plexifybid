export interface AudioChapter {
  title: string;
  startTime: number;
  duration: number;
}

export interface AudioBriefing {
  audioUrl: string;
  chapters: AudioChapter[];
  totalDuration: number;
}

export async function generateAudioFromContent(
  content: unknown,
  outputId: string
): Promise<AudioBriefing> {
  const response = await fetch('/api/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, outputId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'TTS request failed');
  }

  return response.json();
}
