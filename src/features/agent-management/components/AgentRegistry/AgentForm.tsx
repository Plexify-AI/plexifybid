import React, { useState, useCallback, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import type {
  Agent,
  ProductLine,
  AgentType,
  AgentStatus,
  CreateAgentRequest,
  UpdateAgentRequest,
} from '../../AgentManagement.types';
import { JsonArrayEditor } from '../shared';

export interface AgentFormProps {
  /** Existing agent for editing (undefined for create) */
  agent?: Agent;
  /** Callback when form is saved */
  onSave: (data: CreateAgentRequest | UpdateAgentRequest) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether save is in progress */
  saving?: boolean;
}

const PRODUCT_LINES: { value: ProductLine; label: string }[] = [
  { value: 'AEC', label: 'AEC' },
  { value: 'BID', label: 'BID' },
  { value: 'BIZ', label: 'BIZ' },
  { value: 'SOLO', label: 'SOLO' },
  { value: 'PLATFORM', label: 'PLATFORM' },
];

const AGENT_TYPES: { value: AgentType; label: string }[] = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'task_executor', label: 'Task Executor' },
  { value: 'orchestrator', label: 'Orchestrator' },
  { value: 'specialist', label: 'Specialist' },
];

const STATUSES: { value: AgentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
  { value: 'deprecated', label: 'Deprecated' },
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function AgentForm({ agent, onSave, onCancel, saving = false }: AgentFormProps) {
  const isEditing = !!agent;

  const [formData, setFormData] = useState({
    name: agent?.name ?? '',
    slug: agent?.slug ?? '',
    description: agent?.description ?? '',
    product_line: agent?.product_line ?? ('' as ProductLine),
    agent_type: agent?.agent_type ?? ('specialist' as AgentType),
    model: agent?.model ?? '',
    persona: agent?.persona ?? '',
    capabilities: agent?.capabilities ?? [],
    status: agent?.status ?? ('draft' as AgentStatus),
    metadata: agent?.metadata ? JSON.stringify(agent.metadata, null, 2) : '{}',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugEdited, setSlugEdited] = useState(isEditing);

  // Auto-generate slug from name (only for new agents and if not manually edited)
  useEffect(() => {
    if (!isEditing && !slugEdited && formData.name) {
      setFormData((prev) => ({ ...prev, slug: toSlug(prev.name) }));
    }
  }, [formData.name, isEditing, slugEdited]);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const handleSlugChange = useCallback((value: string) => {
    setSlugEdited(true);
    handleChange('slug', toSlug(value));
  }, [handleChange]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.product_line) {
      newErrors.product_line = 'Product line is required';
    }
    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    }

    // Validate metadata JSON
    if (formData.metadata) {
      try {
        JSON.parse(formData.metadata);
      } catch {
        newErrors.metadata = 'Invalid JSON';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      const data: CreateAgentRequest | UpdateAgentRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        product_line: formData.product_line,
        agent_type: formData.agent_type,
        model: formData.model.trim() || undefined,
        persona: formData.persona.trim() || undefined,
        capabilities: formData.capabilities,
        status: formData.status,
        metadata: formData.metadata ? JSON.parse(formData.metadata) : undefined,
      };

      onSave(data);
    },
    [formData, validate, onSave]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Version badge for existing agents */}
      {isEditing && agent && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Version:</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded font-mono">{agent.version}</span>
        </div>
      )}

      {/* Name & Slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-200
                       ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
            placeholder="e.g., NotebookBD RAG Agent"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            id="slug"
            type="text"
            value={formData.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            disabled={isEditing}
            className={`w-full px-3 py-2 border rounded-lg text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-primary-200
                       ${isEditing ? 'bg-gray-50 text-gray-500' : ''}
                       ${errors.slug ? 'border-red-300' : 'border-gray-300'}`}
            placeholder="auto-generated-from-name"
          />
          {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
          placeholder="Brief description of what this agent does..."
        />
      </div>

      {/* Product Line, Type, Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="product_line" className="block text-sm font-medium text-gray-700 mb-1">
            Product Line <span className="text-red-500">*</span>
          </label>
          <select
            id="product_line"
            value={formData.product_line}
            onChange={(e) => handleChange('product_line', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-200
                       ${errors.product_line ? 'border-red-300' : 'border-gray-300'}`}
          >
            <option value="">Select...</option>
            {PRODUCT_LINES.map((pl) => (
              <option key={pl.value} value={pl.value}>
                {pl.label}
              </option>
            ))}
          </select>
          {errors.product_line && <p className="mt-1 text-xs text-red-600">{errors.product_line}</p>}
        </div>

        <div>
          <label htmlFor="agent_type" className="block text-sm font-medium text-gray-700 mb-1">
            Agent Type
          </label>
          <select
            id="agent_type"
            value={formData.agent_type}
            onChange={(e) => handleChange('agent_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {AGENT_TYPES.map((at) => (
              <option key={at.value} value={at.value}>
                {at.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Model */}
      <div>
        <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <input
          id="model"
          type="text"
          value={formData.model}
          onChange={(e) => handleChange('model', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-200"
          placeholder="e.g., claude-sonnet-4, gpt-4o"
        />
      </div>

      {/* Persona */}
      <div>
        <label htmlFor="persona" className="block text-sm font-medium text-gray-700 mb-1">
          Persona / System Prompt
        </label>
        <textarea
          id="persona"
          value={formData.persona}
          onChange={(e) => handleChange('persona', e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                     focus:outline-none focus:ring-2 focus:ring-primary-200 resize-y"
          placeholder="You are..."
        />
      </div>

      {/* Capabilities */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Capabilities
        </label>
        <JsonArrayEditor
          value={formData.capabilities}
          onChange={(caps) => handleChange('capabilities', caps)}
          createItem={() => ''}
          addLabel="Add Capability"
          emptyMessage="No capabilities defined"
          showReorder={false}
          renderItem={(item, index, handlers) => (
            <input
              type="text"
              value={item}
              onChange={(e) => handlers.update(e.target.value)}
              placeholder="e.g., document_rag, citation_generation"
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          )}
        />
      </div>

      {/* Metadata (Advanced) */}
      <details className="border border-gray-200 rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
          Advanced: Metadata (JSON)
        </summary>
        <div className="p-4 border-t border-gray-200">
          <textarea
            value={formData.metadata}
            onChange={(e) => handleChange('metadata', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-primary-200 resize-y
                       ${errors.metadata ? 'border-red-300' : 'border-gray-300'}`}
            placeholder="{}"
          />
          {errors.metadata && <p className="mt-1 text-xs text-red-600">{errors.metadata}</p>}
        </div>
      </details>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                     text-gray-700 bg-white border border-gray-300 rounded-lg
                     hover:bg-gray-50 disabled:opacity-50"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                     text-white bg-primary-900 rounded-lg hover:bg-primary-800
                     disabled:opacity-50"
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Agent'}</span>
        </button>
      </div>
    </form>
  );
}

export default AgentForm;
