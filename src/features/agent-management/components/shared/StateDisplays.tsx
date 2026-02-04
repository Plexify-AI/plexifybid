import React from 'react';
import { AlertCircle, RefreshCw, FileQuestion, Inbox } from 'lucide-react';

// =============================================================================
// Loading Skeleton Component
// =============================================================================

export interface LoadingSkeletonProps {
  /** Type of skeleton to display */
  variant?: 'grid' | 'list' | 'detail' | 'form';
  /** Number of skeleton items (for grid/list) */
  count?: number;
}

export function LoadingSkeleton({ variant = 'grid', count = 6 }: LoadingSkeletonProps) {
  if (variant === 'detail') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-64" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-9 bg-gray-200 rounded w-24" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-10 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-32 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-5 bg-gray-200 rounded w-32" />
                <div className="h-5 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-5 bg-gray-200 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gray-200 rounded-md" />
            <div className="h-5 bg-gray-200 rounded w-32" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 rounded w-12" />
            <div className="h-5 bg-gray-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Error State Component
// =============================================================================

export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message to display */
  message: string;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Whether retry is in progress */
  retrying?: boolean;
  /** Additional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">{message}</p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                       bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
            <span>{retrying ? 'Retrying...' : 'Try Again'}</span>
          </button>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Not Found State Component
// =============================================================================

export interface NotFoundStateProps {
  /** Resource type that wasn't found */
  resourceType: string;
  /** Callback to go back */
  onBack: () => void;
  /** Custom message */
  message?: string;
}

export function NotFoundState({ resourceType, onBack, message }: NotFoundStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <FileQuestion size={32} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{resourceType} not found</h3>
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">
        {message || `The ${resourceType.toLowerCase()} you're looking for doesn't exist or has been removed.`}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                   rounded-lg hover:bg-gray-50 transition-colors"
      >
        Go Back
      </button>
    </div>
  );
}

// =============================================================================
// Empty State Component
// =============================================================================

export interface EmptyStateProps {
  /** Icon to display */
  icon?: React.ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Primary action button */
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  /** Whether filters are applied (changes messaging) */
  hasFilters?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  hasFilters = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-gray-300 rounded-lg bg-white">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        {icon || <Inbox size={32} className="text-gray-400" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center max-w-md mb-4">
        {hasFilters ? 'Try adjusting your filters or ' : ''}{description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                     bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Inline Error Banner Component
// =============================================================================

export interface ErrorBannerProps {
  /** Error message */
  message: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Optional dismiss callback */
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-red-700 hover:text-red-800"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Spinner Component
// =============================================================================

export interface SpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label */
  label?: string;
}

export function Spinner({ size = 'md', label }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div
        className={`${sizeClasses[size]} rounded-full border-gray-200 border-t-primary-600 animate-spin`}
      />
      {label && <p className="mt-3 text-sm text-gray-600">{label}</p>}
    </div>
  );
}
