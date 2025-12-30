import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// System prompt for TheoGAI - The Life Operating System
const THEOGAI_SYSTEM_PROMPT = `You are TheoGAI, an advanced AI Life Operating System that combines proactive intelligence with generative UI capabilities.

YOUR CORE IDENTITY:
- You are a proactive life co-pilot, not just a reactive assistant
- You anticipate user needs based on context and history
- You generate dynamic interfaces to help users achieve their goals
- You remember everything about the user across sessions
- You combine emotional intelligence with analytical frameworks

CAPABILITIES:
1. GOAL ARCHITECTURE: Help decompose big goals into actionable hierarchies
2. DECISION SUPPORT: Provide structured frameworks (SWOT, Pros/Cons, matrices) for decisions
3. RELATIONSHIP INTELLIGENCE: Track and nurture user's network
4. HABIT FORMATION: Build habits using behavioral science principles
5. PROACTIVE INSIGHTS: Surface relevant information before being asked

GENERATIVE UI INSTRUCTIONS:
When appropriate, generate UI components by including a JSON block with the following format:

\`\`\`theogai-ui
{
  "components": [
    {
      "type": "ComponentName",
      "props": { ... }
    }
  ]
}
\`\`\`

Available component types:
1. DecisionCard - For decision-making with options and pros/cons
   Props: title, description, options (array with name, description, pros, cons, score), importance, deadline

2. GoalTree - For displaying hierarchical goals
   Props: goals (array with id, title, description, timeframe, status, progress, parent_goal_id, milestones)

3. InsightsPanel - For proactive insights and suggestions
   Props: insights (array with type, title, description, action, priority)
   Types: reminder, suggestion, warning, celebration, opportunity, reflection

4. RelationshipsPanel - For relationship management
   Props: relationships (array with name, relationship_type, company, role, last_interaction, notes, importance), title

5. HabitTracker - For habit tracking with streaks
   Props: habits (array with id, title, time_of_day, cue, streak_current)

INTERACTION STYLE:
- Be warm but direct - don't waste the user's time
- Ask clarifying questions when needed, but make smart assumptions
- Celebrate wins and provide encouragement during setbacks
- Use the user's context to personalize every interaction
- When generating UI, explain WHY you're showing that interface
- Balance analytical frameworks with emotional support

USER CONTEXT (if provided):
{userContext}

RECENT CONVERSATION MEMORY:
{recentConversations}

Remember: You're not just answering questions - you're helping orchestrate the user's life. Be proactive, be personal, be powerful.`;

// Parse UI components from response
function parseUIComponents(text) {
  const uiRegex = /```theogai-ui\n([\s\S]*?)\n```/g;
  const components = [];
  let match;

  while ((match = uiRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.components) {
        components.push(...parsed.components);
      }
    } catch (e) {
      console.error('Failed to parse UI component:', e);
    }
  }

  // Remove UI blocks from text for clean message
  const cleanText = text.replace(uiRegex, '').trim();

  return { components, cleanText };
}

// Detect intent and suggest UI components
function detectIntent(message) {
  const lowerMessage = message.toLowerCase();

  const intents = {
    decision: ['should i', 'decide', 'choice', 'option', 'versus', ' vs ', 'compare', 'pros and cons', 'dilemma'],
    goal: ['goal', 'objective', 'plan', 'achieve', 'target', 'quarter', 'year', 'milestone'],
    relationship: ['meet', 'meeting', 'connect', 'network', 'relationship', 'contact', 'colleague', 'friend'],
    habit: ['habit', 'routine', 'daily', 'consistent', 'streak', 'discipline'],
    reflection: ['feeling', 'stressed', 'overwhelmed', 'anxious', 'happy', 'struggling', 'stuck'],
    insight: ['what should', 'suggest', 'recommend', 'advice', 'help me']
  };

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      return intent;
    }
  }

  return 'general';
}

export async function POST(request) {
  try {
    const { messages, userContext, recentConversations } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get last user message for intent detection
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const intent = detectIntent(lastUserMessage);

    // Build context-aware system prompt
    let systemPrompt = THEOGAI_SYSTEM_PROMPT
      .replace('{userContext}', userContext ? JSON.stringify(userContext, null, 2) : 'No context available yet. Ask the user about themselves.')
      .replace('{recentConversations}', recentConversations ? recentConversations.join('\n') : 'No previous conversations.');

    // Add intent-specific guidance
    const intentGuidance = {
      decision: '\n\nThe user seems to be making a decision. Consider generating a DecisionCard with structured options and pros/cons.',
      goal: '\n\nThe user is discussing goals. Consider generating a GoalTree to help visualize and decompose their objectives.',
      relationship: '\n\nThe user is discussing relationships. Consider generating a RelationshipCard with relevant context.',
      habit: '\n\nThe user is interested in habits. Consider generating a HabitTracker to help them build consistency.',
      reflection: '\n\nThe user may need emotional support. Be empathetic first, then offer structured help if appropriate.',
      insight: '\n\nThe user is seeking guidance. Consider generating an InsightsPanel with actionable suggestions.',
      general: ''
    };

    systemPrompt += intentGuidance[intent] || '';

    // Call Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse UI components from response
    const { components, cleanText } = parseUIComponents(responseText);

    // Extract any entities for memory (goals, decisions, relationships mentioned)
    const extractedEntities = {
      intent,
      hasUIComponents: components.length > 0,
      componentTypes: components.map(c => c.type)
    };

    return NextResponse.json({
      message: cleanText,
      components,
      entities: extractedEntities,
      usage: completion.usage
    });

  } catch (error) {
    console.error('TheoGAI API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

// GET endpoint for proactive insights
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Generate proactive insights based on user context
    // This would normally fetch from the database and analyze patterns
    const insights = [
      {
        type: 'suggestion',
        title: 'Welcome to TheoGAI',
        description: 'I\'m your AI Life Operating System. Tell me about your goals, and I\'ll help you create a structured plan to achieve them.',
        action: 'Set First Goal',
        priority: 'high'
      }
    ];

    return NextResponse.json({ insights });

  } catch (error) {
    console.error('TheoGAI Insights Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
