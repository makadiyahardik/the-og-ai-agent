import { supabase } from '../supabase';

/**
 * TheoGAI Memory System
 * Persistent context storage for user's life data
 */

// ============================================
// USER CONTEXT & PROFILE
// ============================================

export async function getUserContext(userId) {
  const { data, error } = await supabase
    .from('theogai_context')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user context:', error);
    return null;
  }
  return data;
}

export async function upsertUserContext(userId, context) {
  const { data, error } = await supabase
    .from('theogai_context')
    .upsert({
      user_id: userId,
      ...context,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting user context:', error);
    return null;
  }
  return data;
}

// ============================================
// GOALS & OBJECTIVES
// ============================================

export async function getGoals(userId, status = null) {
  let query = supabase
    .from('theogai_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
  return data || [];
}

export async function createGoal(userId, goal) {
  const { data, error } = await supabase
    .from('theogai_goals')
    .insert({
      user_id: userId,
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe, // 'yearly', 'quarterly', 'monthly', 'weekly', 'daily'
      parent_goal_id: goal.parentGoalId || null,
      status: 'active',
      progress: 0,
      target_date: goal.targetDate,
      milestones: goal.milestones || [],
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating goal:', error);
    return null;
  }
  return data;
}

export async function updateGoal(goalId, updates) {
  const { data, error } = await supabase
    .from('theogai_goals')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', goalId)
    .select()
    .single();

  if (error) {
    console.error('Error updating goal:', error);
    return null;
  }
  return data;
}

// ============================================
// DECISIONS & CHOICES
// ============================================

export async function getDecisions(userId, limit = 10) {
  const { data, error } = await supabase
    .from('theogai_decisions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching decisions:', error);
    return [];
  }
  return data || [];
}

export async function createDecision(userId, decision) {
  const { data, error } = await supabase
    .from('theogai_decisions')
    .insert({
      user_id: userId,
      title: decision.title,
      description: decision.description,
      options: decision.options || [],
      pros_cons: decision.prosCons || {},
      chosen_option: decision.chosenOption || null,
      outcome: decision.outcome || null,
      status: decision.status || 'pending', // 'pending', 'decided', 'completed'
      importance: decision.importance || 'medium', // 'low', 'medium', 'high', 'critical'
      deadline: decision.deadline,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating decision:', error);
    return null;
  }
  return data;
}

export async function updateDecision(decisionId, updates) {
  const { data, error } = await supabase
    .from('theogai_decisions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', decisionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating decision:', error);
    return null;
  }
  return data;
}

// ============================================
// RELATIONSHIPS & CONTACTS
// ============================================

export async function getRelationships(userId, limit = 50) {
  const { data, error } = await supabase
    .from('theogai_relationships')
    .select('*')
    .eq('user_id', userId)
    .order('last_interaction', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching relationships:', error);
    return [];
  }
  return data || [];
}

export async function createRelationship(userId, relationship) {
  const { data, error } = await supabase
    .from('theogai_relationships')
    .insert({
      user_id: userId,
      name: relationship.name,
      relationship_type: relationship.type, // 'professional', 'personal', 'family', 'mentor', 'mentee'
      company: relationship.company,
      role: relationship.role,
      email: relationship.email,
      phone: relationship.phone,
      linkedin_url: relationship.linkedinUrl,
      notes: relationship.notes || [],
      tags: relationship.tags || [],
      importance: relationship.importance || 'medium',
      last_interaction: relationship.lastInteraction || new Date().toISOString(),
      interaction_frequency: relationship.frequency || 30, // days
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating relationship:', error);
    return null;
  }
  return data;
}

export async function updateRelationship(relationshipId, updates) {
  const { data, error } = await supabase
    .from('theogai_relationships')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', relationshipId)
    .select()
    .single();

  if (error) {
    console.error('Error updating relationship:', error);
    return null;
  }
  return data;
}

export async function addInteraction(relationshipId, interaction) {
  // First get the current relationship
  const { data: rel, error: fetchError } = await supabase
    .from('theogai_relationships')
    .select('notes')
    .eq('id', relationshipId)
    .single();

  if (fetchError) {
    console.error('Error fetching relationship:', fetchError);
    return null;
  }

  const notes = rel.notes || [];
  notes.unshift({
    date: new Date().toISOString(),
    type: interaction.type, // 'meeting', 'call', 'email', 'social', 'other'
    summary: interaction.summary,
    followUp: interaction.followUp
  });

  return updateRelationship(relationshipId, {
    notes: notes.slice(0, 20), // Keep last 20 interactions
    last_interaction: new Date().toISOString()
  });
}

// ============================================
// INSIGHTS & PATTERNS
// ============================================

export async function getInsights(userId, limit = 10) {
  const { data, error } = await supabase
    .from('theogai_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching insights:', error);
    return [];
  }
  return data || [];
}

export async function createInsight(userId, insight) {
  const { data, error } = await supabase
    .from('theogai_insights')
    .insert({
      user_id: userId,
      type: insight.type, // 'reminder', 'suggestion', 'warning', 'celebration', 'opportunity'
      title: insight.title,
      description: insight.description,
      action: insight.action,
      priority: insight.priority || 'medium',
      related_entity_type: insight.relatedType, // 'goal', 'decision', 'relationship'
      related_entity_id: insight.relatedId,
      dismissed: false,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating insight:', error);
    return null;
  }
  return data;
}

export async function dismissInsight(insightId) {
  const { error } = await supabase
    .from('theogai_insights')
    .update({ dismissed: true })
    .eq('id', insightId);

  if (error) {
    console.error('Error dismissing insight:', error);
    return false;
  }
  return true;
}

// ============================================
// CONVERSATION MEMORY
// ============================================

export async function getConversationMemory(userId, limit = 50) {
  const { data, error } = await supabase
    .from('theogai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching conversation memory:', error);
    return [];
  }
  return data || [];
}

export async function saveConversationTurn(userId, turn) {
  const { data, error } = await supabase
    .from('theogai_conversations')
    .insert({
      user_id: userId,
      role: turn.role, // 'user' or 'assistant'
      content: turn.content,
      ui_components: turn.uiComponents || [], // Generated UI component types
      extracted_entities: turn.entities || {}, // Extracted goals, decisions, etc.
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving conversation:', error);
    return null;
  }
  return data;
}

// ============================================
// AGGREGATE CONTEXT BUILDER
// ============================================

export async function buildFullContext(userId) {
  const [
    userContext,
    goals,
    decisions,
    relationships,
    insights,
    recentConversations
  ] = await Promise.all([
    getUserContext(userId),
    getGoals(userId, 'active'),
    getDecisions(userId, 5),
    getRelationships(userId, 20),
    getInsights(userId, 5),
    getConversationMemory(userId, 10)
  ]);

  return {
    profile: userContext,
    activeGoals: goals,
    pendingDecisions: decisions.filter(d => d.status === 'pending'),
    recentDecisions: decisions.filter(d => d.status === 'decided'),
    keyRelationships: relationships.filter(r => r.importance === 'high'),
    dueForReconnection: relationships.filter(r => {
      const daysSinceInteraction = Math.floor(
        (new Date() - new Date(r.last_interaction)) / (1000 * 60 * 60 * 24)
      );
      return daysSinceInteraction > r.interaction_frequency;
    }),
    activeInsights: insights,
    recentTopics: recentConversations.slice(0, 5).map(c => c.content.substring(0, 100))
  };
}
