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

  // Check permission
  const access = await checkPermission(supabase, decodedEmail, myEmail)
  if (!access) return Response.json({ error: 'No access to this profile' }, { status: 403 })

  const { data, error } = await supabase
    .from('pieces')
    .select('*, categories(name)')
    .eq('user_id', decodedEmail)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ pieces: data, accessLevel: access })
}

export async function POST(request, { params }) {
  const { email: profileEmail } = await params
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminSupabase()
  const decodedEmail = decodeURIComponent(profileEmail)

  const access = await checkPermission(supabase, decodedEmail, myEmail)
  if (access !== 'edit') return Response.json({ error: 'Edit access required' }, { status: 403 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('pieces')
    .insert([{ ...body, user_id: decodedEmail }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ piece: data })
}
