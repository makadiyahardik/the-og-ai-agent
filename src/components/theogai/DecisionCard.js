'use client';

import { useState } from 'react';

export default function DecisionCard({
  title,
  description,
  options = [],
  importance = 'medium',
  deadline,
  onOptionSelect,
  onSave
}) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const importanceColors = {
    low: 'border-gray-500',
    medium: 'border-blue-500',
    high: 'border-yellow-500',
    critical: 'border-red-500'
  };

  const importanceBadge = {
    low: 'bg-gray-500/20 text-gray-300',
    medium: 'bg-blue-500/20 text-blue-300',
    high: 'bg-yellow-500/20 text-yellow-300',
    critical: 'bg-red-500/20 text-red-300'
  };

  const handleSelect = (option) => {
    setSelectedOption(option);
    if (onOptionSelect) onOptionSelect(option);
  };

  return (
    <div className={`bg-[#1e1e1e] rounded-xl border-l-4 ${importanceColors[importance]} p-5 my-4 animate-fadeIn`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">&#x2696;</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${importanceBadge[importance]}`}>
              {importance.toUpperCase()} PRIORITY
            </span>
          </div>
          <h3 className="text-white font-semibold text-lg">{title}</h3>
          {description && (
            <p className="text-gray-400 text-sm mt-1">{description}</p>
          )}
        </div>
        {deadline && (
          <div className="text-right">
            <span className="text-xs text-gray-500">Decide by</span>
            <p className="text-sm text-gray-300">{new Date(deadline).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3 mb-4">
        {options.map((option, index) => (
          <div
            key={index}
            onClick={() => handleSelect(option)}
            className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
              selectedOption?.name === option.name
                ? 'bg-[#10a37f]/20 border border-[#10a37f]'
                : 'bg-[#2a2a2a] border border-transparent hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedOption?.name === option.name
                    ? 'border-[#10a37f] bg-[#10a37f]'
                    : 'border-gray-500'
                }`}>
                  {selectedOption?.name === option.name && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-white font-medium">{option.name}</span>
              </div>
              {option.score && (
                <span className={`text-sm px-2 py-0.5 rounded ${
                  option.score >= 7 ? 'bg-green-500/20 text-green-300' :
                  option.score >= 4 ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  Score: {option.score}/10
                </span>
              )}
            </div>

            {option.description && (
              <p className="text-gray-400 text-sm mt-2 ml-8">{option.description}</p>
            )}

            {/* Pros/Cons */}
            {(option.pros?.length > 0 || option.cons?.length > 0) && (
              <div className="grid grid-cols-2 gap-4 mt-3 ml-8">
                {option.pros?.length > 0 && (
                  <div>
                    <span className="text-xs text-green-400 font-medium">PROS</span>
                    <ul className="mt-1 space-y-1">
                      {option.pros.map((pro, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                          <span className="text-green-400 mt-0.5">+</span>
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {option.cons?.length > 0 && (
                  <div>
                    <span className="text-xs text-red-400 font-medium">CONS</span>
                    <ul className="mt-1 space-y-1">
                      {option.cons.map((con, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                          <span className="text-red-400 mt-0.5">-</span>
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Deep Analysis
        </button>

        {selectedOption && onSave && (
          <button
            onClick={() => onSave(selectedOption)}
            className="px-4 py-2 bg-[#10a37f] text-white rounded-lg text-sm font-medium hover:bg-[#1a7f64] transition-colors"
          >
            Confirm Decision
          </button>
        )}
      </div>
    </div>
  );
}
