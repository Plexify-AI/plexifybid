import type {
  NotebookBDAgentId,
  NotebookBDStructuredOutput,
} from '../types/structuredOutputs';

export interface RunAgentRequest {
  projectId: string;
  sourceIds?: string[];
  instructions?: string;
}

export async function runNotebookBDAgent<T = NotebookBDStructuredOutput>(
  agentId: NotebookBDAgentId,
  request: RunAgentRequest
): Promise<T> {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Agent request failed (${res.status}): ${await res.text()}`);
  }

  return (await res.json()) as T;
}
