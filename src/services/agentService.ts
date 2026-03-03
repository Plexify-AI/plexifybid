import type {
  NotebookBDAgentId,
  NotebookBDStructuredOutput,
} from '../types/structuredOutputs';

export interface RunAgentRequest {
  projectId: string;
  documentIds?: string[];
  // Backwards compatible with Phase 1B demo-source IDs.
  sourceIds?: string[];
  instructions?: string;
}

export async function runNotebookBDAgent<T = NotebookBDStructuredOutput>(
  agentId: NotebookBDAgentId,
  request: RunAgentRequest,
  authToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    throw new Error(`Agent request failed (${res.status}): ${await res.text()}`);
  }

  return (await res.json()) as T;
}
