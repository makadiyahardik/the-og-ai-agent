/**
 * DevFlow Service Layer
 * Context Memory System for Developer Flow State
 *
 * Handles session management, event logging, context snapshots,
 * and AI-powered context restoration.
 */

import { supabase } from '../supabase';
import Groq from 'groq-sdk';

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// =============================================
// ERROR HANDLING
// =============================================

class DevFlowError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DevFlowError';
    this.code = code;
    this.details = details;
  }
}

function handleSupabaseError(error, operation) {
  console.error(`DevFlow ${operation} error:`, error);
  throw new DevFlowError(
    `Failed to ${operation}: ${error.message}`,
    error.code || 'SUPABASE_ERROR',
    error.details
  );
}

function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new DevFlowError('Valid userId is required', 'INVALID_USER_ID');
  }
}

function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new DevFlowError('Valid sessionId is required', 'INVALID_SESSION_ID');
  }
}

// =============================================
// SESSION MANAGEMENT
// =============================================

/**
 * Start a new coding session for a user
 * @param {string} userId - The user's UUID
 * @param {object} metadata - Optional metadata for the session
 * @returns {Promise<object>} The created session
 */
export async function startSession(userId, metadata = {}) {
  validateUserId(userId);

  // Check for existing active session
  const existingSession = await getActiveSession(userId);
  if (existingSession) {
    // End the existing session before starting a new one
    await endSession(existingSession.id);
  }

  const { data, error } = await supabase
    .from('devflow_sessions')
    .insert({
      user_id: userId,
      status: 'active',
      metadata: {
        ...metadata,
        started_from: metadata.started_from || 'manual',
        user_agent: metadata.user_agent || null,
      },
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'start session');
  }

  return data;
}

/**
 * End an active session and calculate duration
 * @param {string} sessionId - The session UUID
 * @param {object} options - Optional end session options
 * @returns {Promise<object>} The updated session
 */
export async function endSession(sessionId, options = {}) {
  validateSessionId(sessionId);

  // Get the session to calculate duration
  const { data: session, error: fetchError } = await supabase
    .from('devflow_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (fetchError) {
    handleSupabaseError(fetchError, 'fetch session for ending');
  }

  if (!session) {
    throw new DevFlowError('Session not found', 'SESSION_NOT_FOUND');
  }

  if (session.status === 'completed') {
    return session; // Already ended
  }

  // Calculate duration in minutes
  const startedAt = new Date(session.started_at);
  const endedAt = new Date();
  const durationMinutes = Math.round((endedAt - startedAt) / (1000 * 60));

  // Generate summary if requested and session has events
  let summary = session.summary;
  if (options.generateSummary !== false) {
    try {
      const context = await restoreContext(sessionId);
      if (context.events.length > 0) {
        summary = await generateContextSummary(context.events);
      }
    } catch (summaryError) {
      console.warn('Failed to generate session summary:', summaryError.message);
    }
  }

  const { data, error } = await supabase
    .from('devflow_sessions')
    .update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      status: 'completed',
      summary,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'end session');
  }

  return data;
}

/**
 * Get the current active session for a user
 * @param {string} userId - The user's UUID
 * @returns {Promise<object|null>} The active session or null
 */
export async function getActiveSession(userId) {
  validateUserId(userId);

  const { data, error } = await supabase
    .from('devflow_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    handleSupabaseError(error, 'get active session');
  }

  return data;
}

/**
 * Get session history for a user
 * @param {string} userId - The user's UUID
 * @param {number} limit - Maximum number of sessions to return
 * @returns {Promise<object[]>} Array of sessions
 */
export async function getSessions(userId, limit = 10) {
  validateUserId(userId);

  const { data, error } = await supabase
    .from('devflow_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    handleSupabaseError(error, 'get sessions');
  }

  return data || [];
}

/**
 * Pause an active session
 * @param {string} sessionId - The session UUID
 * @returns {Promise<object>} The updated session
 */
export async function pauseSession(sessionId) {
  validateSessionId(sessionId);

  const { data, error } = await supabase
    .from('devflow_sessions')
    .update({ status: 'paused' })
    .eq('id', sessionId)
    .eq('status', 'active')
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'pause session');
  }

  return data;
}

