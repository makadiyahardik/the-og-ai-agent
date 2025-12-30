'use client';

export default function InsightCard({
  type = 'suggestion',
  title,
  description,
  action,
  priority = 'medium',
  relatedEntity,
  onAction,
  onDismiss
}) {
  const typeConfig = {
    reminder: {
      icon: '&#x23F0;',
      gradient: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/50',
      badge: 'bg-blue-500/20 text-blue-300'
    },
    suggestion: {
      icon: '&#x1F4A1;',
      gradient: 'from-yellow-500/20 to-yellow-600/10',
      border: 'border-yellow-500/50',
      badge: 'bg-yellow-500/20 text-yellow-300'
    },
    warning: {
      icon: '&#x26A0;',
      gradient: 'from-red-500/20 to-red-600/10',
      border: 'border-red-500/50',
      badge: 'bg-red-500/20 text-red-300'
    },
    celebration: {
      icon: '&#x1F389;',
      gradient: 'from-green-500/20 to-green-600/10',
      border: 'border-green-500/50',
      badge: 'bg-green-500/20 text-green-300'
    },
    opportunity: {
      icon: '&#x1F31F;',
      gradient: 'from-purple-500/20 to-purple-600/10',
      border: 'border-purple-500/50',
      badge: 'bg-purple-500/20 text-purple-300'
    },
    reflection: {
      icon: '&#x1F914;',
      gradient: 'from-cyan-500/20 to-cyan-600/10',
      border: 'border-cyan-500/50',
      badge: 'bg-cyan-500/20 text-cyan-300'
    }
  };

  const config = typeConfig[type] || typeConfig.suggestion;

  return (
    <div className={`bg-gradient-to-r ${config.gradient} rounded-xl border ${config.border} p-4 my-3 animate-fadeIn`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-2xl" dangerouslySetInnerHTML={{ __html: config.icon }} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
              {type.toUpperCase()}
            </span>
            {priority === 'urgent' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 animate-pulse">
                URGENT
              </span>
            )}
          </div>

          <h4 className="text-white font-medium">{title}</h4>

          {description && (
            <p className="text-gray-300 text-sm mt-1">{description}</p>
          )}

          {relatedEntity && (
            <div className="mt-2 text-xs text-gray-400">
              Related to: <span className="text-gray-300">{relatedEntity}</span>
            </div>
          )}

          {/* Action Button */}
          {action && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={onAction}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                {action}
              </button>

              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss X */}
        {onDismiss && !action && (
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Multiple insights container
export function InsightsPanel({ insights = [], onAction, onDismiss }) {
  if (insights.length === 0) return null;

  return (
    <div className="my-4 animate-fadeIn">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">&#x1F4E1;</span>
        <h3 className="text-white font-semibold">Proactive Insights</h3>
        <span className="text-xs text-gray-500">Personalized for you</span>
      </div>

      <div className="space-y-2">
        {insights.map((insight, index) => (
          <InsightCard
            key={insight.id || index}
            {...insight}
            onAction={() => onAction?.(insight)}
            onDismiss={() => onDismiss?.(insight)}
          />
        ))}
      </div>
    </div>
  );
}
