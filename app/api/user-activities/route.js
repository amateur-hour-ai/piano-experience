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

  // Permission check for cross-profile
  if (profileEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', profileEmail).eq('grantee_email', myEmail).single()
    if (!perm) return Response.json({ error: 'No access' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_email', profileEmail)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ activities: data || [] })
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

  if (action === 'create') {
    const { description } = body
    if (!description?.trim()) return Response.json({ error: 'Description required' }, { status: 400 })
    const { data, error } = await supabase.from('activities')
      .insert({ user_email: profileEmail, description: description.trim() })
      .select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ activity: data })
  }

  if (action === 'complete') {
    const { id, completed_date } = body
    const { error } = await supabase.from('activities')
      .update({ completed_date })
      .eq('id', id).eq('user_email', profileEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'uncomplete') {
    const { id } = body
    const { error } = await supabase.from('activities')
      .update({ completed_date: null })
      .eq('id', id).eq('user_email', profileEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'reflect') {
    const { id, reflection } = body
    const { error } = await supabase.from('activities')
      .update({ reflection })
      .eq('id', id).eq('user_email', profileEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'delete') {
    const { id } = body
    const { error } = await supabase.from('activities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id).eq('user_email', profileEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
