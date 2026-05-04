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
    name: 'get_experience_log',
    description: 'Get recent experience log entries (lesson records) for this student. Each entry has a date, what was covered, teacher feedback, and assignments. The most recent entry is the most important for understanding current priorities. Returns up to 5 most recent entries.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent entries to fetch. Defaults to 3, max 5.' }
      }
    }
  },
  {
    name: 'get_piece_notes',
    description: 'Get recent practice and lesson notes for a specific piece. Notes include practice observations, lesson feedback, and general notes with timestamps. Useful for understanding what the student has been working on for a particular piece.',
    input_schema: {
      type: 'object',
      properties: {
        piece_title: { type: 'string', description: 'Exact piece title as returned by get_pieces' }
      },
      required: ['piece_title']
    }
  },
  {
    name: 'propose_schedule',
    description: 'Propose a practice schedule for the student to review. Reference pieces by their exact title as returned by get_pieces. The system will resolve titles to database IDs automatically. Call this only when you have gathered enough information from the student.',
    input_schema: {
      type: 'object',
      properties: {
        schedule: {
          type: 'array',
          description: 'Array of piece-day assignments',
          items: {
            type: 'object',
            properties: {
              piece_title: { type: 'string', description: 'Exact piece title as returned by get_pieces' },
              day: { type: 'string', description: 'Day name with optional week, e.g. "Sunday", "Wednesday", "Friday". For next week use "Monday next week", "Wednesday next week", etc.' },
              status: { type: 'string', enum: ['plan_play', 'plan_practice'], description: 'plan_play = casual playing for enjoyment, plan_practice = focused practice on technique/sections' }
            },
            required: ['piece_title', 'day', 'status']
          }
        },
        focus_updates: {
          type: 'array',
          description: 'Updated focus areas for pieces',
          items: {
            type: 'object',
            properties: {
              piece_title: { type: 'string', description: 'Exact piece title as returned by get_pieces' },
              focus: { type: 'string', description: 'Specific focus area, e.g. "mm. 24-32 left hand passage work" or "dynamics in the coda"' }
            },
            required: ['piece_title', 'focus']
          }
        },
        practice_days: {
          type: 'array',
          description: 'Days that should be marked as practice days (purple star on schedule). Use day names.',
          items: { type: 'string', description: 'Day name, e.g. "Sunday", "Tuesday". For next week add "next week".' }
        },
        priority_pieces: {
          type: 'array',
          description: 'Piece titles that should be marked as priority (pink star). These are the most important pieces for the week.',
          items: { type: 'string', description: 'Exact piece title as returned by get_pieces' }
        },
        weekly_focus: { type: 'string', description: 'Overall focus theme for the week, e.g. "counting aloud", "sight reading", "dynamics"' },
        explanation: { type: 'string', description: 'Brief explanation of the schedule rationale for the student' }
      },
      required: ['schedule', 'explanation']
    }
  }
]

