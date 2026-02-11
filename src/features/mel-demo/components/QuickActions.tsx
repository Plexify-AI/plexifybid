import { Search, Mail, BarChart3, RotateCcw } from 'lucide-react';
import type { DemoStep } from '../MelDemo.types';

interface QuickActionsProps {
  currentStep: DemoStep;
  onAction: (query: string) => void;
  onReset: () => void;
  disabled: boolean;
}

export function QuickActions({ currentStep, onAction, onReset, disabled }: QuickActionsProps) {
  const actions = [
    {
      label: 'Show best prospects',
      query: 'Show me my best prospects for Q1',
      icon: Search,
      step: 'idle' as DemoStep,
    },
    {
      label: 'Draft outreach for #1',
      query: 'Draft outreach for number 1',
      icon: Mail,
      step: 'prospect-query' as DemoStep,
    },
    {
      label: 'Score win probability',
      query: "What's my win probability?",
      icon: BarChart3,
      step: 'outreach' as DemoStep,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        const isNext = currentStep === action.step;
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => onAction(action.query)}
            disabled={disabled || !isNext}
            className={`
              inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full
              transition-all duration-200 ease-in-out
              ${isNext
                ? 'bg-white/90 text-blue-900 border border-white/40 hover:bg-white hover:scale-105 active:scale-95 active:bg-white/70'
                : 'bg-white/20 text-white/50 border border-white/10 cursor-not-allowed'
              }
            `}
          >
            <Icon size={13} />
            {action.label}
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onReset}
        disabled={disabled || currentStep === 'idle'}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full
          bg-white/20 text-white/80 border border-white/20 hover:bg-white/30 hover:text-white
          hover:scale-105 active:scale-95
          transition-all duration-200 ease-in-out disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateCcw size={12} />
        Reset
      </button>
    </div>
  );
}