/**
 * Resume a paused session
 * @param {string} sessionId - The session UUID
 * @returns {Promise<object>} The updated session
 */
export async function resumeSession(sessionId) {
  validateSessionId(sessionId);

  const { data, error } = await supabase
    .from('devflow_sessions')
    .update({ status: 'active' })
    .eq('id', sessionId)
    .eq('status', 'paused')
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'resume session');
  }

  return data;
}

// =============================================
// EVENT LOGGING
// =============================================

/**
 * Log a file event (open, edit, save, close)
 * @param {string} sessionId - The session UUID
 * @param {object} event - The file event details
 * @returns {Promise<object>} The created event record
 */
export async function logFileEvent(sessionId, event) {
  validateSessionId(sessionId);

  if (!event || !event.file_path || !event.event_type) {
    throw new DevFlowError(
      'File event must include file_path and event_type',
      'INVALID_EVENT'
    );
  }

  const validEventTypes = ['opened', 'edited', 'saved', 'closed'];
  if (!validEventTypes.includes(event.event_type)) {
    throw new DevFlowError(
      `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}`,
      'INVALID_EVENT_TYPE'
    );
  }

  // Get user_id from session
  const { data: session, error: sessionError } = await supabase
    .from('devflow_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    handleSupabaseError(sessionError, 'get session for file event');
  }

  const { data, error } = await supabase
    .from('devflow_file_events')
    .insert({
      session_id: sessionId,
      user_id: session.user_id,
      file_path: event.file_path,
      repo_name: event.repo_name || null,
      event_type: event.event_type,
      lines_changed: event.lines_changed || 0,
      time_spent_seconds: event.time_spent_seconds || 0,
      content_snapshot: event.content_snapshot || null,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'log file event');
  }

  return data;
}

/**
 * Log an error encountered during development
 * @param {string} sessionId - The session UUID
 * @param {object} errorData - The error details
 * @returns {Promise<object>} The created error record
 */
export async function logError(sessionId, errorData) {
  validateSessionId(sessionId);

  if (!errorData || !errorData.error_message) {
    throw new DevFlowError(
      'Error data must include error_message',
      'INVALID_ERROR_DATA'
    );
  }

  // Get user_id from session
  const { data: session, error: sessionError } = await supabase
    .from('devflow_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    handleSupabaseError(sessionError, 'get session for error log');
  }

  const { data, error } = await supabase
    .from('devflow_errors')
    .insert({
      session_id: sessionId,
      user_id: session.user_id,
      error_message: errorData.error_message,
      error_type: errorData.error_type || 'runtime',
      file_path: errorData.file_path || null,
      line_number: errorData.line_number || null,
      stack_trace: errorData.stack_trace || null,
      resolved: errorData.resolved || false,
      resolution_notes: errorData.resolution_notes || null,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'log error');
  }

  return data;
}

/**
 * Mark an error as resolved
 * @param {string} errorId - The error UUID
 * @param {string} resolutionNotes - How it was resolved
 * @returns {Promise<object>} The updated error record
 */
export async function resolveError(errorId, resolutionNotes = null) {
  if (!errorId) {
    throw new DevFlowError('errorId is required', 'INVALID_ERROR_ID');
  }

  const { data, error } = await supabase
    .from('devflow_errors')
    .update({
      resolved: true,
      resolution_notes: resolutionNotes,
    })
    .eq('id', errorId)
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'resolve error');
  }

  return data;
}

/**
 * Log a terminal command
 * @param {string} sessionId - The session UUID
 * @param {object} command - The command details
 * @returns {Promise<object>} The created command record
 */
