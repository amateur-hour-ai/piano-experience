import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

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

export async function GET() {
  const email = await getAuthEmail()
  if (email !== ADMIN_EMAIL) return Response.json({ error: 'Admin only' }, { status: 403 })

  const supabase = adminSupabase()
  const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
  return Response.json({ feedback: data || [] })
}

export async function POST(request) {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, ...body } = await request.json()

  const supabase = adminSupabase()

  if (action === 'submit') {
    const { data, error } = await supabase.from('feedback').insert([{
      user_email: email, type: body.type || 'suggestion', message: body.message
    }]).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Email admin
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: ADMIN_EMAIL,
        subject: `Piano Experience Feedback — ${body.type || 'Suggestion'} from ${email}`,
        html: `<h2>New Feedback</h2><p><strong>From:</strong> ${email}</p><p><strong>Type:</strong> ${body.type || 'Suggestion'}</p><p><strong>Message:</strong></p><p>${body.message}</p>`
      })
    } catch {}

    return Response.json({ success: true })
  }

  if (action === 'resolve') {
    if (email !== ADMIN_EMAIL) return Response.json({ error: 'Admin only' }, { status: 403 })
    await supabase.from('feedback').update({ status: body.status || 'resolved' }).eq('id', body.id)
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
