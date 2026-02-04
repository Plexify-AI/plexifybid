import React, { useCallback } from 'react';
import { Download } from 'lucide-react';

export interface DownloadMarkdownProps {
  /** The markdown content to download */
  content: string;
  /** The filename (will have .md appended if not present) */
  filename: string;
  /** Button label (default: "Download .md") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function DownloadMarkdown({
  content,
  filename,
  label = 'Download .md',
  className = '',
  size = 'md',
}: DownloadMarkdownProps) {
  const handleDownload = useCallback(() => {
    // Ensure filename ends with .md
    const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    // Create blob and download
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  }, [content, filename]);

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
      onClick={handleDownload}
      disabled={!content}
      className={`
        inline-flex items-center justify-center rounded-md font-medium
        transition-colors duration-200
        bg-white text-gray-700 border border-gray-300
        hover:bg-gray-50 hover:border-gray-400
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <Download size={iconSizes[size]} />
      <span>{label}</span>
    </button>
  );
}

export default DownloadMarkdown;