export async function logCommand(sessionId, command) {
  validateSessionId(sessionId);

  if (!command || !command.command) {
    throw new DevFlowError(
      'Command data must include command string',
      'INVALID_COMMAND_DATA'
    );
  }

  // Get user_id from session
  const { data: session, error: sessionError } = await supabase
    .from('devflow_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    handleSupabaseError(sessionError, 'get session for command log');
  }

  // Truncate output if too long
  const maxOutputLength = 5000;
  const truncatedOutput = command.output
    ? command.output.substring(0, maxOutputLength)
    : null;

  const { data, error } = await supabase
    .from('devflow_commands')
    .insert({
      session_id: sessionId,
      user_id: session.user_id,
      command: command.command,
      output: truncatedOutput,
      exit_code: command.exit_code ?? null,
      duration_ms: command.duration_ms || null,
      directory: command.directory || null,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'log command');
  }

  return data;
}

/**
 * Log a search query
 * @param {string} sessionId - The session UUID
 * @param {object} search - The search details
 * @returns {Promise<object>} The created search record
 */
export async function logSearch(sessionId, search) {
  validateSessionId(sessionId);

  if (!search || !search.query) {
    throw new DevFlowError(
      'Search data must include query string',
      'INVALID_SEARCH_DATA'
    );
  }

  // Get user_id from session
  const { data: session, error: sessionError } = await supabase
    .from('devflow_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    handleSupabaseError(sessionError, 'get session for search log');
  }

  const validSources = ['ide', 'google', 'stackoverflow', 'docs', 'github', 'other'];
  const source = validSources.includes(search.source) ? search.source : 'other';

  const { data, error } = await supabase
    .from('devflow_searches')
    .insert({
      session_id: sessionId,
      user_id: session.user_id,
      query: search.query,
      source,
      url: search.url || null,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'log search');
  }

  return data;
}

// =============================================
// CONTEXT SNAPSHOTS
// =============================================

/**
 * Create a context snapshot for a session
 * @param {string} sessionId - The session UUID
 * @param {object} options - Snapshot options
 * @returns {Promise<object>} The created snapshot
 */
export async function createSnapshot(sessionId, options = {}) {
  validateSessionId(sessionId);

  // Get session and its user_id
  const { data: session, error: sessionError } = await supabase
    .from('devflow_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single();

  if (sessionError) {
    handleSupabaseError(sessionError, 'get session for snapshot');
  }

  // Get all events for context
  const context = await restoreContext(sessionId);

  if (context.events.length === 0 && !options.allowEmpty) {
    throw new DevFlowError(
      'No events found for this session. Cannot create meaningful snapshot.',
      'NO_EVENTS'
    );
  }

  // Generate AI summary
  let contextSummary = 'No activity recorded in this session.';
  let currentHypothesis = null;
  let nextSteps = null;

  if (context.events.length > 0) {
    try {
      contextSummary = await generateContextSummary(context.events);

      if (context.errors.length > 0 || context.searches.length > 0) {
        currentHypothesis = await identifyHypothesis(
          context.errors,
          context.searches
        );
      }

      nextSteps = await generateNextSteps(context);
    } catch (aiError) {
      console.warn('AI generation failed, using fallback:', aiError.message);
      contextSummary = generateFallbackSummary(context);
    }
  }

  // Extract key files with snippets
  const keyFiles = extractKeyFiles(context.fileEvents);

  const { data, error } = await supabase
    .from('devflow_snapshots')
    .insert({
      session_id: sessionId,
      user_id: session.user_id,
      snapshot_type: options.type || 'auto',
      context_summary: contextSummary,
      key_files: keyFiles,
      current_hypothesis: currentHypothesis,
      next_steps: nextSteps,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseError(error, 'create snapshot');
  }

  return data;
}

/**
 * Get the most recent snapshot for a session
 * @param {string} sessionId - The session UUID
 * @returns {Promise<object|null>} The latest snapshot or null
 */
export async function getLatestSnapshot(sessionId) {
  validateSessionId(sessionId);

  const { data, error } = await supabase
    .from('devflow_snapshots')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    handleSupabaseError(error, 'get latest snapshot');
  }

  return data;
}

/**
 * Get all snapshots for a session
 * @param {string} sessionId - The session UUID
 * @returns {Promise<object[]>} Array of snapshots
 */
export async function getSnapshots(sessionId) {
  validateSessionId(sessionId);

  const { data, error } = await supabase
    .from('devflow_snapshots')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false });

  if (error) {
    handleSupabaseError(error, 'get snapshots');
  }

  return data || [];
}

