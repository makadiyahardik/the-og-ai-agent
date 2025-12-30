import { supabase } from '@/lib/supabase'
import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

const STANDUP_SYSTEM_PROMPT = `You are an AI assistant that generates professional standup reports from developer activities.

Your task is to analyze the provided activities and generate a clear, concise standup report in the following format:

**Yesterday:**
- [List completed work items as bullet points]

**Today:**
- [List planned work items as bullet points, inferred from patterns and ongoing work]

**Blockers:**
- [List any blockers or "None" if no blockers identified]

Guidelines:
- Be specific and reference actual commits, PRs, and tasks
- Keep each bullet point concise (1-2 sentences max)
- Group related activities together
- For "Today", infer logical next steps from yesterday's work
- Only mention blockers if explicitly noted in activities
- Use past tense for Yesterday, future tense for Today
- Keep the tone professional but friendly`

/**
 * GET /api/autostandup
 * Fetches today's standup report for the authenticated user
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Fetch standup for the specified date
    const { data: standup, error } = await supabase
      .from('standups')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's ok
      console.error('Error fetching standup:', error)
      return NextResponse.json(
        { error: 'Failed to fetch standup' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      standup: standup || null,
      date
    })

  } catch (error) {
    console.error('GET standup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/autostandup
 * Generates a new standup report using AI based on recent activities
 */
export async function POST(request) {
  try {
    if (!groq) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { userId, templateId, customPrompt } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const today = now.toISOString().split('T')[0]

    // Fetch activities from the past 24 hours
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }

    // Fetch template if specified
    let template = null
    if (templateId) {
      const { data: templateData, error: templateError } = await supabase
        .from('standup_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (!templateError) {
        template = templateData
      }
    }

    // Format activities for the AI prompt
    const formattedActivities = formatActivitiesForPrompt(activities || [])

    // Build the prompt
    let userPrompt = `Generate a standup report based on the following developer activities from the past 24 hours:\n\n${formattedActivities}`

    if (template?.prompt_additions) {
      userPrompt += `\n\nAdditional context from template: ${template.prompt_additions}`
    }

    if (customPrompt) {
      userPrompt += `\n\nAdditional instructions: ${customPrompt}`
    }

    if (!activities || activities.length === 0) {
      userPrompt = `No activities were logged in the past 24 hours. Generate a standup report acknowledging this and suggesting the user log their activities. Use the standard format.`
    }

    // Generate standup using Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: template?.system_prompt || STANDUP_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024
    })

    const generatedContent = completion.choices[0]?.message?.content || ''

    if (!generatedContent) {
      return NextResponse.json(
        { error: 'Failed to generate standup content' },
        { status: 500 }
      )
    }

    // Parse the generated content into sections
    const parsedStandup = parseStandupContent(generatedContent)

    // Save the standup to the database (upsert)
    const { data: savedStandup, error: saveError } = await supabase
      .from('standups')
      .upsert({
        user_id: userId,
        date: today,
        yesterday: parsedStandup.yesterday,
        today: parsedStandup.today,
        blockers: parsedStandup.blockers,
        raw_content: generatedContent,
        template_id: templateId || null,
        activities_count: activities?.length || 0,
        generated_at: now.toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving standup:', saveError)
      // Still return the generated content even if save fails
      return NextResponse.json({
        success: true,
        standup: {
          ...parsedStandup,
          raw_content: generatedContent,
          saved: false
        },
        warning: 'Standup generated but failed to save to database'
      })
    }

    return NextResponse.json({
      success: true,
      standup: savedStandup,
      activitiesUsed: activities?.length || 0
    })

  } catch (error) {
    console.error('POST standup error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Format activities into a readable string for the AI prompt
 */
function formatActivitiesForPrompt(activities) {
  if (!activities || activities.length === 0) {
    return 'No activities recorded.'
  }

  const grouped = activities.reduce((acc, activity) => {
    const type = activity.type || 'other'
    if (!acc[type]) acc[type] = []
    acc[type].push(activity)
    return acc
  }, {})

  let formatted = ''

  // Format commits
  if (grouped.commit) {
    formatted += '## Commits:\n'
    grouped.commit.forEach(a => {
      formatted += `- ${a.title || a.description} (${a.repository || 'unknown repo'})\n`
      if (a.metadata?.files_changed) {
        formatted += `  Files changed: ${a.metadata.files_changed}\n`
      }
    })
    formatted += '\n'
  }

  // Format PRs
  if (grouped.pull_request) {
    formatted += '## Pull Requests:\n'
    grouped.pull_request.forEach(a => {
      const status = a.metadata?.status || 'open'
      formatted += `- [${status.toUpperCase()}] ${a.title} (${a.repository || 'unknown repo'})\n`
      if (a.description) {
        formatted += `  Description: ${a.description}\n`
      }
    })
    formatted += '\n'
  }

  // Format meetings
  if (grouped.meeting) {
    formatted += '## Meetings:\n'
    grouped.meeting.forEach(a => {
      formatted += `- ${a.title}\n`
      if (a.description) {
        formatted += `  Notes: ${a.description}\n`
      }
    })
    formatted += '\n'
  }

  // Format tasks
  if (grouped.task) {
    formatted += '## Tasks:\n'
    grouped.task.forEach(a => {
      const status = a.metadata?.status || 'in progress'
      formatted += `- [${status.toUpperCase()}] ${a.title}\n`
      if (a.description) {
        formatted += `  ${a.description}\n`
      }
    })
    formatted += '\n'
  }

  // Format other activities
  const otherTypes = Object.keys(grouped).filter(
    t => !['commit', 'pull_request', 'meeting', 'task'].includes(t)
  )

  otherTypes.forEach(type => {
    formatted += `## ${type.charAt(0).toUpperCase() + type.slice(1)}:\n`
    grouped[type].forEach(a => {
      formatted += `- ${a.title || a.description}\n`
    })
    formatted += '\n'
  })

  return formatted.trim()
}

/**
 * Parse the AI-generated standup content into structured sections
 */
function parseStandupContent(content) {
  const sections = {
    yesterday: '',
    today: '',
    blockers: ''
  }

  // Try to extract Yesterday section
  const yesterdayMatch = content.match(/\*\*Yesterday:?\*\*\s*([\s\S]*?)(?=\*\*Today|$)/i)
  if (yesterdayMatch) {
    sections.yesterday = yesterdayMatch[1].trim()
  }

  // Try to extract Today section
  const todayMatch = content.match(/\*\*Today:?\*\*\s*([\s\S]*?)(?=\*\*Blockers|$)/i)
  if (todayMatch) {
    sections.today = todayMatch[1].trim()
  }

  // Try to extract Blockers section
  const blockersMatch = content.match(/\*\*Blockers:?\*\*\s*([\s\S]*?)$/i)
  if (blockersMatch) {
    sections.blockers = blockersMatch[1].trim()
  }

  return sections
}
