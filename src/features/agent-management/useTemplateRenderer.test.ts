import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderTemplate, renderTemplateSimple } from './useTemplateRenderer';
import type { TemplateVariable } from './AgentManagement.types';

describe('renderTemplate', () => {
  // Spy on console.warn for warning tests
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('basic variable replacement', () => {
    it('replaces a single {{variable}} with provided value', () => {
      const template = 'Hello, {{name}}!';
      const variables = { name: 'Ken' };
      const schema: TemplateVariable[] = [
        { name: 'name', type: 'string', default_value: '', required: true, description: 'Name' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Hello, Ken!');
      expect(result.warnings).toHaveLength(0);
    });

    it('replaces multiple occurrences of the same variable', () => {
      const template = '{{name}} is great. I love {{name}}.';
      const variables = { name: 'PlexifyBID' };
      const schema: TemplateVariable[] = [
        { name: 'name', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('PlexifyBID is great. I love PlexifyBID.');
    });
  });

  describe('multiple variables', () => {
    it('replaces multiple different variables', () => {
      const template = 'Project: {{project}}, Branch: {{branch}}, Sprint: {{sprint}}';
      const variables = {
        project: 'PlexifyBID',
        branch: 'feature/agent-management',
        sprint: 'Sprint 2',
      };
      const schema: TemplateVariable[] = [
        { name: 'project', type: 'string', default_value: '', required: true, description: '' },
        { name: 'branch', type: 'string', default_value: '', required: true, description: '' },
        { name: 'sprint', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe(
        'Project: PlexifyBID, Branch: feature/agent-management, Sprint: Sprint 2'
      );
    });

    it('handles variables of different types', () => {
      const template = 'Day {{day}}, Active: {{active}}, Score: {{score}}';
      const variables = {
        day: 3,
        active: true,
        score: 95.5,
      };
      const schema: TemplateVariable[] = [
        { name: 'day', type: 'number', default_value: '1', required: true, description: '' },
        { name: 'active', type: 'boolean', default_value: 'false', required: true, description: '' },
        { name: 'score', type: 'number', default_value: '0', required: false, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Day 3, Active: true, Score: 95.5');
    });
  });

  describe('missing required variables', () => {
    it('warns and uses empty string for missing required variable', () => {
      const template = 'Hello, {{name}}!';
      const variables = {}; // name not provided
      const schema: TemplateVariable[] = [
        { name: 'name', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Hello, !');
      expect(result.warnings).toContain('Missing required variable: name');
    });

    it('does not warn when warnOnMissing is false', () => {
      const template = 'Hello, {{name}}!';
      const variables = {};
      const schema: TemplateVariable[] = [
        { name: 'name', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema, { warnOnMissing: false });

      expect(result.rendered).toBe('Hello, !');
      expect(result.warnings).toHaveLength(0);
    });

    it('collects multiple warnings for multiple missing required variables', () => {
      const template = '{{first}} {{last}}';
      const variables = {};
      const schema: TemplateVariable[] = [
        { name: 'first', type: 'string', default_value: '', required: true, description: '' },
        { name: 'last', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings).toContain('Missing required variable: first');
      expect(result.warnings).toContain('Missing required variable: last');
    });
  });

  describe('optional variables with defaults', () => {
    it('uses default_value when optional variable not provided', () => {
      const template = 'Status: {{status}}';
      const variables = {}; // status not provided
      const schema: TemplateVariable[] = [
        { name: 'status', type: 'string', default_value: 'pending', required: false, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Status: pending');
      expect(result.warnings).toHaveLength(0);
    });

    it('overrides default_value when value is provided', () => {
      const template = 'Status: {{status}}';
      const variables = { status: 'completed' };
      const schema: TemplateVariable[] = [
        { name: 'status', type: 'string', default_value: 'pending', required: false, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Status: completed');
    });

    it('uses empty string when optional variable has no default', () => {
      const template = 'Note: {{note}}';
      const variables = {};
      const schema: TemplateVariable[] = [
        { name: 'note', type: 'string', default_value: '', required: false, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Note: ');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('special characters in values', () => {
    it('preserves special characters in variable values', () => {
      const template = 'Command: {{cmd}}';
      const variables = { cmd: 'git commit -m "feat: add feature"' };
      const schema: TemplateVariable[] = [
        { name: 'cmd', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Command: git commit -m "feat: add feature"');
    });

    it('handles newlines in values', () => {
      const template = 'Content:\n{{content}}';
      const variables = { content: 'Line 1\nLine 2\nLine 3' };
      const schema: TemplateVariable[] = [
        { name: 'content', type: 'text', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Content:\nLine 1\nLine 2\nLine 3');
    });

    it('handles regex special characters in values', () => {
      const template = 'Pattern: {{pattern}}';
      const variables = { pattern: '.*+?^${}()|[]\\' };
      const schema: TemplateVariable[] = [
        { name: 'pattern', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Pattern: .*+?^${}()|[]\\');
    });

    it('handles curly braces in values (not as placeholders)', () => {
      const template = 'JSON: {{json}}';
      const variables = { json: '{"key": "value"}' };
      const schema: TemplateVariable[] = [
        { name: 'json', type: 'json', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('JSON: {"key": "value"}');
    });

    it('handles unicode characters', () => {
      const template = 'Greeting: {{greeting}}';
      const variables = { greeting: '你好 🎉 مرحبا' };
      const schema: TemplateVariable[] = [
        { name: 'greeting', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Greeting: 你好 🎉 مرحبا');
    });
  });

  describe('unknown variables (not in schema)', () => {
    it('leaves unknown {{variables}} as-is by default', () => {
      const template = 'Known: {{known}}, Unknown: {{unknown}}';
      const variables = { known: 'value' };
      const schema: TemplateVariable[] = [
        { name: 'known', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Known: value, Unknown: {{unknown}}');
    });

    it('strips unknown variables when stripUnknown is true', () => {
      const template = 'Known: {{known}}, Unknown: {{unknown}}';
      const variables = { known: 'value' };
      const schema: TemplateVariable[] = [
        { name: 'known', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema, { stripUnknown: true });

      expect(result.rendered).toBe('Known: value, Unknown: ');
    });

    it('handles template with only unknown variables', () => {
      const template = '{{foo}} {{bar}} {{baz}}';
      const variables = {};
      const schema: TemplateVariable[] = [];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('{{foo}} {{bar}} {{baz}}');
    });
  });

  describe('empty template body', () => {
    it('returns empty string for empty template', () => {
      const result = renderTemplate('', {}, []);

      expect(result.rendered).toBe('');
      expect(result.warnings).toHaveLength(0);
    });

    it('returns empty string for null-ish template', () => {
      const result = renderTemplate(null as unknown as string, {}, []);

      expect(result.rendered).toBe('');
    });

    it('returns empty string for undefined template', () => {
      const result = renderTemplate(undefined as unknown as string, {}, []);

      expect(result.rendered).toBe('');
    });
  });

  describe('edge cases', () => {
    it('handles empty schema array', () => {
      const template = 'No variables here';
      const result = renderTemplate(template, {}, []);

      expect(result.rendered).toBe('No variables here');
    });

    it('handles variable names with underscores', () => {
      const template = '{{first_name}} {{last_name}}';
      const variables = { first_name: 'Ken', last_name: "D'Amato" };
      const schema: TemplateVariable[] = [
        { name: 'first_name', type: 'string', default_value: '', required: true, description: '' },
        { name: 'last_name', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe("Ken D'Amato");
    });

    it('handles variable names with numbers', () => {
      const template = '{{task1}} then {{task2}}';
      const variables = { task1: 'First', task2: 'Second' };
      const schema: TemplateVariable[] = [
        { name: 'task1', type: 'string', default_value: '', required: true, description: '' },
        { name: 'task2', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('First then Second');
    });

    it('handles explicitly provided empty string value', () => {
      const template = 'Value: {{val}}';
      const variables = { val: '' };
      const schema: TemplateVariable[] = [
        { name: 'val', type: 'string', default_value: 'default', required: false, description: '' },
      ];

      // Empty string is a valid provided value, should NOT fall back to default
      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Value: ');
    });

    it('handles false boolean value (not treated as missing)', () => {
      const template = 'Active: {{active}}';
      const variables = { active: false };
      const schema: TemplateVariable[] = [
        { name: 'active', type: 'boolean', default_value: 'true', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Active: false');
    });

    it('handles zero numeric value (not treated as missing)', () => {
      const template = 'Count: {{count}}';
      const variables = { count: 0 };
      const schema: TemplateVariable[] = [
        { name: 'count', type: 'number', default_value: '10', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toBe('Count: 0');
    });
  });

  describe('real-world templates', () => {
    it('renders session init template', () => {
      const template = `I'm continuing {{project_name}} development.

- Branch: {{branch_name}}
- Sprint: {{sprint_name}}, Day {{sprint_day}}

FIRST TASK: {{first_task}}`;

      const variables = {
        project_name: 'PlexifyBID',
        branch_name: 'feature/agent-management',
        sprint_name: 'Sprint 2',
        sprint_day: 2,
        first_task: 'Create data hooks',
      };

      const schema: TemplateVariable[] = [
        { name: 'project_name', type: 'string', default_value: 'PlexifyBID', required: true, description: '' },
        { name: 'branch_name', type: 'string', default_value: '', required: true, description: '' },
        { name: 'sprint_name', type: 'string', default_value: '', required: true, description: '' },
        { name: 'sprint_day', type: 'number', default_value: '1', required: true, description: '' },
        { name: 'first_task', type: 'string', default_value: '', required: true, description: '' },
      ];

      const result = renderTemplate(template, variables, schema);

      expect(result.rendered).toContain('PlexifyBID');
      expect(result.rendered).toContain('feature/agent-management');
      expect(result.rendered).toContain('Sprint 2, Day 2');
      expect(result.rendered).toContain('Create data hooks');
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe('renderTemplateSimple', () => {
  it('returns just the rendered string without warnings object', () => {
    const template = 'Hello, {{name}}!';
    const variables = { name: 'World' };
    const schema: TemplateVariable[] = [
      { name: 'name', type: 'string', default_value: '', required: true, description: '' },
    ];

    const result = renderTemplateSimple(template, variables, schema);

    expect(typeof result).toBe('string');
    expect(result).toBe('Hello, World!');
  });
});