function buildSystemPrompt(practicePhilosophy) {
  const todayStr = getLocalDate(0)
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })

  // Build a date reference table so Claude doesn't have to do date math
  const dateRef = []
  for (let i = 0; i < 14; i++) {
    const dateStr = getLocalDate(i)
    const d = new Date(dateStr + 'T12:00:00')
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
    dateRef.push(`${dayName}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} = ${dateStr}`)
  }

  let prompt = `You are a friendly, knowledgeable piano practice coach.

## Today's Date
Today is ${todayName} (${todayStr}).

## Date Reference (use these exact dates — do NOT calculate dates yourself)
${dateRef.join('\n')}

When proposing a schedule, reference days by name (e.g., "Sunday", "Wednesday", "Friday"). For next week, add "next week" (e.g., "Monday next week"). The system will resolve day names to actual dates automatically. Do NOT use YYYY-MM-DD format in propose_schedule — use day names only. Your job is to help piano students plan their weekly practice schedule.

## Your Approach
- Be warm, encouraging, and conversational
- Ask probing questions before making recommendations
- Understand the student's goals, upcoming events, and available time before proposing a schedule

## Key Concepts
- **Play** (plan_play): Casual playing for enjoyment — running through a piece, having fun with it. Good for maintaining pieces and building confidence.
- **Practice** (plan_practice): Focused, deliberate work on specific sections, techniques, or challenges. This is where improvement happens.
- A good weekly plan balances both — students need focused practice on challenging pieces AND enjoyable playing to stay motivated.

## Before Proposing a Schedule, Ask About:
1. Which days can you practice this week?
2. Are there any pieces you want to focus on, or any challenges you're working through?
Do NOT ask about session length or time per day unless the student brings it up. Do NOT ask about upcoming performances — check the experience log for that context instead.

Don't ask all questions at once — have a natural conversation. Ask only 1 question at a time, or at most a couple of closely related questions that can be answered together. Never ask 3 or more separate questions in one message.

## Schedule Planning Guidelines
- Priority pieces (marked with ★) should get more practice days
- Every practice day should include at least one focused practice piece
- Set specific, actionable focus areas (e.g., "mm. 24-32 left hand passage work" not just "practice it")
- Always include practice_days in your proposal — these are the days the student said they can practice
- Always include priority_pieces — the most important pieces for the week. For students with many pieces this could be 4-5 priorities, not just 1-2. Consider upcoming performances, teacher emphasis, and pieces needing the most work.
- Consider the student's available days and time constraints
- The weekly focus should reflect the overarching theme (e.g., "counting aloud", "dynamics", "sight reading")

## Important Rules
- You can ONLY discuss topics related to piano practice, music, repertoire, and the student's schedule
- If asked about unrelated topics, politely say: "I'm your practice coach — I can only help with piano practice and music! What would you like to work on this week?"
- Always use the get_pieces tool at the start to learn about the student's repertoire. When calling propose_schedule, reference pieces by their exact title as returned by get_pieces.
- After getting pieces, use get_experience_log to read the most recent lesson notes — this is critical for understanding what the teacher wants the student to focus on.
- If a student mentions struggling with a specific piece, use get_piece_notes to read their practice and lesson notes for that piece.
- Always propose a schedule using the propose_schedule tool — never just describe it in text
- When the student approves the schedule, confirm it has been applied
- Only propose schedule entries for future dates and today. Do NOT propose changes for past dates.
- If a date already has completed entries (played/practiced), the system will preserve those — so it's safe to propose plan entries for those dates as they'll be skipped for completed pieces`

  if (practicePhilosophy) {
    prompt += `\n\n## Teacher's Practice Philosophy (HIGHEST PRIORITY)\nThe following guidance comes from the student's teacher. These instructions take precedence over any default guidelines above when there is a conflict. Follow them closely — they reflect the teacher's specific approach and preferences:\n\n${practicePhilosophy}`
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
    return { pieces: data || [] }
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

  if (toolName === 'get_experience_log') {
    const limit = Math.min(toolInput.limit || 3, 5)
    const { data } = await supabase.from('experience_log')
      .select('date, summary, feedback, assignments, piece_ids')
      .eq('user_email', profileEmail)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(limit)

    // Resolve piece_ids to titles for context
    const allPieceIds = new Set()
    ;(data || []).forEach(e => (e.piece_ids || []).forEach(id => allPieceIds.add(id)))
    let pieceTitles = {}
    if (allPieceIds.size > 0) {
      const { data: pieces } = await supabase.from('pieces').select('id, title').in('id', [...allPieceIds])
      pieces?.forEach(p => { pieceTitles[p.id] = p.title })
    }

    return (data || []).map(e => ({
      date: e.date,
      what_was_covered: e.summary || '',
      teacher_feedback: e.feedback || '',
      assignments: e.assignments || '',
      pieces_discussed: (e.piece_ids || []).map(id => pieceTitles[id] || 'Unknown').filter(t => t !== 'Unknown'),
    }))
  }

  if (toolName === 'get_piece_notes') {
    // Resolve title to piece ID
    const { data: allPieces } = await supabase.from('pieces')
      .select('id, title').eq('user_id', profileEmail).eq('archived', false).is('deleted_at', null)
    const piece = (allPieces || []).find(p => p.title.toLowerCase().trim() === (toolInput.piece_title || '').toLowerCase().trim())
    if (!piece) return { error: 'Piece not found', available_pieces: (allPieces || []).map(p => p.title) }

    const { data } = await supabase.from('piece_notes')
      .select('note_type, note, created_at')
      .eq('piece_id', piece.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      piece_title: piece.title,
      notes: (data || []).map(n => ({
        type: n.note_type,
        note: n.note,
        date: new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }))
    }
  }

  if (toolName === 'propose_schedule') {
    // Resolve piece titles to real UUIDs
    const { data: allPieces } = await supabase.from('pieces')
      .select('id, title').eq('user_id', profileEmail).eq('archived', false).is('deleted_at', null)
    const titleToId = {}
    const titleToTitle = {}
    for (const p of (allPieces || [])) {
      titleToId[p.title.toLowerCase().trim()] = p.id
      titleToTitle[p.title.toLowerCase().trim()] = p.title
    }

    // Build day-name to date mapping for next 14 days
    const dayNameToDate = {}
    const dayNameToDateNextWeek = {}
    const todayDayIndex = new Date(getLocalDate(0) + 'T12:00:00').getDay()
    for (let i = 0; i < 14; i++) {
      const dateStr = getLocalDate(i)
      const d = new Date(dateStr + 'T12:00:00')
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
      if (i < 7) {
        dayNameToDate[dayName] = dateStr
      } else {
        dayNameToDateNextWeek[dayName] = dateStr
      }
    }

    function resolveDayToDate(dayStr) {
      if (!dayStr) return null
      const lower = dayStr.toLowerCase().trim()
      // Check for "next week" suffix
      if (lower.includes('next week')) {
        const dayName = lower.replace('next week', '').trim()
        return dayNameToDateNextWeek[dayName] || null
      }
      // Try direct day name match (this week)
      return dayNameToDate[lower] || null
    }

    const resolvedSchedule = (toolInput.schedule || []).map(entry => {
      const titleKey = (entry.piece_title || '').toLowerCase().trim()
      const resolvedDate = resolveDayToDate(entry.day) || entry.date || null
      return {
        piece_id: titleToId[titleKey] || null,
        piece_title: titleToTitle[titleKey] || entry.piece_title,
        date: resolvedDate,
        status: entry.status,
      }
    }).filter(entry => entry.piece_id && entry.date)

    const resolvedFocusUpdates = (toolInput.focus_updates || []).map(entry => {
      const key = (entry.piece_title || '').toLowerCase().trim()
      return {
        ...entry,
        piece_id: titleToId[key] || null,
        piece_title: titleToTitle[key] || entry.piece_title,
      }
    }).filter(entry => entry.piece_id)

    // Resolve practice days (day names → dates)
    const resolvedPracticeDays = (toolInput.practice_days || [])
      .map(day => resolveDayToDate(day))
      .filter(Boolean)

    // Resolve priority pieces (titles → IDs)
    const resolvedPriorityPieces = (toolInput.priority_pieces || [])
      .map(title => {
        const key = (title || '').toLowerCase().trim()
        return titleToId[key] ? { piece_id: titleToId[key], piece_title: titleToTitle[key] } : null
      })
      .filter(Boolean)

    return {
      type: 'proposal',
      schedule: resolvedSchedule,
      focus_updates: resolvedFocusUpdates,
      practice_days: resolvedPracticeDays,
      priority_pieces: resolvedPriorityPieces,
      weekly_focus: toolInput.weekly_focus,
      explanation: toolInput.explanation,
    }
  }

  return { error: 'Unknown tool' }
}

