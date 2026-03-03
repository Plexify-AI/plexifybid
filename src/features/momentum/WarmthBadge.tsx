/**
 * WarmthBadge — Reusable warmth score indicator
 *
 * Colors:
 *   Red 75+   (#EF4444)
 *   Orange 40-74 (#F59E0B)
 *   Blue 0-39   (#3B82F6)
 */

import React from 'react';

interface WarmthBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showDelta?: boolean;
  delta?: number;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

function getColor(score: number) {
  if (score >= 75) return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400', hex: '#EF4444' };
  if (score >= 40) return { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', hex: '#F59E0B' };
  return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400', hex: '#3B82F6' };
}

const WarmthBadge: React.FC<WarmthBadgeProps> = ({ score, size = 'md', showDelta = false, delta = 0 }) => {
  const sizeClass = SIZE_CLASSES[size];
  const color = getColor(score);

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <div
        className={`${sizeClass} ${color.bg} ${color.border} border rounded-full flex items-center justify-center font-bold ${color.text}`}
      >
        {score}
      </div>
      {showDelta && delta !== 0 && (
        <span className={`text-[10px] font-medium ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  );
};

export default WarmthBadge;
