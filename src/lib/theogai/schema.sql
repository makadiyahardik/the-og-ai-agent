-- TheoGAI Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- User Context & Profile
CREATE TABLE IF NOT EXISTS theogai_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  bio TEXT,
  values TEXT[], -- Core values
  life_areas JSONB DEFAULT '{}', -- career, health, relationships, etc.
  preferences JSONB DEFAULT '{}', -- UI preferences, communication style
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Goals & Objectives (Hierarchical)
CREATE TABLE IF NOT EXISTS theogai_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_goal_id UUID REFERENCES theogai_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  timeframe TEXT CHECK (timeframe IN ('yearly', 'quarterly', 'monthly', 'weekly', 'daily')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  target_date DATE,
  milestones JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decisions & Choices
CREATE TABLE IF NOT EXISTS theogai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  options JSONB DEFAULT '[]', -- Array of options with details
  pros_cons JSONB DEFAULT '{}', -- Structured pros/cons for each option
  chosen_option TEXT,
  outcome TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'decided', 'completed', 'revisiting')),
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high', 'critical')),
  deadline DATE,
  decision_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships & Contacts
CREATE TABLE IF NOT EXISTS theogai_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship_type TEXT CHECK (relationship_type IN ('professional', 'personal', 'family', 'mentor', 'mentee', 'acquaintance')),
  company TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  avatar_url TEXT,
  notes JSONB DEFAULT '[]', -- Array of interaction notes
  tags TEXT[],
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  interaction_frequency INTEGER DEFAULT 30, -- Target days between interactions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proactive Insights
CREATE TABLE IF NOT EXISTS theogai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('reminder', 'suggestion', 'warning', 'celebration', 'opportunity', 'reflection')),
  title TEXT NOT NULL,
  description TEXT,
  action TEXT, -- Suggested action
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  related_entity_type TEXT, -- 'goal', 'decision', 'relationship'
  related_entity_id UUID,
  dismissed BOOLEAN DEFAULT FALSE,
  acted_on BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation Memory
CREATE TABLE IF NOT EXISTS theogai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID, -- Group related messages
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  ui_components TEXT[], -- Generated UI component types
  extracted_entities JSONB DEFAULT '{}', -- Entities extracted from conversation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habits & Routines
CREATE TABLE IF NOT EXISTS theogai_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES theogai_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'weekdays', 'weekends', 'custom')),
  custom_days INTEGER[], -- For custom frequency (0=Sun, 6=Sat)
  time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'anytime'
  cue TEXT, -- Trigger/reminder cue
  reward TEXT, -- Reward after completion
  streak_current INTEGER DEFAULT 0,
  streak_best INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit Completions
CREATE TABLE IF NOT EXISTS theogai_habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES theogai_habits(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_user ON theogai_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON theogai_goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON theogai_goals(status);
CREATE INDEX IF NOT EXISTS idx_decisions_user ON theogai_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON theogai_decisions(status);
CREATE INDEX IF NOT EXISTS idx_relationships_user ON theogai_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_interaction ON theogai_relationships(last_interaction);
CREATE INDEX IF NOT EXISTS idx_insights_user ON theogai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_dismissed ON theogai_insights(dismissed);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON theogai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON theogai_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_habits_user ON theogai_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit ON theogai_habit_completions(habit_id);

-- Enable Row Level Security
ALTER TABLE theogai_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE theogai_habit_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can CRUD own context" ON theogai_context FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own goals" ON theogai_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own decisions" ON theogai_decisions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own relationships" ON theogai_relationships FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own insights" ON theogai_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own conversations" ON theogai_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own habits" ON theogai_habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own habit completions" ON theogai_habit_completions
  FOR ALL USING (
    habit_id IN (SELECT id FROM theogai_habits WHERE user_id = auth.uid())
  );
