import type { TemplateVariable } from './AgentManagement.types';

export interface RenderOptions {
  /** If true, strip unmatched {{variables}} from output. Default: false (leave as-is) */
  stripUnknown?: boolean;
  /** If true, log warnings for missing required variables. Default: true */
  warnOnMissing?: boolean;
}

export interface RenderResult {
  rendered: string;
  warnings: string[];
}

/**
 * Render a template by replacing {{variable}} placeholders with provided values.
 *
 * Behavior:
 * - Variables defined in schema use provided value, else default_value, else ''
 * - Required variables without value trigger a warning
 * - Unknown {{placeholders}} not in schema are left as-is (unless stripUnknown=true)
 * - Special characters in values are preserved (no escaping)
 *
 * @param templateBody - The template string with {{variable}} placeholders
 * @param variables - Map of variable names to values
 * @param variableSchema - Array of variable definitions (name, type, default, required)
 * @param options - Render options
 * @returns RenderResult with rendered string and any warnings
 */
export function renderTemplate(
  templateBody: string,
  variables: Record<string, string | number | boolean | undefined>,
  variableSchema: TemplateVariable[] = [],
  options: RenderOptions = {}
): RenderResult {
  const { stripUnknown = false, warnOnMissing = true } = options;
  const warnings: string[] = [];

  // Handle empty template
  if (!templateBody) {
    return { rendered: '', warnings: [] };
  }

  let rendered = templateBody;

  // Build a set of known variable names from schema
  const knownVars = new Set(variableSchema.map((v) => v.name));

  // Process each variable in the schema
  for (const varDef of variableSchema) {
    const providedValue = variables[varDef.name];
    let value: string;

    if (providedValue !== undefined && providedValue !== null) {
      // Use provided value
      value = String(providedValue);
    } else if (varDef.default_value !== undefined && varDef.default_value !== '') {
      // Use default value
      value = varDef.default_value;
    } else {
      // No value available
      value = '';
      if (varDef.required && warnOnMissing) {
        warnings.push(`Missing required variable: ${varDef.name}`);
      }
    }

    // Replace all occurrences of {{varName}}
    const placeholder = new RegExp(`\\{\\{${escapeRegex(varDef.name)}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, value);
  }

  // Handle unknown variables (not in schema)
  if (stripUnknown) {
    // Remove any remaining {{...}} placeholders
    rendered = rendered.replace(/\{\{[\w]+\}\}/g, '');
  }
  // If stripUnknown is false, unknown {{variables}} are left as-is

  return { rendered, warnings };
}

/**
 * Simple version that just returns the rendered string (for backward compatibility)
 */
export function renderTemplateSimple(
  templateBody: string,
  variables: Record<string, string | number | boolean | undefined>,
  variableSchema: TemplateVariable[] = []
): string {
  const { rendered } = renderTemplate(templateBody, variables, variableSchema);
  return rendered;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * React hook for template rendering (thin wrapper around pure function)
 */
export function useTemplateRenderer() {
  return {
    render: renderTemplate,
    renderSimple: renderTemplateSimple,
  };
}

export default useTemplateRenderer;
