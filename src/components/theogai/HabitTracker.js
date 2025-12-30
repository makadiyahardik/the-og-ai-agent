'use client';

import { useState } from 'react';

export default function HabitTracker({
  habits = [],
  onComplete,
  onAddHabit
}) {
  const [completedToday, setCompletedToday] = useState(new Set());

  const handleComplete = (habit) => {
    const newCompleted = new Set(completedToday);
    if (newCompleted.has(habit.id)) {
      newCompleted.delete(habit.id);
    } else {
      newCompleted.add(habit.id);
      if (onComplete) onComplete(habit);
    }
    setCompletedToday(newCompleted);
  };

  const getStreakEmoji = (streak) => {
    if (streak >= 30) return '&#x1F525;'; // Fire
    if (streak >= 14) return '&#x2B50;'; // Star
    if (streak >= 7) return '&#x1F31F;'; // Glowing star
    if (streak >= 3) return '&#x26A1;'; // Lightning
    return '&#x1F331;'; // Seedling
  };

  const getTimeIcon = (timeOfDay) => {
    const icons = {
      morning: '&#x1F305;',
      afternoon: '&#x2600;',
      evening: '&#x1F307;',
      anytime: '&#x1F552;'
    };
    return icons[timeOfDay] || icons.anytime;
  };

  if (habits.length === 0) {
    return (
      <div className="bg-[#1e1e1e] rounded-xl p-6 my-4 text-center animate-fadeIn">
        <div className="text-4xl mb-3">&#x1F4AA;</div>
        <h3 className="text-white font-medium mb-2">No Habits Yet</h3>
        <p className="text-gray-400 text-sm mb-4">
          Build powerful habits that align with your goals. Start small, stay consistent.
        </p>
        {onAddHabit && (
          <button
            onClick={onAddHabit}
            className="px-4 py-2 bg-[#10a37f] text-white rounded-lg text-sm font-medium hover:bg-[#1a7f64] transition-colors"
          >
            Create First Habit
          </button>
        )}
      </div>
    );
  }

  // Group habits by time of day
  const groupedHabits = habits.reduce((acc, habit) => {
    const time = habit.time_of_day || 'anytime';
    if (!acc[time]) acc[time] = [];
    acc[time].push(habit);
    return acc;
  }, {});

  const timeOrder = ['morning', 'afternoon', 'evening', 'anytime'];

  return (
    <div className="bg-[#1e1e1e] rounded-xl p-5 my-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F4AA;</span>
          <h3 className="text-white font-semibold">Daily Habits</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {completedToday.size}/{habits.length} today
          </span>
          {onAddHabit && (
            <button
              onClick={onAddHabit}
              className="p-1 text-gray-500 hover:text-[#10a37f] transition-colors"
              title="Add habit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="#2a2a2a"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="#10a37f"
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${(completedToday.size / habits.length) * 226} 226`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {Math.round((completedToday.size / habits.length) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Habits by Time */}
      <div className="space-y-4">
        {timeOrder.map(time => {
          const timeHabits = groupedHabits[time];
          if (!timeHabits || timeHabits.length === 0) return null;

          return (
            <div key={time}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-sm"
                  dangerouslySetInnerHTML={{ __html: getTimeIcon(time) }}
                />
                <span className="text-xs text-gray-500 uppercase">{time}</span>
              </div>

              <div className="space-y-2">
                {timeHabits.map(habit => {
                  const isCompleted = completedToday.has(habit.id);

                  return (
                    <div
                      key={habit.id}
                      onClick={() => handleComplete(habit)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        isCompleted
                          ? 'bg-[#10a37f]/20 border border-[#10a37f]'
                          : 'bg-[#2a2a2a] border border-transparent hover:border-gray-600'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'border-[#10a37f] bg-[#10a37f]'
                          : 'border-gray-500 hover:border-gray-400'
                      }`}>
                        {isCompleted && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Habit Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                          {habit.title}
                        </h4>
                        {habit.cue && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            After: {habit.cue}
                          </p>
                        )}
                      </div>

                      {/* Streak */}
                      {habit.streak_current > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <span dangerouslySetInnerHTML={{ __html: getStreakEmoji(habit.streak_current) }} />
                          <span className="text-gray-400">{habit.streak_current}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Streak Summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Current streaks:</span>
          <div className="flex items-center gap-3">
            {habits
              .filter(h => h.streak_current > 0)
              .sort((a, b) => b.streak_current - a.streak_current)
              .slice(0, 3)
              .map(h => (
                <span key={h.id} className="flex items-center gap-1 text-gray-300">
                  <span dangerouslySetInnerHTML={{ __html: getStreakEmoji(h.streak_current) }} />
                  {h.streak_current}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