/**
 * Restore full context for a session
 * @param {string} sessionId - The session UUID
 * @returns {Promise<object>} Complete session context
 */
export async function restoreContext(sessionId) {
  validateSessionId(sessionId);

  // Fetch all data in parallel
  const [
    sessionResult,
    fileEventsResult,
    errorsResult,
    commandsResult,
    searchesResult,
    snapshotsResult,
  ] = await Promise.all([
    supabase
      .from('devflow_sessions')
      .select('*')
      .eq('id', sessionId)
      .single(),
    supabase
      .from('devflow_file_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true }),
    supabase
      .from('devflow_errors')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true }),
    supabase
      .from('devflow_commands')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true }),
    supabase
      .from('devflow_searches')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true }),
    supabase
      .from('devflow_snapshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(1),
  ]);

  // Check for errors
  if (sessionResult.error) {
    handleSupabaseError(sessionResult.error, 'restore context - session');
  }

  const session = sessionResult.data;
  const fileEvents = fileEventsResult.data || [];
  const errors = errorsResult.data || [];
  const commands = commandsResult.data || [];
  const searches = searchesResult.data || [];
  const latestSnapshot = snapshotsResult.data?.[0] || null;

  // Combine all events into a unified timeline
  const events = [
    ...fileEvents.map((e) => ({ ...e, type: 'file' })),
    ...errors.map((e) => ({ ...e, type: 'error' })),
    ...commands.map((e) => ({ ...e, type: 'command' })),
    ...searches.map((e) => ({ ...e, type: 'search' })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    session,
    fileEvents,
    errors,
    commands,
    searches,
    events,
    latestSnapshot,
    stats: {
      totalEvents: events.length,
      filesOpened: new Set(fileEvents.map((e) => e.file_path)).size,
      errorsEncountered: errors.length,
      unresolvedErrors: errors.filter((e) => !e.resolved).length,
      commandsRun: commands.length,
      searchesMade: searches.length,
    },
  };
}

// =============================================
// AI INTEGRATION
// =============================================

/**
 * Generate a summary of session events using Groq
 * @param {object[]} events - Array of session events
 * @returns {Promise<string>} AI-generated summary
 */
