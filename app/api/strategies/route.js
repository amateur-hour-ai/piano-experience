import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'michael.rosenthal@gmail.com'

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
  const standardOnly = url.searchParams.get('standard') === 'true'

  const supabase = adminSupabase()

  if (standardOnly) {
    const { data } = await supabase.from('practice_strategies').select('*').is('user_email', null).order('sort_order')
    return Response.json({ strategies: data || [], isStandard: true })
  }

  // Check if viewing another profile
  if (profileEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', profileEmail).eq('grantee_email', myEmail).single()
    if (!perm) return Response.json({ error: 'No access' }, { status: 403 })
  }

  // Get user's strategies
  let { data: userStrategies } = await supabase.from('practice_strategies')
    .select('*').eq('user_email', profileEmail).order('sort_order')

  // If user has no strategies, copy from standard
  if (!userStrategies || userStrategies.length === 0) {
    const { data: standards } = await supabase.from('practice_strategies')
      .select('*').is('user_email', null).order('sort_order')

    if (standards && standards.length > 0) {
      const copies = standards.map((s, i) => ({
        user_email: profileEmail,
        heading: s.heading,
        bullets: s.bullets,
        sort_order: i,
      }))
      const { data: inserted } = await supabase.from('practice_strategies')
        .insert(copies).select()
      userStrategies = inserted || []
    }
  }

  return Response.json({ strategies: userStrategies || [] })
}

export async function POST(request) {
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, profileEmail, ...body } = await request.json()
  const targetEmail = profileEmail || myEmail
  const supabase = adminSupabase()

  // Permission check for editing another's strategies
  if (targetEmail !== myEmail) {
    const { data: perm } = await supabase.from('profile_permissions')
      .select('access_level').eq('owner_email', targetEmail).eq('grantee_email', myEmail).single()
    if (perm?.access_level !== 'edit') return Response.json({ error: 'Edit access required' }, { status: 403 })
  }

  // Editing standard strategies — admin only
  if (action === 'update_standard') {
    if (myEmail !== ADMIN_EMAIL) return Response.json({ error: 'Admin only' }, { status: 403 })
    const { id, heading, bullets } = body
    const { error } = await supabase.from('practice_strategies').update({ heading, bullets }).eq('id', id).is('user_email', null)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'add_standard') {
    if (myEmail !== ADMIN_EMAIL) return Response.json({ error: 'Admin only' }, { status: 403 })
    const { heading, bullets, sort_order } = body
    const { data, error } = await supabase.from('practice_strategies')
      .insert([{ user_email: null, heading, bullets: bullets || [], sort_order }]).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ strategy: data })
  }

  if (action === 'delete_standard') {
    if (myEmail !== ADMIN_EMAIL) return Response.json({ error: 'Admin only' }, { status: 403 })
    await supabase.from('practice_strategies').delete().eq('id', body.id).is('user_email', null)
    return Response.json({ success: true })
  }

  if (action === 'update') {
    const { id, heading, bullets } = body
    const { error } = await supabase.from('practice_strategies').update({ heading, bullets }).eq('id', id).eq('user_email', targetEmail)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'add') {
    const { heading, bullets, sort_order } = body
    const { data, error } = await supabase.from('practice_strategies')
      .insert([{ user_email: targetEmail, heading, bullets: bullets || [], sort_order }]).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ strategy: data })
  }

  if (action === 'delete') {
    await supabase.from('practice_strategies').delete().eq('id', body.id).eq('user_email', targetEmail)
    return Response.json({ success: true })
  }

  if (action === 'reorder') {
    const { items } = body
    for (const item of items) {
      await supabase.from('practice_strategies').update({ sort_order: item.sort_order }).eq('id', item.id)
    }
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
