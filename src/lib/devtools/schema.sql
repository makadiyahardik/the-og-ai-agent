-- DevTools Suite Database Schema
-- 3 Products: DevFlow, PRPilot, AutoStandup
-- Run in Supabase SQL Editor

-- =============================================
-- SHARED: User Preferences & Integrations
-- =============================================

CREATE TABLE IF NOT EXISTS devtools_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  github_username TEXT,
  github_access_token TEXT, -- encrypted
  slack_user_id TEXT,
  slack_access_token TEXT, -- encrypted
  timezone TEXT DEFAULT 'UTC',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS devtools_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  provider TEXT DEFAULT 'github', -- github, gitlab, bitbucket
  is_indexed BOOLEAN DEFAULT FALSE,
  last_indexed_at TIMESTAMPTZ,
  index_status TEXT DEFAULT 'pending', -- pending, indexing, complete, failed
  file_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, repo_url)
);

-- =============================================
-- DEVFLOW: Context Memory System
-- =============================================

-- Coding sessions (when developer is actively working)
CREATE TABLE IF NOT EXISTS devflow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  summary TEXT, -- AI-generated summary
  status TEXT DEFAULT 'active', -- active, paused, completed
  metadata JSONB DEFAULT '{}'
);

-- Files touched during session
CREATE TABLE IF NOT EXISTS devflow_file_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES devflow_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  repo_name TEXT,
  event_type TEXT NOT NULL, -- opened, edited, saved, closed
  lines_changed INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  content_snapshot TEXT, -- optional: key parts of file
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Errors and issues encountered
CREATE TABLE IF NOT EXISTS devflow_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES devflow_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  error_message TEXT NOT NULL,
  error_type TEXT, -- syntax, runtime, build, test
  file_path TEXT,
  line_number INTEGER,
  stack_trace TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Terminal commands executed
CREATE TABLE IF NOT EXISTS devflow_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES devflow_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  command TEXT NOT NULL,
  output TEXT, -- truncated output
  exit_code INTEGER,
  duration_ms INTEGER,
  directory TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Search queries (in IDE, browser, docs)
CREATE TABLE IF NOT EXISTS devflow_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES devflow_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  source TEXT, -- ide, google, stackoverflow, docs
  url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated context snapshots (for restoring flow)
CREATE TABLE IF NOT EXISTS devflow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES devflow_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  snapshot_type TEXT DEFAULT 'auto', -- auto, manual, pre-meeting
  context_summary TEXT NOT NULL, -- AI summary of what user was doing
  key_files JSONB DEFAULT '[]', -- important files with snippets
  current_hypothesis TEXT, -- what the user was trying to solve
  next_steps TEXT, -- suggested next actions
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRPILOT: AI Code Review
-- =============================================

-- Indexed code chunks for RAG
CREATE TABLE IF NOT EXISTS prpilot_code_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID REFERENCES devtools_repos(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  language TEXT,
  symbols JSONB DEFAULT '[]', -- functions, classes, variables
  embedding VECTOR(1536), -- for similarity search (if pg_vector enabled)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, file_path, chunk_index)
);

-- Pull request reviews
CREATE TABLE IF NOT EXISTS prpilot_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  repo_id UUID REFERENCES devtools_repos(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  pr_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, reviewing, completed, failed
  files_changed INTEGER DEFAULT 0,
  additions INTEGER DEFAULT 0,
  deletions INTEGER DEFAULT 0,
  review_summary TEXT,
  issues_found JSONB DEFAULT '[]', -- array of issues
  suggestions JSONB DEFAULT '[]', -- array of suggestions
  score INTEGER, -- 1-10 quality score
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review comments
CREATE TABLE IF NOT EXISTS prpilot_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES prpilot_reviews(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  comment_type TEXT, -- bug, security, style, performance, suggestion
  severity TEXT DEFAULT 'info', -- info, warning, error, critical
  message TEXT NOT NULL,
  suggestion TEXT, -- code suggestion if applicable
  accepted BOOLEAN, -- user feedback
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team coding standards/rules
CREATE TABLE IF NOT EXISTS prpilot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  repo_id UUID REFERENCES devtools_repos(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_pattern TEXT, -- regex or natural language
  severity TEXT DEFAULT 'warning',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUTOSTANDUP: Daily Standup Generator
-- =============================================

-- Daily activity summary
CREATE TABLE IF NOT EXISTS autostandup_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  commits_count INTEGER DEFAULT 0,
  prs_opened INTEGER DEFAULT 0,
  prs_merged INTEGER DEFAULT 0,
  prs_reviewed INTEGER DEFAULT 0,
  files_changed INTEGER DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  standup_text TEXT, -- AI-generated standup
  raw_activities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Individual activities tracked
CREATE TABLE IF NOT EXISTS autostandup_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- commit, pr_open, pr_merge, pr_review, meeting, slack_mention
  activity_title TEXT,
  activity_url TEXT,
  activity_details JSONB DEFAULT '{}',
  source TEXT, -- github, slack, calendar
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Standup templates
CREATE TABLE IF NOT EXISTS autostandup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  template_format TEXT NOT NULL, -- The template with placeholders
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_devflow_sessions_user ON devflow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_devflow_sessions_status ON devflow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_devflow_file_events_session ON devflow_file_events(session_id);
CREATE INDEX IF NOT EXISTS idx_devflow_errors_session ON devflow_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_devflow_snapshots_session ON devflow_snapshots(session_id);

CREATE INDEX IF NOT EXISTS idx_prpilot_code_chunks_repo ON prpilot_code_chunks(repo_id);
CREATE INDEX IF NOT EXISTS idx_prpilot_reviews_repo ON prpilot_reviews(repo_id);
CREATE INDEX IF NOT EXISTS idx_prpilot_reviews_user ON prpilot_reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_autostandup_daily_user ON autostandup_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_autostandup_daily_date ON autostandup_daily(date);
CREATE INDEX IF NOT EXISTS idx_autostandup_activities_user ON autostandup_activities(user_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE devtools_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devtools_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE devflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devflow_file_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE devflow_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE devflow_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE devflow_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE devflow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE prpilot_code_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prpilot_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE prpilot_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prpilot_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE autostandup_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE autostandup_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE autostandup_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users own their data" ON devtools_users FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their repos" ON devtools_repos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their sessions" ON devflow_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their file events" ON devflow_file_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their errors" ON devflow_errors FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their commands" ON devflow_commands FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their searches" ON devflow_searches FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their snapshots" ON devflow_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their reviews" ON prpilot_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their rules" ON prpilot_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their standups" ON autostandup_daily FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their activities" ON autostandup_activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their templates" ON autostandup_templates FOR ALL USING (auth.uid() = user_id);
