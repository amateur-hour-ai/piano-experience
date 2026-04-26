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

async function checkPermission(supabase, ownerEmail, granteeEmail) {
  const { data } = await supabase
    .from('profile_permissions')
    .select('access_level')
    .eq('owner_email', ownerEmail)
    .eq('grantee_email', granteeEmail)
    .single()
  return data?.access_level || null
}

export async function GET(request, { params }) {
  const { email: profileEmail } = await params
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminSupabase()
  const decodedEmail = decodeURIComponent(profileEmail)

  const access = await checkPermission(supabase, decodedEmail, myEmail)
  if (!access) return Response.json({ error: 'No access to this profile' }, { status: 403 })

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_email', decodedEmail)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ activities: data || [], accessLevel: access })
}
