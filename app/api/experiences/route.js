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
  const supabase = adminSupabase()

  if (profileEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', profileEmail).eq('grantee_email', myEmail).single()
    if (!perm) return Response.json({ error: 'No access' }, { status: 403 })
  }

  const { data, error } = await supabase.from('experience_log')
    .select('*').eq('user_email', profileEmail).is('deleted_at', null).order('date', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ experiences: data || [] })
}

export async function POST(request) {
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, profileEmail, ...body } = await request.json()
  const targetEmail = profileEmail || myEmail
  const supabase = adminSupabase()

  if (targetEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', targetEmail).eq('grantee_email', myEmail).single()
    if (perm?.access_level !== 'edit') return Response.json({ error: 'Edit access required' }, { status: 403 })
  }

  if (action === 'add') {
    const { data, error } = await supabase.from('experience_log').insert([{
      user_email: targetEmail, date: body.date, summary: body.summary,
      feedback: body.feedback, assignments: body.assignments, piece_ids: body.piece_ids || []
    }]).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ experience: data })
  }

  if (action === 'update') {
    const { error } = await supabase.from('experience_log').update({
      date: body.date, summary: body.summary, feedback: body.feedback, assignments: body.assignments, piece_ids: body.piece_ids || []
    }).eq('id', body.id).eq('user_email', targetEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'delete') {
    await supabase.from('experience_log').update({ deleted_at: new Date().toISOString() }).eq('id', body.id).eq('user_email', targetEmail)
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
