import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * DevFlow Sessions API
 * Main endpoint for managing development sessions
 */

/**
 * GET /api/devflow
 * List all sessions with optional filtering and pagination
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = parseInt(searchParams.get('offset')) || 0;
    const orderBy = searchParams.get('orderBy') || 'created_at';
    const order = searchParams.get('order') || 'desc';

    let query = supabase
      .from('devflow_sessions')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order(orderBy, { ascending: order === 'asc' });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('DevFlow GET sessions error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessions: data,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (error) {
    console.error('DevFlow GET sessions exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/devflow
 * Create a new development session
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      project_path,
      metadata = {},
      tags = []
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      );
    }

    const sessionData = {
      name: name.trim(),
      description: description?.trim() || null,
      project_path: project_path?.trim() || null,
      status: 'active',
      metadata: {
        ...metadata,
        tags,
        created_by: 'devflow-api',
        version: '1.0'
      },
      started_at: new Date().toISOString(),
      event_count: 0,
      snapshot_count: 0
    };

    const { data, error } = await supabase
      .from('devflow_sessions')
      .insert([sessionData])
      .select()
      .single();

    if (error) {
      console.error('DevFlow POST session error:', error);

      // Handle specific database errors
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A session with this name already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create session', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        session: data,
        message: 'Session created successfully'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('DevFlow POST session exception:', error);

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
