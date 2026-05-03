import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function getAuthEmail() {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email
}

const TOOLS = [
  {
    name: 'get_pieces',
    description: 'Get all active pieces for this student with their details including title, composer, category, current focus area, priority status, and personal rating.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_current_schedule',
    description: 'Get the current practice grid showing what is planned and completed for the specified number of days ahead.',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number', description: 'Number of days to look ahead (7 or 14). Defaults to 7.' }
      }
    }
  },
  {
    name: 'get_practice_days',
    description: 'Get which days of the upcoming week are marked as planned practice days.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'propose_schedule',
    description: 'Propose a practice schedule for the student to review. Include which pieces to play or practice on which days, focus area updates for each piece, and an overall weekly focus. The student will see a visual preview and must approve before it is applied. Call this only when you have gathered enough information from the student.',
    input_schema: {
      type: 'object',
      properties: {
        schedule: {
          type: 'array',
          description: 'Array of piece-day assignments',
          items: {
            type: 'object',
            properties: {
              piece_id: { type: 'string' },
              piece_title: { type: 'string' },
              date: { type: 'string', description: 'YYYY-MM-DD format' },
              status: { type: 'string', enum: ['plan_play', 'plan_practice'], description: 'plan_play = casual playing for enjoyment, plan_practice = focused practice on technique/sections' }
            },
            required: ['piece_id', 'piece_title', 'date', 'status']
          }
        },
        focus_updates: {
          type: 'array',
          description: 'Updated focus areas for pieces',
          items: {
            type: 'object',
            properties: {
              piece_id: { type: 'string' },
              piece_title: { type: 'string' },
              focus: { type: 'string', description: 'Specific focus area, e.g. "mm. 24-32 left hand passage work" or "dynamics in the coda"' }
            },
            required: ['piece_id', 'piece_title', 'focus']
          }
        },
        weekly_focus: { type: 'string', description: 'Overall focus theme for the week, e.g. "counting aloud", "sight reading", "dynamics"' },
        explanation: { type: 'string', description: 'Brief explanation of the schedule rationale for the student' }
      },
      required: ['schedule', 'explanation']
    }
  }
]

function buildSystemPrompt(practicePhilosophy) {
  let prompt = `You are a friendly, knowledgeable piano practice coach. Your job is to help piano students plan their weekly practice schedule.

## Your Approach
- Be warm, encouraging, and conversational
- Ask probing questions before making recommendations
- Understand the student's goals, upcoming events, and available time before proposing a schedule

## Key Concepts
- **Play** (plan_play): Casual playing for enjoyment — running through a piece, having fun with it. Good for maintaining pieces and building confidence.
- **Practice** (plan_practice): Focused, deliberate work on specific sections, techniques, or challenges. This is where improvement happens.
- A good weekly plan balances both — students need focused practice on challenging pieces AND enjoyable playing to stay motivated.

## Before Proposing a Schedule, Ask About:
1. What are your goals this week? Any upcoming performances, recitals, or exams?
2. Which days can you practice? How much time do you have each day?
3. Which pieces feel challenging right now? What sections are you working on?
4. What did your teacher focus on in your last lesson?
5. Is there anything you're really enjoying playing right now?

Don't ask all questions at once — have a natural conversation. 2-3 questions at a time is good.

## Schedule Planning Guidelines
- Priority pieces (marked with ★) should get more practice days
- Every practice day should include at least one focused practice piece
- Include at least one "play for fun" piece on most days to keep practice enjoyable
- Vary the focus areas — don't assign the same focus every day
- Set specific, actionable focus areas (e.g., "mm. 24-32 left hand passage work" not just "practice it")
- Consider the student's available days and time constraints
- The weekly focus should reflect the overarching theme (e.g., "counting aloud", "dynamics", "sight reading")

## Important Rules
- You can ONLY discuss topics related to piano practice, music, repertoire, and the student's schedule
- If asked about unrelated topics, politely say: "I'm your practice coach — I can only help with piano practice and music! What would you like to work on this week?"
- Always use the get_pieces tool at the start to learn about the student's repertoire
- Always propose a schedule using the propose_schedule tool — never just describe it in text
- When the student approves the schedule, confirm it has been applied`

  if (practicePhilosophy) {
    prompt += `\n\n## Teacher's Practice Philosophy\nThe following guidance comes from the student's teacher. Incorporate these principles into your recommendations:\n\n${practicePhilosophy}`
  }

  return prompt
}

function getLocalDate(offsetDays = 0) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  local.setDate(local.getDate() + offsetDays)
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
}

