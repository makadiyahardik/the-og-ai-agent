let groq = null

// Only initialize Groq client if API key is available
if (process.env.GROQ_API_KEY) {
  const Groq = require('groq-sdk').default
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
}

const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant. You provide clear, accurate, and thoughtful responses to help users with their questions and tasks.

Your characteristics:
- You are knowledgeable across many topics including writing, coding, analysis, and general questions
- You communicate in a natural, conversational tone
- You provide structured responses when helpful (using bullet points, numbered lists, etc.)
- You ask clarifying questions when the user's request is ambiguous
- You are honest about limitations and will say when you don't know something
- You focus on being genuinely helpful rather than just agreeable

Keep your responses concise but complete. Use markdown formatting when it improves readability.`

export async function chat(messages) {
  if (!groq) {
    throw new Error('API key not configured')
  }

  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  ]

  const completion = await groq.chat.completions.create({
    messages: formattedMessages,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 2048
  })

  return completion.choices[0]?.message?.content || ''
}

export async function generateLinkedInPost(prompt, options = {}) {
  if (!groq) {
    throw new Error('Groq API key not configured')
  }

  const { tone = 'professional', length = 'medium' } = options

  const lengthGuide = {
    short: '50-100 words',
    medium: '150-200 words',
    long: '250-300 words'
  }

  const systemPrompt = `You are an expert LinkedIn content creator who writes engaging, viral posts. Your posts are known for:
- Strong hooks that grab attention in the first line
- Authentic, conversational tone
- Strategic use of line breaks for readability
- Compelling storytelling when relevant
- Clear value for the reader
- Subtle call-to-action at the end

Tone: ${tone}
Target length: ${lengthGuide[length] || lengthGuide.medium}

Write posts that feel human, relatable, and drive engagement. Avoid corporate jargon and generic motivational quotes. Make it sound authentic.`

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Write a LinkedIn post about: ${prompt}`
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.8,
    max_tokens: 800
  })

  return completion.choices[0]?.message?.content || ''
}

export async function improvePost(post, feedback) {
  if (!groq) {
    throw new Error('Groq API key not configured')
  }

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are an expert LinkedIn content editor. Improve the given post based on the feedback while maintaining its authentic voice.'
      },
      {
        role: 'user',
        content: `Original post:\n${post}\n\nFeedback:\n${feedback}\n\nProvide an improved version.`
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 800
  })

  return completion.choices[0]?.message?.content || ''
}
