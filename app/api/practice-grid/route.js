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

  return Response.json({ grid: data || [] })
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

  // Toggle: cycle empty → planned → completed → empty
  if (action === 'toggle') {
    const { piece_id, date, currentStatus } = body

    if (!currentStatus) {
      // Empty → planned
      const { error } = await supabase.from('practice_grid').upsert({
        user_email: profileEmail, piece_id, date, status: 'planned'
      }, { onConflict: 'user_email,piece_id,date' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ status: 'planned' })
    } else if (currentStatus === 'planned') {
      // Planned → completed
      const { error } = await supabase.from('practice_grid').update({ status: 'completed' })
        .eq('user_email', profileEmail).eq('piece_id', piece_id).eq('date', date)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ status: 'completed' })
    } else {
      // Completed → empty (delete row)
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

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
