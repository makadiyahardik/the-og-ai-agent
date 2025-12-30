import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * DevFlow Individual Session API
 * Endpoints for managing a specific development session
 */

/**
 * Validate UUID format
 */
function isValidUUID(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * GET /api/devflow/session/[id]
 * Get a specific session by ID with optional related data
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeEvents = searchParams.get('includeEvents') === 'true';
    const includeSnapshots = searchParams.get('includeSnapshots') === 'true';

    // Fetch the session
    const { data: session, error: sessionError } = await supabase
      .from('devflow_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      console.error('DevFlow GET session error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to fetch session', details: sessionError.message },
        { status: 500 }
      );
    }

    const response = { session };

    // Optionally include events
    if (includeEvents) {
      const { data: events, error: eventsError } = await supabase
        .from('devflow_events')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true });

      if (eventsError) {
        console.error('DevFlow GET session events error:', eventsError);
      } else {
        response.events = events;
      }
    }

    // Optionally include snapshots
    if (includeSnapshots) {
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('devflow_snapshots')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: false });

      if (snapshotsError) {
        console.error('DevFlow GET session snapshots error:', snapshotsError);
      } else {
        response.snapshots = snapshots;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('DevFlow GET session exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/devflow/session/[id]
 * Update a specific session
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      status,
      project_path,
      metadata,
      tags
    } = body;

    // Build update object with only provided fields
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Session name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (project_path !== undefined) {
      updateData.project_path = project_path?.trim() || null;
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'paused', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.status = status;

      // Set ended_at when session is completed
      if (status === 'completed' || status === 'archived') {
        updateData.ended_at = new Date().toISOString();
      }
    }

    // Handle metadata update (merge with existing)
    if (metadata !== undefined || tags !== undefined) {
      // First fetch existing metadata
      const { data: existing } = await supabase
        .from('devflow_sessions')
        .select('metadata')
        .eq('id', id)
        .single();

      const existingMetadata = existing?.metadata || {};
      updateData.metadata = {
        ...existingMetadata,
        ...(metadata || {}),
        ...(tags !== undefined ? { tags } : {})
      };
    }

    const { data, error } = await supabase
      .from('devflow_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      console.error('DevFlow PATCH session error:', error);
      return NextResponse.json(
        { error: 'Failed to update session', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session: data,
      message: 'Session updated successfully'
    });
  } catch (error) {
    console.error('DevFlow PATCH session exception:', error);

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
 * DELETE /api/devflow/session/[id]
 * Delete a specific session and all related data
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Hard delete: Remove session and all related data
      // Delete events first (foreign key constraint)
      const { error: eventsError } = await supabase
        .from('devflow_events')
        .delete()
        .eq('session_id', id);

      if (eventsError) {
        console.error('DevFlow DELETE events error:', eventsError);
      }

      // Delete snapshots
      const { error: snapshotsError } = await supabase
        .from('devflow_snapshots')
        .delete()
        .eq('session_id', id);

      if (snapshotsError) {
        console.error('DevFlow DELETE snapshots error:', snapshotsError);
      }

      // Delete the session
      const { error: sessionError } = await supabase
        .from('devflow_sessions')
        .delete()
        .eq('id', id);

      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }
        console.error('DevFlow DELETE session error:', sessionError);
        return NextResponse.json(
          { error: 'Failed to delete session', details: sessionError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Session and all related data permanently deleted',
        deleted: { session: id }
      });
    } else {
      // Soft delete: Archive the session
      const { data, error } = await supabase
        .from('devflow_sessions')
        .update({
          status: 'archived',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }
        console.error('DevFlow DELETE (archive) session error:', error);
        return NextResponse.json(
          { error: 'Failed to archive session', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        session: data,
        message: 'Session archived successfully. Use ?hard=true for permanent deletion.'
      });
    }
  } catch (error) {
    console.error('DevFlow DELETE session exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
