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
      label: 'Show prospects',
      query: 'Show me my best prospects for Q1',
      icon: Search,
      step: 'idle' as DemoStep,
    },
    {
      label: 'Draft outreach',
      query: 'Draft outreach for number 1',
      icon: Mail,
      step: 'prospect-query' as DemoStep,
    },
    {
      label: 'Win probability',
      query: "What's my win probability?",
      icon: BarChart3,
      step: 'outreach' as DemoStep,
    },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100">
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
              inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              transition-all duration-200
              ${isNext
                ? 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100'
                : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
              }
            `}
          >
            <Icon size={12} />
            {action.label}
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onReset}
        disabled={disabled || currentStep === 'idle'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
          bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700
          transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateCcw size={12} />
        Reset
      </button>
    </div>
  );
}
