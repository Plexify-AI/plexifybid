import React from 'react';
import { Search, X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  /** Unique key for this filter */
  key: string;
  /** Display label */
  label: string;
  /** Filter type */
  type: 'select' | 'search' | 'date';
  /** Options for select type */
  options?: FilterOption[];
  /** Placeholder text */
  placeholder?: string;
}

export interface FilterBarProps {
  /** Filter configurations */
  filters: FilterConfig[];
  /** Current filter values */
  values: Record<string, string>;
  /** Callback when a filter value changes */
  onChange: (key: string, value: string) => void;
  /** Callback to clear all filters */
  onClear?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  className = '',
}: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v && v.length > 0);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-1.5">
          <label
            htmlFor={`filter-${filter.key}`}
            className="text-sm font-medium text-gray-600 whitespace-nowrap"
          >
            {filter.label}
          </label>

          {filter.type === 'select' && filter.options && (
            <select
              id={`filter-${filter.key}`}
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className="h-9 px-3 text-sm bg-white border border-gray-300 rounded-md
                         text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200
                         focus:border-primary-400 min-w-[120px]"
            >
              <option value="">{filter.placeholder || 'All'}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {filter.type === 'search' && (
            <div className="relative">
              <Search
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id={`filter-${filter.key}`}
                type="text"
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                placeholder={filter.placeholder || 'Search...'}
                className="h-9 pl-8 pr-3 text-sm bg-white border border-gray-300 rounded-md
                           text-gray-900 placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-primary-200
                           focus:border-primary-400 min-w-[180px]"
              />
              {values[filter.key] && (
                <button
                  type="button"
                  onClick={() => onChange(filter.key, '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5
                             text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {filter.type === 'date' && (
            <input
              id={`filter-${filter.key}`}
              type="date"
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className="h-9 px-3 text-sm bg-white border border-gray-300 rounded-md
                         text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-200
                         focus:border-primary-400"
            />
          )}
        </div>
      ))}

      {/* Clear filters button */}
      {onClear && hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium
                     text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        >
          <X size={12} />
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}

export default FilterBar;
