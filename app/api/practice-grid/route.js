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

export async function GET(request) {
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const profileEmail = url.searchParams.get('profile') || myEmail
  const startDate = url.searchParams.get('start')
  const endDate = url.searchParams.get('end')

  const supabase = adminSupabase()

  // Permission check for cross-profile
  if (profileEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', profileEmail).eq('grantee_email', myEmail).single()
    if (!perm) return Response.json({ error: 'No access' }, { status: 403 })
  }

  let query = supabase.from('practice_grid').select('*').eq('user_email', profileEmail)
  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)

  const { data, error } = await query.order('date')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Also fetch planned practice days
  let daysQuery = supabase.from('practice_days').select('date').eq('user_email', profileEmail)
  if (startDate) daysQuery = daysQuery.gte('date', startDate)
  if (endDate) daysQuery = daysQuery.lte('date', endDate)
  const { data: practiceDays } = await daysQuery

  // Also fetch experimentation focus from user_profiles
  const { data: profileData } = await supabase.from('user_profiles')
    .select('experimentation_focus, weekly_focus').eq('email', profileEmail).limit(1)
  const experimentationFocus = profileData?.[0]?.experimentation_focus || ''
  const weeklyFocus = profileData?.[0]?.weekly_focus || ''

  return Response.json({ grid: data || [], practiceDays: (practiceDays || []).map(d => d.date), experimentationFocus, weeklyFocus })
}

export async function POST(request) {
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, profileEmail: reqProfile, ...body } = await request.json()
  const profileEmail = reqProfile || myEmail
  const supabase = adminSupabase()

  // Permission check
  if (profileEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', profileEmail).eq('grantee_email', myEmail).single()
    if (perm?.access_level !== 'edit') return Response.json({ error: 'Edit access required' }, { status: 403 })
  }

  // Toggle: cycle through statuses. Client sends the NEW status it wants.
  if (action === 'toggle') {
    const { piece_id, date, currentStatus } = body

    // Determine next status in cycle: null → plan_play → plan_practice → played → practiced → null
    const cycle = [null, 'plan_play', 'plan_practice', 'played', 'practiced']
    const currentIdx = cycle.indexOf(currentStatus)
    const newStatus = cycle[(currentIdx + 1) % cycle.length]

    if (newStatus) {
      // Upsert the new status
      const { error } = await supabase.from('practice_grid').upsert({
        user_email: profileEmail, piece_id, date, status: newStatus
      }, { onConflict: 'user_email,piece_id,date' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ status: newStatus })
    } else {
      // Clear (delete row)
      await supabase.from('practice_grid').delete()
        .eq('user_email', profileEmail).eq('piece_id', piece_id).eq('date', date)
      return Response.json({ status: null })
    }
  }

  // Set a specific status (used by home page toggle)
  if (action === 'toggle_to') {
    const { piece_id, date, newStatus } = body
    if (newStatus) {
      const { error } = await supabase.from('practice_grid').upsert({
        user_email: profileEmail, piece_id, date, status: newStatus
      }, { onConflict: 'user_email,piece_id,date' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ status: newStatus })
    } else {
      await supabase.from('practice_grid').delete()
        .eq('user_email', profileEmail).eq('piece_id', piece_id).eq('date', date)
      return Response.json({ status: null })
    }
  }

  // Update focus area on a piece
  if (action === 'update_focus') {
    const { piece_id, current_focus } = body
    const { error } = await supabase.from('pieces').update({ current_focus }).eq('id', piece_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'toggle_priority') {
    const { piece_id, is_priority } = body
    const { error } = await supabase.from('pieces').update({ is_priority }).eq('id', piece_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'update_weekly_focus') {
    const { weekly_focus } = body
    const { error } = await supabase.from('user_profiles').update({ weekly_focus }).eq('email', profileEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'update_experimentation_focus') {
    const { experimentation_focus } = body
    const { error } = await supabase.from('user_profiles').update({ experimentation_focus }).eq('email', profileEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'toggle_practice_day') {
    const { date, isPlanned } = body
    if (isPlanned) {
      await supabase.from('practice_days').delete().eq('user_email', profileEmail).eq('date', date)
    } else {
      await supabase.from('practice_days').upsert({ user_email: profileEmail, date }, { onConflict: 'user_email,date' })
    }
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
