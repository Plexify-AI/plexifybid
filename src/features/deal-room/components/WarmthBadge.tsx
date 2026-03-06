import React from 'react';

interface WarmthBadgeProps {
  score: number;
  className?: string;
}

function getLabel(score: number): string {
  if (score >= 90) return 'Takeover Ready';
  if (score >= 75) return 'Hot';
  if (score >= 50) return 'Warming';
  if (score >= 25) return 'Cool';
  return 'Cold';
}

function getColors(score: number): string {
  if (score >= 75) return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
  if (score >= 50) return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
  return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
}

const WarmthBadge: React.FC<WarmthBadgeProps> = ({ score, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColors(score)} ${className}`}
    >
      {getLabel(score)} {score}/100
    </span>
  );
};

export default WarmthBadge;
