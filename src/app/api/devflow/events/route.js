import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * DevFlow Events API
 * Log and retrieve development events (file changes, errors, commands, searches)
 */

/**
 * Validate event type
 */
const VALID_EVENT_TYPES = [
  'file_change',
  'file_create',
  'file_delete',
  'error',
  'warning',
  'command',
  'search',
  'note',
  'milestone',
  'debug',
  'info'
];

/**
 * GET /api/devflow/events
 * Get events for a session with filtering options
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const eventType = searchParams.get('type');
    const severity = searchParams.get('severity');
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const limit = parseInt(searchParams.get('limit')) || 100;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const order = searchParams.get('order') || 'desc';

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('devflow_events')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (eventType) {
      const types = eventType.split(',').map(t => t.trim());
      query = query.in('event_type', types);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    if (since) {
      query = query.gte('created_at', since);
    }

    if (until) {
      query = query.lte('created_at', until);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('DevFlow GET events error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events', details: error.message },
        { status: 500 }
      );
    }

    // Group events by type for summary
    const summary = data.reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      events: data,
      summary,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (error) {
    console.error('DevFlow GET events exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/devflow/events
 * Log a new event or batch of events
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Support both single event and batch events
    const events = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event is required' },
        { status: 400 }
      );
    }

    // Validate and process events
    const processedEvents = [];
    const errors = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const {
        session_id,
        event_type,
        message,
        file_path,
        action,
        severity = 'info',
        data = {},
        metadata = {}
      } = event;

      // Validate required fields
      if (!session_id) {
        errors.push({ index: i, error: 'session_id is required' });
        continue;
      }

      if (!event_type) {
        errors.push({ index: i, error: 'event_type is required' });
        continue;
      }

      if (!VALID_EVENT_TYPES.includes(event_type)) {
        errors.push({
          index: i,
          error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`
        });
        continue;
      }

      // Build event data based on type
      const eventData = {
        session_id,
        event_type,
        message: message || null,
        file_path: file_path || null,
        action: action || null,
        severity,
        data: {
          ...data,
          // Add type-specific defaults
          ...(event_type === 'command' && { executed_at: new Date().toISOString() }),
          ...(event_type === 'error' && { stack_trace: data.stack_trace || null }),
          ...(event_type === 'search' && { results_count: data.results_count || 0 })
        },
        metadata: {
          ...metadata,
          logged_by: 'devflow-api',
          version: '1.0'
        }
      };

      processedEvents.push(eventData);
    }

    // If all events failed validation, return error
    if (processedEvents.length === 0) {
      return NextResponse.json(
        { error: 'No valid events to log', validation_errors: errors },
        { status: 400 }
      );
    }

    // Insert events
    const { data: insertedEvents, error: insertError } = await supabase
      .from('devflow_events')
      .insert(processedEvents)
      .select();

    if (insertError) {
      console.error('DevFlow POST events error:', insertError);

      // Check for foreign key violation (session doesn't exist)
      if (insertError.code === '23503') {
        return NextResponse.json(
          { error: 'One or more session_ids do not exist' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to log events', details: insertError.message },
        { status: 500 }
      );
    }

    // Update session event counts
    const sessionIds = [...new Set(processedEvents.map(e => e.session_id))];
    for (const sessionId of sessionIds) {
      const sessionEventCount = processedEvents.filter(e => e.session_id === sessionId).length;

      // Fetch current count and update
      const { data: session } = await supabase
        .from('devflow_sessions')
        .select('event_count')
        .eq('id', sessionId)
        .single();

      if (session) {
        await supabase
          .from('devflow_sessions')
          .update({
            event_count: (session.event_count || 0) + sessionEventCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId);
      }
    }

    const response = {
      events: insertedEvents,
      logged_count: insertedEvents.length,
      message: `Successfully logged ${insertedEvents.length} event(s)`
    };

    // Include validation errors if some events failed
    if (errors.length > 0) {
      response.validation_errors = errors;
      response.message += `, ${errors.length} event(s) failed validation`;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('DevFlow POST events exception:', error);

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

/**
 * DELETE /api/devflow/events
 * Delete events for a session (with optional filters)
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const eventType = searchParams.get('type');
    const before = searchParams.get('before');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('devflow_events')
      .delete()
      .eq('session_id', sessionId);

    // Apply filters
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (before) {
      query = query.lt('created_at', before);
    }

    const { error, count } = await query;

    if (error) {
      console.error('DevFlow DELETE events error:', error);
      return NextResponse.json(
        { error: 'Failed to delete events', details: error.message },
        { status: 500 }
      );
    }

    // Update session event count
    const { data: remainingEvents } = await supabase
      .from('devflow_events')
      .select('id', { count: 'exact' })
      .eq('session_id', sessionId);

    await supabase
      .from('devflow_sessions')
      .update({
        event_count: remainingEvents?.length || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return NextResponse.json({
      message: 'Events deleted successfully',
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('DevFlow DELETE events exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
