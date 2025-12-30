import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * GET /api/autostandup/templates
 * Fetches all templates for a user (including global templates)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const templateId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // If specific template requested
    if (templateId) {
      const { data: template, error } = await supabase
        .from('standup_templates')
        .select('*')
        .eq('id', templateId)
        .or(`user_id.eq.${userId},is_global.eq.true`)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Template not found or access denied' },
            { status: 404 }
          )
        }
        console.error('Error fetching template:', error)
        return NextResponse.json(
          { error: 'Failed to fetch template' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        template
      })
    }

    // Fetch user's templates and global templates
    const { data: templates, error } = await supabase
      .from('standup_templates')
      .select('*')
      .or(`user_id.eq.${userId},is_global.eq.true`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      templates: templates || []
    })

  } catch (error) {
    console.error('GET templates error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autostandup/templates
 * Creates a new standup template
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const {
      userId,
      name,
      description,
      system_prompt,
      prompt_additions,
      is_default
    } = body

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Template name must be 100 characters or less' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from('standup_templates')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
    }

    // Create template
    const { data: template, error } = await supabase
      .from('standup_templates')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
        system_prompt: system_prompt?.trim() || null,
        prompt_additions: prompt_additions?.trim() || null,
        is_default: is_default || false,
        is_global: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template
    }, { status: 201 })

  } catch (error) {
    console.error('POST template error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/autostandup/templates
 * Updates an existing template
 */
export async function PUT(request) {
  try {
    const body = await request.json()
    const {
      id,
      userId,
      name,
      description,
      system_prompt,
      prompt_additions,
      is_default
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Template id is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for authorization' },
        { status: 400 }
      )
    }

    // Verify ownership (can't update global templates)
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('standup_templates')
      .select('id, user_id, is_global')
      .eq('id', id)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (existingTemplate.is_global || existingTemplate.user_id !== userId) {
      return NextResponse.json(
        { error: 'Cannot modify this template' },
        { status: 403 }
      )
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Template name cannot be empty' },
          { status: 400 }
        )
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Template name must be 100 characters or less' },
          { status: 400 }
        )
      }
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase
        .from('standup_templates')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
        .neq('id', id)
    }

    // Build update object
    const updateData = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (system_prompt !== undefined) updateData.system_prompt = system_prompt?.trim() || null
    if (prompt_additions !== undefined) updateData.prompt_additions = prompt_additions?.trim() || null
    if (is_default !== undefined) updateData.is_default = is_default

    // Update template
    const { data: template, error } = await supabase
      .from('standup_templates')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      template
    })

  } catch (error) {
    console.error('PUT template error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/autostandup/templates
 * Deletes a template
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id) {
      return NextResponse.json(
        { error: 'Template id is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required for authorization' },
        { status: 400 }
      )
    }

    // Verify ownership (can't delete global templates)
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('standup_templates')
      .select('id, user_id, is_global')
      .eq('id', id)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (existingTemplate.is_global) {
      return NextResponse.json(
        { error: 'Cannot delete global templates' },
        { status: 403 }
      )
    }

    if (existingTemplate.user_id !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Delete template
    const { error } = await supabase
      .from('standup_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    })

  } catch (error) {
    console.error('DELETE template error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
