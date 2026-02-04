import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  SessionStatus,
  SessionType,
  CompleteSessionRequest,
  SessionDecision,
  SessionBlocker,
} from './AgentManagement.types';

// =============================================================================
// Session State Machine Tests (Pure Logic)
// =============================================================================

describe('Session State Machine', () => {
  describe('valid state transitions', () => {
    const VALID_TRANSITIONS: Array<[SessionStatus, SessionStatus]> = [
      ['active', 'completed'],
      ['active', 'abandoned'],
    ];

    const INVALID_TRANSITIONS: Array<[SessionStatus, SessionStatus]> = [
      ['completed', 'active'],
      ['completed', 'abandoned'],
      ['abandoned', 'active'],
      ['abandoned', 'completed'],
      ['active', 'active'], // No-op but technically invalid transition
    ];

    function isValidTransition(from: SessionStatus, to: SessionStatus): boolean {
      if (from === 'active' && (to === 'completed' || to === 'abandoned')) {
        return true;
      }
      return false;
    }

    it.each(VALID_TRANSITIONS)(
      'allows transition from %s to %s',
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(true);
      }
    );

    it.each(INVALID_TRANSITIONS)(
      'rejects transition from %s to %s',
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(false);
      }
    );
  });

  describe('session status values', () => {
    const VALID_STATUSES: SessionStatus[] = ['active', 'completed', 'abandoned'];

    it('recognizes all valid session statuses', () => {
      VALID_STATUSES.forEach((status) => {
        expect(['active', 'completed', 'abandoned']).toContain(status);
      });
    });

    it('active is the only status that can transition', () => {
      const canTransition = (status: SessionStatus) => status === 'active';

      expect(canTransition('active')).toBe(true);
      expect(canTransition('completed')).toBe(false);
      expect(canTransition('abandoned')).toBe(false);
    });
  });

  describe('session type values', () => {
    const VALID_TYPES: SessionType[] = [
      'development',
      'strategy',
      'research',
      'review',
      'debug',
      'custom',
    ];

    it('recognizes all valid session types', () => {
      VALID_TYPES.forEach((type) => {
        expect([
          'development',
          'strategy',
          'research',
          'review',
          'debug',
          'custom',
        ]).toContain(type);
      });
    });
  });
});

// =============================================================================
// Session Completion Validation Tests
// =============================================================================

