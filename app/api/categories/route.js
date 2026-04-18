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

  // Get all categories visible to this user (system defaults + their own)
  const { data: categories } = await supabase.from('categories')
    .select('*').or(`user_id.is.null,user_id.eq.${profileEmail}`).order('sort_order')

  // Get user's sort preferences
  const { data: prefs } = await supabase.from('category_sort_preferences')
    .select('*').eq('user_email', profileEmail)

  // Apply user sort — fall back to default sort_order
  const prefMap = {}
  prefs?.forEach(p => { prefMap[p.category_id] = p.sort_order })

  const sorted = (categories || []).map(c => ({
    ...c,
    effective_sort: prefMap[c.id] !== undefined ? prefMap[c.id] : c.sort_order
  })).sort((a, b) => a.effective_sort - b.effective_sort)

  return Response.json({ categories: sorted, hasPreferences: (prefs?.length || 0) > 0 })
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

  if (action === 'reorder') {
    // body.items = [{ category_id, sort_order }]
    for (const item of body.items) {
      await supabase.from('category_sort_preferences').upsert({
        user_email: profileEmail, category_id: item.category_id, sort_order: item.sort_order
      }, { onConflict: 'user_email,category_id' })
    }
    return Response.json({ success: true })
  }

  if (action === 'add') {
    const { data, error } = await supabase.from('categories').insert([{
      user_id: profileEmail, name: body.name, sort_order: body.sort_order || 99
    }]).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ category: data })
  }

  if (action === 'rename') {
    // Only allow renaming user-created categories
    const { data: cat } = await supabase.from('categories').select('user_id').eq('id', body.id).single()
    if (!cat?.user_id) return Response.json({ error: 'Cannot rename system categories' }, { status: 403 })
    const { error } = await supabase.from('categories').update({ name: body.name }).eq('id', body.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'delete') {
    const { data: cat } = await supabase.from('categories').select('user_id').eq('id', body.id).single()
    if (!cat?.user_id) return Response.json({ error: 'Cannot delete system categories' }, { status: 403 })
    // Remove sort preferences first
    await supabase.from('category_sort_preferences').delete().eq('category_id', body.id)
    // Set pieces in this category to uncategorized
    await supabase.from('pieces').update({ category_id: null }).eq('category_id', body.id)
    // Delete the category
    await supabase.from('categories').delete().eq('id', body.id)
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