export async function generateContextSummary(events) {
  if (!groq) {
    throw new DevFlowError('Groq API key not configured', 'GROQ_NOT_CONFIGURED');
  }

  if (!events || events.length === 0) {
    return 'No activity to summarize.';
  }

  // Prepare events for AI
  const eventSummary = prepareEventsForAI(events);

  const systemPrompt = `You are a developer productivity assistant that analyzes coding sessions.
Your job is to create concise, actionable summaries that help developers quickly restore their mental context.

Guidelines:
- Focus on WHAT the developer was working on and WHY
- Highlight the main files and their purposes
- Note any problems encountered and whether they were resolved
- Keep the summary under 200 words
- Use bullet points for clarity
- Be specific about file names and error messages when relevant`;

  const userPrompt = `Analyze this coding session activity and provide a context summary:

${eventSummary}

Create a brief summary that would help this developer pick up where they left off.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: GROQ_MODEL,
      temperature: 0.5,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || 'Unable to generate summary.';
  } catch (error) {
    console.error('Groq API error:', error);
    throw new DevFlowError(
      'Failed to generate context summary',
      'AI_GENERATION_FAILED',
      error.message
    );
  }
}

/**
 * Generate suggested next steps based on context
 * @param {object} context - Full session context
 * @returns {Promise<string>} AI-generated next steps
 */
export async function generateNextSteps(context) {
  if (!groq) {
    throw new DevFlowError('Groq API key not configured', 'GROQ_NOT_CONFIGURED');
  }

  const eventSummary = prepareEventsForAI(context.events);
  const unresolvedErrors = context.errors.filter((e) => !e.resolved);

  const systemPrompt = `You are a developer productivity assistant. Based on a coding session's activity,
suggest concrete next steps the developer should take when they resume work.

Guidelines:
- Be specific and actionable
- Prioritize unresolved errors/issues
- Suggest logical next files to work on
- Keep suggestions to 3-5 items
- Format as a numbered list`;

  const userPrompt = `Based on this coding session, suggest what the developer should do next:

Session Activity:
${eventSummary}

${unresolvedErrors.length > 0 ? `\nUnresolved Errors (${unresolvedErrors.length}):\n${unresolvedErrors.map((e) => `- ${e.error_message}`).join('\n')}` : ''}

Stats:
- Files opened: ${context.stats.filesOpened}
- Commands run: ${context.stats.commandsRun}
- Searches made: ${context.stats.searchesMade}

Provide 3-5 specific next steps:`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: GROQ_MODEL,
      temperature: 0.6,
      max_tokens: 400,
    });

    return completion.choices[0]?.message?.content || 'Unable to generate next steps.';
  } catch (error) {
    console.error('Groq API error:', error);
    throw new DevFlowError(
      'Failed to generate next steps',
      'AI_GENERATION_FAILED',
      error.message
    );
  }
}

/**
 * Identify what problem the user was trying to solve
 * @param {object[]} errors - Array of error events
 * @param {object[]} searches - Array of search events
 * @returns {Promise<string>} AI-identified hypothesis
 */
export async function identifyHypothesis(errors, searches) {
  if (!groq) {
    throw new DevFlowError('Groq API key not configured', 'GROQ_NOT_CONFIGURED');
  }

  if ((!errors || errors.length === 0) && (!searches || searches.length === 0)) {
    return null;
  }

  const systemPrompt = `You are a developer productivity assistant that analyzes developer behavior.
Based on errors encountered and searches made, identify what problem the developer was trying to solve.

Guidelines:
- Be concise (1-2 sentences)
- Focus on the core problem, not symptoms
- Use technical but clear language
- If uncertain, phrase as a hypothesis ("Likely trying to...")`;

  const errorList = errors?.length > 0
    ? `Errors encountered:\n${errors.map((e) => `- [${e.error_type || 'error'}] ${e.error_message}${e.file_path ? ` (in ${e.file_path})` : ''}`).join('\n')}`
    : '';

  const searchList = searches?.length > 0
    ? `Searches made:\n${searches.map((s) => `- "${s.query}" (${s.source})`).join('\n')}`
    : '';

  const userPrompt = `Identify what problem this developer was trying to solve:

${errorList}

${searchList}

What was the developer's main goal or problem?`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: GROQ_MODEL,
      temperature: 0.5,
      max_tokens: 150,
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Groq API error:', error);
    throw new DevFlowError(
      'Failed to identify hypothesis',
      'AI_GENERATION_FAILED',
      error.message
    );
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Prepare events for AI processing
 * @param {object[]} events - Array of events
 * @returns {string} Formatted event summary
 */
function prepareEventsForAI(events) {
  if (!events || events.length === 0) {
    return 'No events recorded.';
  }

  // Limit to most recent 50 events to avoid token limits
  const recentEvents = events.slice(-50);

  return recentEvents
    .map((event) => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      switch (event.type) {
        case 'file':
          return `[${time}] FILE: ${event.event_type} "${event.file_path}"${event.lines_changed > 0 ? ` (${event.lines_changed} lines changed)` : ''}`;
        case 'error':
          return `[${time}] ERROR: ${event.error_message}${event.file_path ? ` in ${event.file_path}` : ''}${event.resolved ? ' [RESOLVED]' : ''}`;
        case 'command':
          return `[${time}] COMMAND: ${event.command}${event.exit_code !== 0 && event.exit_code !== null ? ` (exit: ${event.exit_code})` : ''}`;
        case 'search':
          return `[${time}] SEARCH: "${event.query}" (${event.source})`;
        default:
          return `[${time}] ${event.type.toUpperCase()}: Activity logged`;
      }
    })
    .join('\n');
}

/**
 * Extract key files from file events
 * @param {object[]} fileEvents - Array of file events
 * @returns {object[]} Key files with metadata
 */