describe('Session Completion Validation', () => {
  interface ValidationResult {
    valid: boolean;
    errors: string[];
  }

  function validateCompleteRequest(request: Partial<CompleteSessionRequest>): ValidationResult {
    const errors: string[] = [];

    // next_tasks is required and must have at least one item
    if (!request.next_tasks || request.next_tasks.length === 0) {
      errors.push('At least one next task is required');
    } else {
      // Filter out empty strings
      const validTasks = request.next_tasks.filter((t) => t.trim().length > 0);
      if (validTasks.length === 0) {
        errors.push('At least one non-empty next task is required');
      }
    }

    // decisions_made should be an array (can be empty)
    if (request.decisions_made !== undefined && !Array.isArray(request.decisions_made)) {
      errors.push('decisions_made must be an array');
    }

    // files_changed should be an array (can be empty)
    if (request.files_changed !== undefined && !Array.isArray(request.files_changed)) {
      errors.push('files_changed must be an array');
    }

    // blockers should be an array (can be empty)
    if (request.blockers !== undefined && !Array.isArray(request.blockers)) {
      errors.push('blockers must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  describe('next_tasks validation', () => {
    it('fails when next_tasks is missing', () => {
      const result = validateCompleteRequest({
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one next task is required');
    });

    it('fails when next_tasks is empty array', () => {
      const result = validateCompleteRequest({
        next_tasks: [],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one next task is required');
    });

    it('fails when next_tasks contains only whitespace', () => {
      const result = validateCompleteRequest({
        next_tasks: ['   ', '\t', '\n'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one non-empty next task is required');
    });

    it('passes when next_tasks has at least one valid task', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Implement feature X'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes with multiple next_tasks', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Task 1', 'Task 2', 'Task 3'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });

    it('passes when some tasks are empty but at least one is valid', () => {
      const result = validateCompleteRequest({
        next_tasks: ['', 'Valid task', '   '],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('optional fields validation', () => {
    it('accepts empty decisions_made array', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });

    it('accepts populated decisions_made array', () => {
      const decisions: SessionDecision[] = [
        { decision: 'Use Supabase', rationale: 'Consistency', reversible: true },
        { decision: 'Skip tests', rationale: 'Time', reversible: false },
      ];

      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: decisions,
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });

    it('accepts empty files_changed array', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });

    it('accepts populated files_changed array', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: [],
        files_changed: ['src/App.tsx', 'src/index.ts'],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });

    it('accepts empty blockers array', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
      });

      expect(result.valid).toBe(true);
    });

    it('accepts populated blockers array', () => {
      const blockers: SessionBlocker[] = [
        { description: 'API down', resolved: true, resolution: 'Restarted' },
        { description: 'Missing env var', resolved: false },
      ];

      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: [],
        files_changed: [],
        blockers,
      });

      expect(result.valid).toBe(true);
    });

    it('accepts optional context_out', () => {
      const result = validateCompleteRequest({
        next_tasks: ['Task'],
        decisions_made: [],
        files_changed: [],
        blockers: [],
        context_out: 'Completed the main feature implementation',
      });

      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// Session Abandon Validation Tests
// =============================================================================

describe('Session Abandon Validation', () => {
  interface AbandonRequest {
    reason?: string;
  }

  function validateAbandonRequest(request: AbandonRequest): { valid: boolean } {
    // Abandon is always valid - reason is optional
    return { valid: true };
  }

  it('accepts abandon without reason', () => {
    const result = validateAbandonRequest({});
    expect(result.valid).toBe(true);
  });

  it('accepts abandon with empty reason', () => {
    const result = validateAbandonRequest({ reason: '' });
    expect(result.valid).toBe(true);
  });

  it('accepts abandon with reason', () => {
    const result = validateAbandonRequest({ reason: 'Context switch to urgent bug fix' });
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Start Session Validation Tests
// =============================================================================

describe('Start Session Validation', () => {
  interface StartRequest {
    session_type: SessionType;
    agent_ids: string[];
    roles?: string[];
  }

  interface StartValidationResult {
    valid: boolean;
    errors: string[];
  }

  function validateStartRequest(request: Partial<StartRequest>): StartValidationResult {
    const errors: string[] = [];

    if (!request.session_type) {
      errors.push('session_type is required');
    }

    if (!request.agent_ids || request.agent_ids.length === 0) {
      errors.push('At least one agent_id is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  it('fails when session_type is missing', () => {
    const result = validateStartRequest({
      agent_ids: ['agent-1'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('session_type is required');
  });

  it('fails when agent_ids is missing', () => {
    const result = validateStartRequest({
      session_type: 'development',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one agent_id is required');
  });

  it('fails when agent_ids is empty', () => {
    const result = validateStartRequest({
      session_type: 'development',
      agent_ids: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one agent_id is required');
  });

  it('passes with valid session_type and agent_ids', () => {
    const result = validateStartRequest({
      session_type: 'development',
      agent_ids: ['agent-1'],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes with multiple agents', () => {
    const result = validateStartRequest({
      session_type: 'strategy',
      agent_ids: ['agent-1', 'agent-2', 'agent-3'],
    });

    expect(result.valid).toBe(true);
  });

  it('accepts optional roles array', () => {
    const result = validateStartRequest({
      session_type: 'development',
      agent_ids: ['agent-1', 'agent-2'],
      roles: ['primary', 'supporting'],
    });

    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Active Session Constraint Tests
// =============================================================================

describe('Active Session Constraint', () => {
  function canStartNewSession(existingActiveSessions: number): boolean {
    return existingActiveSessions === 0;
  }

  it('allows starting session when no active sessions exist', () => {
    expect(canStartNewSession(0)).toBe(true);
  });

  it('prevents starting session when one active session exists', () => {
    expect(canStartNewSession(1)).toBe(false);
  });

  it('prevents starting session when multiple active sessions exist', () => {
    expect(canStartNewSession(2)).toBe(false);
    expect(canStartNewSession(5)).toBe(false);
  });
});

// =============================================================================
// Handoff Prompt Generation Tests
// =============================================================================

describe('Handoff Prompt Generation', () => {
  interface HandoffData {
    context_out?: string;
    decisions_made: SessionDecision[];
    files_changed: string[];
    blockers: SessionBlocker[];
    next_tasks: string[];
  }

  function formatDecisions(decisions: SessionDecision[]): string {
    if (decisions.length === 0) return 'No decisions recorded.';
    return decisions
      .map(
        (d) =>
          `- **${d.decision}**\n  - Rationale: ${d.rationale}\n  - Reversible: ${d.reversible ? 'Yes' : 'No'}`
      )
      .join('\n');
  }

  function formatFiles(files: string[]): string {
    if (files.length === 0) return 'No files changed.';
    return files.map((f) => `- ${f}`).join('\n');
  }

  function formatBlockers(blockers: SessionBlocker[]): string {
    if (blockers.length === 0) return 'No blockers.';
    return blockers
      .map(
        (b) =>
          `- ${b.description} (${b.resolved ? 'Resolved: ' + b.resolution : 'Unresolved'})`
      )
      .join('\n');
  }

  function generateSimpleHandoff(data: HandoffData): string {
    const lines = ['# Session Handoff', ''];

    if (data.context_out) {
      lines.push('## What Was Accomplished', data.context_out, '');
    }

    lines.push('## Decisions Made', formatDecisions(data.decisions_made), '');
    lines.push('## Files Changed', formatFiles(data.files_changed), '');
    lines.push('## Blockers', formatBlockers(data.blockers), '');
    lines.push(
      '## Next Tasks',
      data.next_tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')
    );

    return lines.join('\n');
  }

  describe('formatDecisions', () => {
    it('returns default text for empty decisions', () => {
      expect(formatDecisions([])).toBe('No decisions recorded.');
    });

    it('formats single decision', () => {
      const decisions: SessionDecision[] = [
        { decision: 'Use React', rationale: 'Team familiarity', reversible: true },
      ];
      const result = formatDecisions(decisions);

      expect(result).toContain('**Use React**');
      expect(result).toContain('Rationale: Team familiarity');
      expect(result).toContain('Reversible: Yes');
    });

    it('formats multiple decisions', () => {
      const decisions: SessionDecision[] = [
        { decision: 'Use React', rationale: 'Team familiarity', reversible: true },
        { decision: 'Skip auth', rationale: 'MVP scope', reversible: false },
      ];
      const result = formatDecisions(decisions);

      expect(result).toContain('**Use React**');
      expect(result).toContain('**Skip auth**');
      expect(result).toContain('Reversible: Yes');
      expect(result).toContain('Reversible: No');
    });
  });

  describe('formatFiles', () => {
    it('returns default text for empty files', () => {
      expect(formatFiles([])).toBe('No files changed.');
    });

    it('formats single file', () => {
      const result = formatFiles(['src/App.tsx']);
      expect(result).toBe('- src/App.tsx');
    });

    it('formats multiple files', () => {
      const result = formatFiles(['src/App.tsx', 'src/index.ts', 'package.json']);
      expect(result).toBe('- src/App.tsx\n- src/index.ts\n- package.json');
    });
  });

  describe('formatBlockers', () => {
    it('returns default text for empty blockers', () => {
      expect(formatBlockers([])).toBe('No blockers.');
    });

    it('formats resolved blocker', () => {
      const blockers: SessionBlocker[] = [
        { description: 'API timeout', resolved: true, resolution: 'Increased timeout' },
      ];
      const result = formatBlockers(blockers);

      expect(result).toContain('API timeout');
      expect(result).toContain('Resolved: Increased timeout');
    });

    it('formats unresolved blocker', () => {
      const blockers: SessionBlocker[] = [
        { description: 'Missing credentials', resolved: false },
      ];
      const result = formatBlockers(blockers);

      expect(result).toContain('Missing credentials');
      expect(result).toContain('Unresolved');
    });
  });

  describe('generateSimpleHandoff', () => {
    it('generates handoff with all sections', () => {
      const data: HandoffData = {
        context_out: 'Completed the API integration',
        decisions_made: [
          { decision: 'Use REST', rationale: 'Simpler', reversible: true },
        ],
        files_changed: ['src/api.ts'],
        blockers: [],
        next_tasks: ['Add tests', 'Update docs'],
      };

      const result = generateSimpleHandoff(data);

      expect(result).toContain('# Session Handoff');
      expect(result).toContain('## What Was Accomplished');
      expect(result).toContain('Completed the API integration');
      expect(result).toContain('## Decisions Made');
      expect(result).toContain('## Files Changed');
      expect(result).toContain('## Blockers');
      expect(result).toContain('## Next Tasks');
      expect(result).toContain('1. Add tests');
      expect(result).toContain('2. Update docs');
    });

    it('generates handoff without context_out', () => {
      const data: HandoffData = {
        decisions_made: [],
        files_changed: [],
        blockers: [],
        next_tasks: ['Continue work'],
      };

      const result = generateSimpleHandoff(data);

      expect(result).not.toContain('## What Was Accomplished');
      expect(result).toContain('## Next Tasks');
    });

    it('generates handoff with empty optional sections', () => {
      const data: HandoffData = {
        decisions_made: [],
        files_changed: [],
        blockers: [],
        next_tasks: ['Start fresh'],
      };

      const result = generateSimpleHandoff(data);

      expect(result).toContain('No decisions recorded.');
      expect(result).toContain('No files changed.');
      expect(result).toContain('No blockers.');
    });
  });
});

// =============================================================================
// Session Duration Calculation Tests
// =============================================================================

describe('Session Duration Calculation', () => {
  function calculateDurationMinutes(startedAt: string, endedAt: string | null): number {
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    return Math.floor((end - start) / 60000);
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  }

  describe('calculateDurationMinutes', () => {
    it('calculates duration in minutes', () => {
      const start = '2026-02-04T10:00:00Z';
      const end = '2026-02-04T11:30:00Z';

      expect(calculateDurationMinutes(start, end)).toBe(90);
    });

    it('handles same start and end time', () => {
      const time = '2026-02-04T10:00:00Z';

      expect(calculateDurationMinutes(time, time)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats minutes under an hour', () => {
      expect(formatDuration(30)).toBe('30 minutes');
      expect(formatDuration(1)).toBe('1 minutes');
      expect(formatDuration(59)).toBe('59 minutes');
    });

    it('formats exact hours', () => {
      expect(formatDuration(60)).toBe('1 hours');
      expect(formatDuration(120)).toBe('2 hours');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(150)).toBe('2h 30m');
    });
  });
});
