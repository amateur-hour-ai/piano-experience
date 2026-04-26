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

export async function GET() {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminSupabase()
  const { data } = await supabase.from('user_profiles').select('weekly_email_enabled, weekly_email_day, name').eq('email', email).limit(1)
  return Response.json({ settings: data?.[0] || { weekly_email_enabled: false, weekly_email_day: null } })
}

export async function POST(request) {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { weekly_email_enabled, weekly_email_day, name } = await request.json()
  const supabase = adminSupabase()
  const update = {}
  if (weekly_email_enabled !== undefined) update.weekly_email_enabled = weekly_email_enabled
  if (weekly_email_day !== undefined) update.weekly_email_day = weekly_email_day
  if (name !== undefined) update.name = name
  const { error } = await supabase.from('user_profiles').update(update).eq('email', email)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