function extractKeyFiles(fileEvents) {
  if (!fileEvents || fileEvents.length === 0) {
    return [];
  }

  // Group by file path and calculate stats
  const fileStats = {};

  fileEvents.forEach((event) => {
    const path = event.file_path;
    if (!fileStats[path]) {
      fileStats[path] = {
        file_path: path,
        repo_name: event.repo_name,
        event_count: 0,
        lines_changed: 0,
        time_spent_seconds: 0,
        last_event: event.event_type,
        content_snippet: event.content_snapshot,
      };
    }
    fileStats[path].event_count++;
    fileStats[path].lines_changed += event.lines_changed || 0;
    fileStats[path].time_spent_seconds += event.time_spent_seconds || 0;
    fileStats[path].last_event = event.event_type;
    if (event.content_snapshot) {
      fileStats[path].content_snippet = event.content_snapshot;
    }
  });

  // Sort by activity level and return top 10
  return Object.values(fileStats)
    .sort((a, b) => b.event_count - a.event_count)
    .slice(0, 10);
}

/**
 * Generate a fallback summary when AI is unavailable
 * @param {object} context - Session context
 * @returns {string} Basic summary
 */
function generateFallbackSummary(context) {
  const parts = [];

  if (context.fileEvents.length > 0) {
    const uniqueFiles = [...new Set(context.fileEvents.map((e) => e.file_path))];
    parts.push(`Worked on ${uniqueFiles.length} file(s): ${uniqueFiles.slice(0, 5).join(', ')}${uniqueFiles.length > 5 ? '...' : ''}`);
  }

  if (context.errors.length > 0) {
    const unresolved = context.errors.filter((e) => !e.resolved).length;
    parts.push(`Encountered ${context.errors.length} error(s)${unresolved > 0 ? ` (${unresolved} unresolved)` : ''}`);
  }

  if (context.commands.length > 0) {
    parts.push(`Ran ${context.commands.length} terminal command(s)`);
  }

  if (context.searches.length > 0) {
    parts.push(`Made ${context.searches.length} search(es)`);
  }

  return parts.length > 0 ? parts.join('. ') + '.' : 'Session recorded with minimal activity.';
}

// =============================================
// BATCH OPERATIONS
// =============================================

/**
 * Log multiple events at once
 * @param {string} sessionId - The session UUID
 * @param {object[]} events - Array of events to log
 * @returns {Promise<object>} Summary of logged events
 */
export async function logBatchEvents(sessionId, events) {
  validateSessionId(sessionId);

  if (!Array.isArray(events) || events.length === 0) {
    throw new DevFlowError('Events must be a non-empty array', 'INVALID_EVENTS');
  }

  const results = {
    fileEvents: [],
    errors: [],
    commands: [],
    searches: [],
    failed: [],
  };

  // Process events by type
  for (const event of events) {
    try {
      switch (event.type) {
        case 'file':
          results.fileEvents.push(await logFileEvent(sessionId, event));
          break;
        case 'error':
          results.errors.push(await logError(sessionId, event));
          break;
        case 'command':
          results.commands.push(await logCommand(sessionId, event));
          break;
        case 'search':
          results.searches.push(await logSearch(sessionId, event));
          break;
        default:
          results.failed.push({ event, reason: 'Unknown event type' });
      }
    } catch (error) {
      results.failed.push({ event, reason: error.message });
    }
  }

  return {
    ...results,
    summary: {
      total: events.length,
      successful: events.length - results.failed.length,
      failed: results.failed.length,
    },
  };
}

// =============================================
// EXPORTS
// =============================================

export default {
  // Session Management
  startSession,
  endSession,
  getActiveSession,
  getSessions,
  pauseSession,
  resumeSession,

  // Event Logging
  logFileEvent,
  logError,
  resolveError,
  logCommand,
  logSearch,
  logBatchEvents,

  // Context Snapshots
  createSnapshot,
  getLatestSnapshot,
  getSnapshots,
  restoreContext,

  // AI Integration
  generateContextSummary,
  generateNextSteps,
  identifyHypothesis,

  // Error class
  DevFlowError,
};
