import { chat, generateLinkedInPost, improvePost } from '@/lib/groq'

export async function POST(request) {
  try {
    const body = await request.json()
    const { prompt, messages, tone, length, action, currentPost, feedback } = body

    // Handle improvement action
    if (action === 'improve') {
      if (!currentPost || !feedback) {
        return Response.json(
          { error: 'Current post and feedback are required for improvement' },
          { status: 400 }
        )
      }
      const improved = await improvePost(currentPost, feedback)
      return Response.json({ post: improved })
    }

    // Handle chat with message history
    if (messages && messages.length > 0) {
      const response = await chat(messages)
      return Response.json({ post: response })
    }

    // Handle single prompt (legacy support)
    if (!prompt) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Use chat for single messages too
    const response = await chat([{ role: 'user', content: prompt }])
    return Response.json({ post: response })

  } catch (error) {
    console.error('Generate error:', error)
    return Response.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    )
  }
}
