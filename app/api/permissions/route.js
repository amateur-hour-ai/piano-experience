import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getAuthEmail() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email
}

export async function GET() {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminSupabase()

  // Get permissions I've granted
  const { data: granted } = await supabase
    .from('profile_permissions')
    .select('*')
    .eq('owner_email', email)
    .order('created_at')

  // Get permissions granted to me
  const { data: received } = await supabase
    .from('profile_permissions')
    .select('*')
    .eq('grantee_email', email)
    .order('created_at')

  // Fetch names for all referenced emails
  const allEmails = new Set()
  allEmails.add(email)
  ;(granted || []).forEach(g => allEmails.add(g.grantee_email))
  ;(received || []).forEach(r => allEmails.add(r.owner_email))
  const { data: profiles } = await supabase.from('user_profiles')
    .select('email, name').in('email', [...allEmails])
  const nameMap = {}
  ;(profiles || []).forEach(p => { nameMap[p.email] = p.name })

  return Response.json({ granted: granted || [], received: received || [], nameMap })
}

export async function POST(request) {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { grantee_email, access_level } = await request.json()

  if (!grantee_email || !access_level) {
    return Response.json({ error: 'Email and access level required' }, { status: 400 })
  }
  if (grantee_email === email) {
    return Response.json({ error: 'Cannot grant access to yourself' }, { status: 400 })
  }
  if (!['view', 'edit'].includes(access_level)) {
    return Response.json({ error: 'Access level must be view or edit' }, { status: 400 })
  }

  // Verify grantee exists
  const supabase = adminSupabase()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('email', grantee_email)
    .single()

  if (!profile) {
    return Response.json({ error: 'User not found. They must sign up first.' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('profile_permissions')
    .upsert({
      owner_email: email,
      grantee_email,
      access_level,
    }, { onConflict: 'owner_email,grantee_email' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ permission: data })
}

export async function DELETE(request) {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const grantee_email = url.searchParams.get('grantee_email')

  if (!grantee_email) {
    return Response.json({ error: 'grantee_email required' }, { status: 400 })
  }

  const supabase = adminSupabase()
  await supabase
    .from('profile_permissions')
    .delete()
    .eq('owner_email', email)
    .eq('grantee_email', grantee_email)

  return Response.json({ success: true })
}
