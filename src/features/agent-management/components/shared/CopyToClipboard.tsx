import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CopyToClipboardProps {
  /** The text to copy to clipboard */
  text: string;
  /** Button label (default: "Copy") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function CopyToClipboard({
  text,
  label = 'Copy',
  className = '',
  size = 'md',
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[CopyToClipboard] Failed to copy:', err);
    }
  }, [text]);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`
        inline-flex items-center justify-center rounded-md font-medium
        transition-all duration-200
        ${copied
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
        }
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={copied}
    >
      {copied ? (
        <>
          <Check size={iconSizes[size]} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy size={iconSizes[size]} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

export default CopyToClipboard;
