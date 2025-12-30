import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * Valid activity types
 */
const VALID_ACTIVITY_TYPES = [
  'commit',
  'pull_request',
  'meeting',
  'task',
  'review',
  'deployment',
  'issue',
  'documentation',
  'other'
]

/**
 * GET /api/autostandup/activities
 * Fetches activities for a user with optional filtering
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('activities')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (type && VALID_ACTIVITY_TYPES.includes(type)) {
      query = query.eq('type', type)
    }

    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString())
    }

    if (endDate) {
      query = query.lte('created_at', new Date(endDate).toISOString())
    }

    const { data: activities, error, count } = await query

    if (error) {
      console.error('Error fetching activities:', error)
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activities: activities || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('GET activities error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autostandup/activities
 * Logs a new activity (commit, PR, meeting, etc.)
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, type, title, description, repository, metadata } = body

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!type) {
      return NextResponse.json(
        { error: 'type is required' },
        { status: 400 }
      )
    }

    if (!VALID_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type. Must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!title && !description) {
      return NextResponse.json(
        { error: 'Either title or description is required' },
        { status: 400 }
      )
    }

    // Prepare activity data
    const activityData = {
      user_id: userId,
      type,
      title: title || null,
      description: description || null,
      repository: repository || null,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    }

    // Insert activity
    const { data: activity, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single()

    if (error) {
      console.error('Error creating activity:', error)
      return NextResponse.json(
        { error: 'Failed to create activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activity
    }, { status: 201 })

  } catch (error) {
    console.error('POST activity error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/autostandup/activities
 * Updates an existing activity
 */
export async function PUT(request) {
  try {
    const body = await request.json()
    const { id, userId, type, title, description, repository, metadata } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Activity id is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for authorization' },
        { status: 400 }
      )
    }

    // Validate type if provided
    if (type && !VALID_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type. Must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData = {}
    if (type !== undefined) updateData.type = type
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (repository !== undefined) updateData.repository = repository
    if (metadata !== undefined) updateData.metadata = metadata
    updateData.updated_at = new Date().toISOString()

    // Update activity (only if user owns it)
    const { data: activity, error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Activity not found or access denied' },
          { status: 404 }
        )
      }
      console.error('Error updating activity:', error)
      return NextResponse.json(
        { error: 'Failed to update activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activity
    })

  } catch (error) {
    console.error('PUT activity error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/autostandup/activities
 * Deletes an activity
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id) {
      return NextResponse.json(
        { error: 'Activity id is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for authorization' },
        { status: 400 }
      )
    }

    // Delete activity (only if user owns it)
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting activity:', error)
      return NextResponse.json(
        { error: 'Failed to delete activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Activity deleted successfully'
    })

  } catch (error) {
    console.error('DELETE activity error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/autostandup/activities
 * Batch create multiple activities at once
 */
export async function PATCH(request) {
  try {
    const body = await request.json()
    const { userId, activities } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return NextResponse.json(
        { error: 'activities array is required and must not be empty' },
        { status: 400 }
      )
    }

    if (activities.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 activities can be created at once' },
        { status: 400 }
      )
    }

    // Validate and prepare all activities
    const preparedActivities = []
    const errors = []

    activities.forEach((activity, index) => {
      const { type, title, description, repository, metadata } = activity

      if (!type || !VALID_ACTIVITY_TYPES.includes(type)) {
        errors.push(`Activity ${index}: Invalid or missing type`)
        return
      }

      if (!title && !description) {
        errors.push(`Activity ${index}: Either title or description is required`)
        return
      }

      preparedActivities.push({
        user_id: userId,
        type,
        title: title || null,
        description: description || null,
        repository: repository || null,
        metadata: metadata || {},
        created_at: activity.created_at || new Date().toISOString()
      })
    })

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation errors', details: errors },
        { status: 400 }
      )
    }

    // Batch insert
    const { data: insertedActivities, error } = await supabase
      .from('activities')
      .insert(preparedActivities)
      .select()

    if (error) {
      console.error('Error batch creating activities:', error)
      return NextResponse.json(
        { error: 'Failed to create activities' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      activities: insertedActivities,
      count: insertedActivities.length
    }, { status: 201 })

  } catch (error) {
    console.error('PATCH activities error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
