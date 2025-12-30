import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/**
 * DevFlow Snapshots API
 * Create and retrieve context snapshots with AI-generated summaries
 */

// Initialize Groq client
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

/**
 * Generate a context summary using Groq AI
 */
async function generateContextSummary(events, sessionInfo) {
  if (!groq) {
    return {
      summary: 'AI summary unavailable - Groq API key not configured',
      generated: false
    };
  }

  // Format events for the AI
  const eventsSummary = events.map(event => {
    const timestamp = new Date(event.created_at).toLocaleTimeString();
    switch (event.event_type) {
      case 'file_change':
        return `[${timestamp}] File ${event.action || 'modified'}: ${event.file_path || event.data?.file_path || 'unknown'}`;
      case 'error':
        return `[${timestamp}] Error: ${event.message || event.data?.message || 'Unknown error'}`;
      case 'command':
        return `[${timestamp}] Command: ${event.data?.command || event.message || 'unknown command'}`;
      case 'search':
        return `[${timestamp}] Search: ${event.data?.query || event.message || 'search performed'}`;
      case 'note':
        return `[${timestamp}] Note: ${event.message || event.data?.content || ''}`;
      default:
        return `[${timestamp}] ${event.event_type}: ${event.message || JSON.stringify(event.data || {})}`;
    }
  }).join('\n');

  const systemPrompt = `You are a development context analyzer. Your job is to summarize development session activity into a concise, actionable context snapshot.

Analyze the events and provide:
1. A brief summary of what was accomplished (2-3 sentences)
2. Current focus/state of the development
3. Any issues or blockers encountered
4. Key files that were modified
5. Recommended next steps

Keep the summary concise but comprehensive. Focus on what would help a developer quickly understand the session state.`;

  const userPrompt = `Session: ${sessionInfo.name}
Description: ${sessionInfo.description || 'No description'}
Project Path: ${sessionInfo.project_path || 'Not specified'}

Recent Events (${events.length} total):
${eventsSummary || 'No events recorded'}

Generate a context snapshot summary for this development session.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 1024
    });

    return {
      summary: completion.choices[0]?.message?.content || 'Failed to generate summary',
      generated: true,
      model: 'llama-3.3-70b-versatile',
      tokens_used: completion.usage?.total_tokens || 0
    };
  } catch (error) {
    console.error('Groq AI error:', error);
    return {
      summary: `AI summary generation failed: ${error.message}`,
      generated: false,
      error: error.message
    };
  }
}

/**
 * GET /api/devflow/snapshot
 * Get snapshots for a session
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = parseInt(searchParams.get('offset')) || 0;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    const { data, error, count } = await supabase
      .from('devflow_snapshots')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('DevFlow GET snapshots error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch snapshots', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      snapshots: data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (error) {
    console.error('DevFlow GET snapshots exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/devflow/snapshot
 * Create a new context snapshot with AI-generated summary
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      session_id,
      name,
      description,
      include_events_since,
      custom_context,
      tags = []
    } = body;

    // Validate required fields
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    // Fetch the session
    const { data: session, error: sessionError } = await supabase
      .from('devflow_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      console.error('DevFlow snapshot session fetch error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to fetch session', details: sessionError.message },
        { status: 500 }
      );
    }

    // Fetch events for context
    let eventsQuery = supabase
      .from('devflow_events')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    // Optionally filter events by timestamp
    if (include_events_since) {
      eventsQuery = eventsQuery.gte('created_at', include_events_since);
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error('DevFlow snapshot events fetch error:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch session events', details: eventsError.message },
        { status: 500 }
      );
    }

    // Generate AI summary
    const aiResult = await generateContextSummary(events || [], session);

    // Create the snapshot
    const snapshotData = {
      session_id,
      name: name || `Snapshot ${new Date().toISOString()}`,
      description: description || null,
      summary: aiResult.summary,
      context: {
        session_info: {
          name: session.name,
          description: session.description,
          project_path: session.project_path,
          status: session.status
        },
        events_count: events?.length || 0,
        events_since: include_events_since || session.started_at,
        custom_context: custom_context || null,
        ai_metadata: {
          generated: aiResult.generated,
          model: aiResult.model || null,
          tokens_used: aiResult.tokens_used || 0,
          error: aiResult.error || null
        }
      },
      metadata: {
        tags,
        created_by: 'devflow-api',
        version: '1.0'
      }
    };

    const { data: snapshot, error: snapshotError } = await supabase
      .from('devflow_snapshots')
      .insert([snapshotData])
      .select()
      .single();

    if (snapshotError) {
      console.error('DevFlow POST snapshot error:', snapshotError);
      return NextResponse.json(
        { error: 'Failed to create snapshot', details: snapshotError.message },
        { status: 500 }
      );
    }

    // Update session snapshot count
    await supabase
      .from('devflow_sessions')
      .update({
        snapshot_count: (session.snapshot_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', session_id);

    return NextResponse.json(
      {
        snapshot,
        ai_summary: {
          generated: aiResult.generated,
          model: aiResult.model,
          tokens_used: aiResult.tokens_used
        },
        message: 'Snapshot created successfully'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('DevFlow POST snapshot exception:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
