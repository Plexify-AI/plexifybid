/**
 * PlexifySOLO — Claude Managed Agents runtime (Sprint E / E1 scaffold)
 *
 * E1 ships stubs only. Task E4 wires up:
 *   * createSession({ agentId, agentVersion, environmentId, vaultIds })
 *   * sendUserMessage(sessionId, content)
 *   * streamEvents(sessionId, onEvent, onClose)
 *   * wakeAndResume(sessionId) for crash recovery
 *
 * All Managed Agents calls are routed through this module so the vendor
 * hedge is swap-ready (Sprint E decision).
 */

const SCAFFOLD_ERROR =
  'Managed Agents runtime is not implemented until Sprint E / Task E4.';

export async function createSession() {
  throw new Error(SCAFFOLD_ERROR);
}

export async function sendUserMessage() {
  throw new Error(SCAFFOLD_ERROR);
}

export async function streamEvents() {
  throw new Error(SCAFFOLD_ERROR);
}

export async function wakeAndResume() {
  throw new Error(SCAFFOLD_ERROR);
}

export async function runManagedAgent() {
  throw new Error(SCAFFOLD_ERROR);
}
