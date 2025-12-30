'use client';

import { useState } from 'react';

export default function GoalTree({
  goals = [],
  onGoalClick,
  onAddSubgoal,
  onUpdateProgress
}) {
  const [expandedGoals, setExpandedGoals] = useState(new Set());
  const [editingGoal, setEditingGoal] = useState(null);

  const toggleExpand = (goalId) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const getTimeframeColor = (timeframe) => {
    const colors = {
      yearly: 'bg-purple-500/20 text-purple-300 border-purple-500',
      quarterly: 'bg-blue-500/20 text-blue-300 border-blue-500',
      monthly: 'bg-green-500/20 text-green-300 border-green-500',
      weekly: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
      daily: 'bg-orange-500/20 text-orange-300 border-orange-500'
    };
    return colors[timeframe] || colors.monthly;
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const renderGoalNode = (goal, level = 0) => {
    const subgoals = goals.filter(g => g.parent_goal_id === goal.id);
    const hasSubgoals = subgoals.length > 0;
    const isExpanded = expandedGoals.has(goal.id);
    const timeframeColors = getTimeframeColor(goal.timeframe);

    return (
      <div key={goal.id} className="animate-fadeIn">
        {/* Goal Node */}
        <div
          className={`relative ${level > 0 ? 'ml-6' : ''}`}
          style={{ marginLeft: level > 0 ? `${level * 24}px` : 0 }}
        >
          {/* Connection Line */}
          {level > 0 && (
            <div className="absolute left-[-20px] top-0 bottom-0 w-px bg-gray-700" />
          )}
          {level > 0 && (
            <div className="absolute left-[-20px] top-6 w-5 h-px bg-gray-700" />
          )}

          <div
            className={`bg-[#1e1e1e] rounded-lg border border-gray-700 p-4 mb-2 cursor-pointer
              hover:border-[#10a37f] transition-all duration-200 group`}
            onClick={() => onGoalClick?.(goal)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {/* Expand/Collapse */}
                {hasSubgoals && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(goal.id);
                    }}
                    className="mt-1 text-gray-500 hover:text-white transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {!hasSubgoals && <div className="w-4" />}

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${timeframeColors}`}>
                      {goal.timeframe?.toUpperCase()}
                    </span>
                    {goal.status === 'completed' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">
                        COMPLETE
                      </span>
                    )}
                  </div>

                  <h4 className="text-white font-medium">{goal.title}</h4>

                  {goal.description && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{goal.description}</p>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{goal.progress || 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(goal.progress || 0)} transition-all duration-500`}
                        style={{ width: `${goal.progress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones Preview */}
                  {goal.milestones?.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Milestones:</span>
                      <div className="flex items-center gap-1">
                        {goal.milestones.slice(0, 4).map((m, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${m.completed ? 'bg-green-500' : 'bg-gray-600'}`}
                            title={m.title}
                          />
                        ))}
                        {goal.milestones.length > 4 && (
                          <span className="text-xs text-gray-500">+{goal.milestones.length - 4}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onAddSubgoal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSubgoal(goal);
                    }}
                    className="p-1 text-gray-500 hover:text-[#10a37f] transition-colors"
                    title="Add sub-goal"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
                {onUpdateProgress && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateProgress(goal);
                    }}
                    className="p-1 text-gray-500 hover:text-[#10a37f] transition-colors"
                    title="Update progress"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Target Date */}
            {goal.target_date && (
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Target: {new Date(goal.target_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Subgoals */}
        {hasSubgoals && isExpanded && (
          <div className="relative">
            {subgoals.map(subgoal => renderGoalNode(subgoal, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get root goals (no parent)
  const rootGoals = goals.filter(g => !g.parent_goal_id);

  if (goals.length === 0) {
    return (
      <div className="bg-[#1e1e1e] rounded-xl p-6 my-4 text-center animate-fadeIn">
        <div className="text-4xl mb-3">&#x1F3AF;</div>
        <h3 className="text-white font-medium mb-2">No Goals Yet</h3>
        <p className="text-gray-400 text-sm">
          Start by telling me about your big picture goals, and I'll help you break them down into actionable steps.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e1e1e] rounded-xl p-5 my-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F3AF;</span>
          <h3 className="text-white font-semibold">Goal Architecture</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Yearly
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Quarterly
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Monthly
          </span>
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-2">
        {rootGoals.map(goal => renderGoalNode(goal, 0))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            <span className="text-white font-medium">{goals.length}</span> goals
          </span>
          <span className="text-gray-400">
            <span className="text-green-400 font-medium">
              {goals.filter(g => g.status === 'completed').length}
            </span> completed
          </span>
        </div>
        <div className="text-gray-400">
          Overall: <span className="text-white font-medium">
            {Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)}%
          </span>
        </div>
      </div>
    </div>
  );
}
