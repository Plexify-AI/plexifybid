import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react';
import type {
  PromptTemplate,
  TemplateCategory,
  TemplateVariable,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '../../AgentManagement.types';
import { useTemplates } from '../../useTemplates';
import { useAgents } from '../../useAgents';
import { VariableEditor } from './VariableEditor';
import { TemplatePreview } from './TemplatePreview';

export interface TemplateEditorProps {
  /** Slug of template to edit (undefined = create new) */
  slug?: string;
  /** Callback when navigating back to list */
  onBack: () => void;
  /** Callback after successful save */
  onSaved?: (template: PromptTemplate) => void;
}

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'handoff', label: 'Handoff' },
  { value: 'session_init', label: 'Session Init' },
  { value: 'task_assignment', label: 'Task Assignment' },
  { value: 'code_review', label: 'Code Review' },
  { value: 'research', label: 'Research' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'system', label: 'System' },
  { value: 'custom', label: 'Custom' },
];

// Generate slug from name
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Build sample values from variables for preview
function buildSampleValues(
  variables: TemplateVariable[]
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const v of variables) {
    if (v.type === 'boolean') {
      values[v.name] = v.default_value === 'true' || true;
    } else if (v.type === 'number') {
      values[v.name] = v.default_value ? Number(v.default_value) : 42;
    } else if (v.type === 'date') {
      values[v.name] = v.default_value || new Date().toISOString().split('T')[0];
    } else {
      values[v.name] = v.default_value || `[${v.name}]`;
    }
  }
  return values;
}

interface FormState {
  name: string;
  category: TemplateCategory;
  agent_id: string;
  template_body: string;
  variables: TemplateVariable[];
}

const INITIAL_FORM: FormState = {
  name: '',
  category: 'custom',
  agent_id: '',
  template_body: '',
  variables: [],
};

export function TemplateEditor({ slug, onBack, onSaved }: TemplateEditorProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [existingTemplate, setExistingTemplate] = useState<PromptTemplate | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { getBySlug, create, update } = useTemplates();
  const { data: agents } = useAgents();

  const isEditing = !!slug && !!existingTemplate;
  const generatedSlug = useMemo(() => toSlug(form.name), [form.name]);
  const sampleValues = useMemo(() => buildSampleValues(form.variables), [form.variables]);

  // Load existing template
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getBySlug(slug).then((template) => {
      if (cancelled) return;
      setLoading(false);

      if (template) {
        setExistingTemplate(template);
        setForm({
          name: template.name,
          category: template.category,
          agent_id: template.agent_id || '',
          template_body: template.template_body,
          variables: template.variables || [],
        });
      } else {
        setError('Template not found');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug, getBySlug]);

  const handleFieldChange = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setError(null);
    },
    []
  );

  const handleSave = useCallback(async () => {
    // Validation
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.template_body.trim()) {
      setError('Template body is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let result: PromptTemplate | null;

      if (isEditing && existingTemplate) {
        const updateReq: UpdateTemplateRequest = {
          name: form.name,
          category: form.category,
          agent_id: form.agent_id || null,
          template_body: form.template_body,
          variables: form.variables,
        };
        result = await update(existingTemplate.id, updateReq);
      } else {
        const createReq: CreateTemplateRequest = {
          name: form.name,
          category: form.category,
          agent_id: form.agent_id || undefined,
          template_body: form.template_body,
          variables: form.variables,
        };
        result = await create(createReq);
      }

      if (result) {
        onSaved?.(result);
        onBack();
      } else {
        setError('Failed to save template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [form, isEditing, existingTemplate, create, update, onSaved, onBack]);

  const handleDelete = useCallback(async () => {
    if (!existingTemplate) return;

    setSaving(true);
    setError(null);

    try {
      // Soft delete by setting is_active to false
      const result = await update(existingTemplate.id, { is_active: false });
      if (result) {
        onBack();
      } else {
        setError('Failed to delete template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  }, [existingTemplate, update, onBack]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Template' : 'New Template'}
            </h1>
            {isEditing && existingTemplate && (
              <p className="text-sm text-gray-500">
                Version {existingTemplate.version} · Slug: {existingTemplate.slug}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600
                         bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                       rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                       bg-primary-600 rounded-md hover:bg-primary-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Split pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left pane: Form */}
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="My Template Name"
              className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-md
                         text-gray-900 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
            {form.name && !isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                Slug: <span className="font-mono">{generatedSlug}</span>
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => handleFieldChange('category', e.target.value as TemplateCategory)}
              className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-md
                         text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Agent binding */}
          <div>
            <label htmlFor="agent_id" className="block text-sm font-medium text-gray-700 mb-1">
              Bound Agent <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="agent_id"
              value={form.agent_id}
              onChange={(e) => handleFieldChange('agent_id', e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-gray-300 rounded-md
                         text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            >
              <option value="">None</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Template body */}
          <div>
            <label htmlFor="template_body" className="block text-sm font-medium text-gray-700 mb-1">
              Template Body <span className="text-red-500">*</span>
            </label>
            <textarea
              id="template_body"
              value={form.template_body}
              onChange={(e) => handleFieldChange('template_body', e.target.value)}
              rows={12}
              placeholder="Enter your template content here...&#10;&#10;Use {{variable_name}} for dynamic values."
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md
                         text-gray-900 placeholder-gray-400 resize-y
                         focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
            />
          </div>

          {/* Variables editor */}
          <VariableEditor
            variables={form.variables}
            onChange={(vars) => handleFieldChange('variables', vars)}
          />
        </div>

        {/* Right pane: Preview */}
        <div className="lg:sticky lg:top-4 h-fit">
          <div className="min-h-[400px]">
            <TemplatePreview
              templateBody={form.template_body}
              variables={form.variables}
              values={sampleValues}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 text-center">
            Preview uses sample/default values
          </p>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Template?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will deactivate the template "{existingTemplate?.name}". It can be reactivated later.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                           rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md
                           hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateEditor;