async function generateScheduleWithOpus(anthropic, sonnetInput, profileEmail, supabase, practicePhilosophy, conversationMessages) {
  // Gather all context for Opus
  const { data: pieces } = await supabase.from('pieces')
    .select('id, title, composer, current_focus, is_priority, personal_rating, category_id, categories(name)')
    .eq('user_id', profileEmail).eq('archived', false).is('deleted_at', null).order('title')

  const { data: experiences } = await supabase.from('experience_log')
    .select('date, summary, feedback, assignments, piece_ids')
    .eq('user_email', profileEmail).is('deleted_at', null)
    .order('date', { ascending: false }).limit(3)

  // Build the date reference
  const dateRef = []
  for (let i = 0; i < 14; i++) {
    const dateStr = getLocalDate(i)
    const d = new Date(dateStr + 'T12:00:00')
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
    dateRef.push(`${dayName} = ${dateStr}`)
  }

  // Extract the conversation context (what the student said they want)
  const conversationSummary = conversationMessages
    .filter(m => typeof m.content === 'string')
    .map(m => `${m.role}: ${m.content}`)
    .slice(-10)
    .join('\n')

  const opusPrompt = `You are generating a practice schedule for a piano student. Analyze the information below carefully and produce an optimal schedule.

## Pieces (${(pieces || []).length} active)
${(pieces || []).map(p => `- "${p.title}" by ${p.composer || 'unknown'} | Category: ${p.categories?.name || 'Uncategorized'} | Focus: ${p.current_focus || 'none'} | Priority: ${p.is_priority ? 'YES' : 'no'} | Rating: ${p.personal_rating || 'unrated'}`).join('\n')}

## Recent Experience Log
${(experiences || []).length > 0 ? (experiences || []).map(e => `### ${e.date}\nCovered: ${e.summary || 'N/A'}\nTeacher feedback: ${e.feedback || 'N/A'}\nAssignments: ${e.assignments || 'N/A'}`).join('\n\n') : 'No recent lesson records.'}

## Date Reference (use ONLY these day names)
Today: ${getLocalDate(0)}
${dateRef.join('\n')}

## Conversation with Student
${conversationSummary}

## Sonnet's Initial Proposal (use as a starting point but improve it)
${JSON.stringify(sonnetInput, null, 2)}

${practicePhilosophy ? `## Teacher's Practice Philosophy (HIGHEST PRIORITY)\n${practicePhilosophy}` : ''}

## Your Task
Generate the best possible practice schedule. Return ONLY a valid JSON object with these fields:
- schedule: array of {piece_title, day, status} where day is a day name like "Sunday", "Wednesday", etc. (add "next week" for days in the following week), and status is "plan_play" or "plan_practice"
- focus_updates: array of {piece_title, focus} with specific, actionable focus areas
- practice_days: array of day names that should be marked as practice days
- priority_pieces: array of piece titles that should be marked as priority
- weekly_focus: string with the overall theme for the week
- explanation: string explaining the rationale

## CRITICAL SCHEDULING RULE
EVERY active piece must appear in the schedule at least 1-2 times per week. Not just priority pieces — ALL pieces. A student with 15 pieces and 5 practice days should have every single piece scheduled at least once. Priority pieces get more slots (3-5 times), but non-priority pieces still get 1-2 slots. Distribute pieces across days so each day has a manageable number. If there are many pieces, some days will have more entries. This is non-negotiable.

## Schedule Building Algorithm
1. List ALL active pieces (not just priorities)
2. For each practice day, assign at most 2-3 pieces as "plan_practice" — the rest MUST be "plan_play". This is a hard limit from the teacher.
3. Priority pieces should appear 3-5 times across the week, but NOT all as "plan_practice" every day — mix practice and play days for them too
4. Distribute ALL remaining non-priority pieces across the available days, 1-2 times each as "plan_play"
5. Start each day with 1-2 technical pieces if the student has them
6. Ensure every single active piece appears at least once in the schedule
7. Set focus areas for priority pieces (specific, actionable)
8. Verify: count unique pieces in your schedule — it MUST equal the total number of active pieces
9. Verify: no day has more than 2-3 pieces with status "plan_practice" — the rest must be "plan_play"

Think carefully about:
1. What the student told you they want
2. What the teacher's experience log says they should work on
3. The teacher's practice philosophy — follow it closely
4. Every piece must be included, not just priorities
5. Setting specific, meaningful focus areas based on where each piece is

Return ONLY the JSON object, no markdown, no explanation outside the JSON.`

  try {
    const opusResponse = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: opusPrompt }],
    })

    const text = opusResponse.content[0]?.text || ''
    // Parse JSON from response (strip any markdown fencing if present)
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(jsonStr)
    return parsed
  } catch (err) {
    console.error('Opus schedule generation failed:', err)
    // Fall back to Sonnet's original proposal
    return sonnetInput
  }
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
  let maxRounds = 8
  while (maxRounds > 0) {
    maxRounds--

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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
      if (toolUse.name === 'propose_schedule') {
        // Hand off schedule generation to Opus for better reasoning
        const opusProposal = await generateScheduleWithOpus(
          anthropic, toolUse.input, profileEmail, supabase, practicePhilosophy, currentMessages
        )
        const resolved = await handleToolCall('propose_schedule', opusProposal, profileEmail, supabase)
        if (resolved?.type === 'proposal') proposal = resolved

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(resolved)
        })
      } else {
        const result = await handleToolCall(toolUse.name, toolUse.input, profileEmail, supabase)
        if (result?.type === 'proposal') proposal = result

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        })
      }
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
