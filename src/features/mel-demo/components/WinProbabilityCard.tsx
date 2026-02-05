import { CheckCircle, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import type { WinProbabilityResponse } from '../MelDemo.types';

interface WinProbabilityCardProps {
  data: WinProbabilityResponse;
}

export function WinProbabilityCard({ data }: WinProbabilityCardProps) {
  const { probability, positiveFactors, riskFactors, recommendation } = data;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Probability Header */}
      <div className="px-4 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-primary-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Win Probability</span>
          </div>
          <span className="text-3xl font-bold text-gray-900">{probability}%</span>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary-500 to-primary-600"
            style={{ width: `${probability}%` }}
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Positive Factors */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Positive Factors
          </h4>
          <div className="space-y-2">
            {positiveFactors.map((factor) => (
              <div key={factor.label} className="flex items-start gap-2 text-xs">
                <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{factor.label}</span>
                    <span className="font-bold text-green-600 ml-2">{factor.impact}</span>
                  </div>
                  <p className="text-gray-500 mt-0.5">{factor.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Factors */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Risk Factors
          </h4>
          <div className="space-y-2">
            {riskFactors.map((factor) => (
              <div key={factor.label} className="flex items-start gap-2 text-xs">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{factor.label}</span>
                    <span className="font-bold text-amber-600 ml-2">{factor.impact}</span>
                  </div>
                  <p className="text-gray-500 mt-0.5">{factor.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={14} className="text-primary-600" />
            <span className="text-xs font-semibold text-primary-800 uppercase tracking-wide">Recommendation</span>
          </div>
          <p className="text-sm text-primary-800 leading-relaxed mb-2">
            {recommendation.summary}
          </p>
          <ul className="space-y-1 text-xs text-primary-700">
            {recommendation.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-primary-400 mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-primary-600 font-medium italic">
            {recommendation.timeline}
          </p>
        </div>
      </div>
    </div>
  );
}