async function handleToolCall(toolName, toolInput, profileEmail, supabase) {
  if (toolName === 'get_pieces') {
    const { data } = await supabase.from('pieces')
      .select('id, title, composer, current_focus, is_priority, personal_rating, category_id, categories(name)')
      .eq('user_id', profileEmail)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('title')
    return data || []
  }

  if (toolName === 'get_current_schedule') {
    const daysAhead = toolInput.days_ahead || 7
    const startDate = getLocalDate(0)
    const endDate = getLocalDate(daysAhead - 1)

    const { data } = await supabase.from('practice_grid')
      .select('piece_id, date, status')
      .eq('user_email', profileEmail)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

    // Also get piece titles for context
    const pieceIds = [...new Set((data || []).map(g => g.piece_id))]
    let pieceTitles = {}
    if (pieceIds.length > 0) {
      const { data: pieces } = await supabase.from('pieces').select('id, title').in('id', pieceIds)
      pieces?.forEach(p => { pieceTitles[p.id] = p.title })
    }

    return {
      startDate,
      endDate,
      entries: (data || []).map(g => ({
        ...g,
        piece_title: pieceTitles[g.piece_id] || 'Unknown'
      }))
    }
  }

  if (toolName === 'get_practice_days') {
    const startDate = getLocalDate(0)
    const endDate = getLocalDate(13)

    const { data } = await supabase.from('practice_days')
      .select('date')
      .eq('user_email', profileEmail)
      .gte('date', startDate)
      .lte('date', endDate)
    return (data || []).map(d => d.date)
  }

  if (toolName === 'propose_schedule') {
    // Don't execute anything — return the proposal for the UI to render
    return { type: 'proposal', ...toolInput }
  }

  return { error: 'Unknown tool' }
}

export async function POST(request) {
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, profileEmail: reqProfile, conversationId } = await request.json()
  const profileEmail = reqProfile || myEmail
  const supabase = adminSupabase()

  // Permission check for cross-profile
  if (profileEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', profileEmail).eq('grantee_email', myEmail).single()
    if (!perm) return Response.json({ error: 'No access' }, { status: 403 })
  }

  // Load practice philosophy
  const { data: profileData } = await supabase.from('user_profiles')
    .select('practice_philosophy').eq('email', profileEmail).limit(1)
  const practicePhilosophy = profileData?.[0]?.practice_philosophy || ''

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let systemPrompt = buildSystemPrompt(practicePhilosophy)

  // If resuming a conversation, check if there were prior proposals and add context
  const priorProposals = messages.filter(m => m.proposal)
  if (priorProposals.length > 0) {
    const lastProposal = priorProposals[priorProposals.length - 1].proposal
    systemPrompt += `\n\n## Prior Context\nYou previously proposed a schedule in this conversation. The most recent proposal included: ${lastProposal.explanation || 'a practice schedule'}. If the student asks for adjustments, build on this context. You do NOT need to call get_pieces again unless the conversation topic changes significantly.`
  }

  // Process messages with tool use loop
  let currentMessages = [...messages]
  const responseChunks = []

  // We may need multiple rounds if the model calls tools
  let maxRounds = 5
  while (maxRounds > 0) {
    maxRounds--

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      tools: TOOLS,
      messages: currentMessages,
    })

    // Check if the model wants to use tools
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    const textBlocks = response.content.filter(b => b.type === 'text')

    if (textBlocks.length > 0) {
      responseChunks.push(...textBlocks)
    }

    if (toolUseBlocks.length === 0) {
      // No tool calls — we're done
      break
    }

    // Handle tool calls
    currentMessages.push({ role: 'assistant', content: response.content })

    const toolResults = []
    let proposal = null
    for (const toolUse of toolUseBlocks) {
      const result = await handleToolCall(toolUse.name, toolUse.input, profileEmail, supabase)

      // If this is a proposal, extract it for the UI
      if (result?.type === 'proposal') {
        proposal = result
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      })
    }

    currentMessages.push({ role: 'user', content: toolResults })

    // If there was a proposal, we want to get the model's explanation text after the tool result
    if (proposal) {
      responseChunks.push({ type: 'proposal', data: proposal })
    }
  }

  // Extract final text
  const textContent = responseChunks
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n\n')

  const proposalBlock = responseChunks.find(b => b.type === 'proposal')

  // Save conversation
  const allMessages = [
    ...messages,
    { role: 'assistant', content: textContent, proposal: proposalBlock?.data || null, timestamp: new Date().toISOString() }
  ]

  if (conversationId) {
    await supabase.from('planner_conversations')
      .update({ messages: allMessages, updated_at: new Date().toISOString() })
      .eq('id', conversationId)
  } else {
    const { data: conv } = await supabase.from('planner_conversations')
      .insert({ user_email: myEmail, profile_email: profileEmail, messages: allMessages })
      .select('id').single()
    return Response.json({ text: textContent, proposal: proposalBlock?.data || null, conversationId: conv?.id, messages: allMessages })
  }

  return Response.json({ text: textContent, proposal: proposalBlock?.data || null, conversationId, messages: allMessages })
}

// GET — load most recent conversation
export async function GET(request) {
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const profileEmail = url.searchParams.get('profile') || myEmail

  const supabase = adminSupabase()
  const { data } = await supabase.from('planner_conversations')
    .select('*')
    .eq('user_email', myEmail)
    .eq('profile_email', profileEmail)
    .order('updated_at', { ascending: false })
    .limit(1)

  return Response.json({ conversation: data?.[0] || null })
}
