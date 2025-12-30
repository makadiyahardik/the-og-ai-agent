'use client';

import { useState } from 'react';

export default function RelationshipCard({
  name,
  relationshipType = 'professional',
  company,
  role,
  email,
  avatarUrl,
  lastInteraction,
  interactionFrequency = 30,
  notes = [],
  tags = [],
  importance = 'medium',
  onConnect,
  onAddNote,
  onViewHistory
}) {
  const [showNotes, setShowNotes] = useState(false);

  const daysSinceInteraction = lastInteraction
    ? Math.floor((new Date() - new Date(lastInteraction)) / (1000 * 60 * 60 * 24))
    : null;

  const isOverdue = daysSinceInteraction !== null && daysSinceInteraction > interactionFrequency;

  const typeIcons = {
    professional: '&#x1F4BC;',
    personal: '&#x1F46B;',
    family: '&#x1F3E0;',
    mentor: '&#x1F393;',
    mentee: '&#x1F31F;',
    acquaintance: '&#x1F44B;'
  };

  const importanceColors = {
    low: 'border-gray-600',
    medium: 'border-blue-500',
    high: 'border-[#10a37f]'
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`bg-[#1e1e1e] rounded-xl border-l-4 ${importanceColors[importance]} p-4 my-3 animate-fadeIn`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10a37f] to-[#1a7f64] flex items-center justify-center text-white font-semibold">
              {getInitials(name)}
            </div>
          )}
          {isOverdue && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-medium truncate">{name}</h4>
            <span
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: typeIcons[relationshipType] }}
            />
          </div>

          {(role || company) && (
            <p className="text-gray-400 text-sm">
              {role}{role && company && ' at '}{company}
            </p>
          )}

          {/* Last Interaction */}
          <div className={`mt-2 text-xs flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-gray-500'}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {daysSinceInteraction !== null ? (
              <span>
                {isOverdue ? (
                  <>Overdue: {daysSinceInteraction} days since last contact</>
                ) : (
                  <>Last contact: {daysSinceInteraction} days ago</>
                )}
              </span>
            ) : (
              <span>No interactions recorded</span>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 4).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-[#2a2a2a] text-gray-400 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 4 && (
                <span className="text-xs text-gray-500">+{tags.length - 4}</span>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-1">
          {email && (
            <a
              href={`mailto:${email}`}
              className="p-2 text-gray-500 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
              title="Send email"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          )}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="p-2 text-gray-500 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-colors"
            title="View notes"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Notes Section */}
      {showNotes && notes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h5 className="text-xs text-gray-500 mb-2">INTERACTION HISTORY</h5>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {notes.slice(0, 5).map((note, i) => (
              <div key={i} className="bg-[#2a2a2a] rounded-lg p-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <span className="capitalize">{note.type}</span>
                  <span>&#x2022;</span>
                  <span>{new Date(note.date).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-300">{note.summary}</p>
                {note.followUp && (
                  <p className="text-yellow-400/80 text-xs mt-1">
                    Follow-up: {note.followUp}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between">
        <button
          onClick={onAddNote}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Note
        </button>

        {onConnect && (
          <button
            onClick={onConnect}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isOverdue
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                : 'bg-[#10a37f]/20 text-[#10a37f] hover:bg-[#10a37f]/30'
            }`}
          >
            {isOverdue ? 'Reconnect Now' : 'Log Interaction'}
          </button>
        )}
      </div>
    </div>
  );
}

// Relationships Panel
export function RelationshipsPanel({
  relationships = [],
  title = 'Your Network',
  showOverdueOnly = false,
  onConnect,
  onAddNote
}) {
  const filteredRelationships = showOverdueOnly
    ? relationships.filter(r => {
        const days = Math.floor((new Date() - new Date(r.last_interaction)) / (1000 * 60 * 60 * 24));
        return days > r.interaction_frequency;
      })
    : relationships;

  if (filteredRelationships.length === 0) {
    return (
      <div className="bg-[#1e1e1e] rounded-xl p-6 my-4 text-center animate-fadeIn">
        <div className="text-4xl mb-3">&#x1F465;</div>
        <h3 className="text-white font-medium mb-2">
          {showOverdueOnly ? 'All Caught Up!' : 'No Relationships Yet'}
        </h3>
        <p className="text-gray-400 text-sm">
          {showOverdueOnly
            ? "You're up to date with your network."
            : 'Tell me about the important people in your life and I\'ll help you nurture those relationships.'}
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F465;</span>
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-gray-500">
          {filteredRelationships.length} {showOverdueOnly ? 'need attention' : 'connections'}
        </span>
      </div>

      <div className="space-y-2">
        {filteredRelationships.map((rel, index) => (
          <RelationshipCard
            key={rel.id || index}
            name={rel.name}
            relationshipType={rel.relationship_type}
            company={rel.company}
            role={rel.role}
            email={rel.email}
            avatarUrl={rel.avatar_url}
            lastInteraction={rel.last_interaction}
            interactionFrequency={rel.interaction_frequency}
            notes={rel.notes}
            tags={rel.tags}
            importance={rel.importance}
            onConnect={() => onConnect?.(rel)}
            onAddNote={() => onAddNote?.(rel)}
          />
        ))}
      </div>
    </div>
  );
}
