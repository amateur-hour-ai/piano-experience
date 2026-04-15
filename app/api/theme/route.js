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

export async function GET() {
  const supabase = adminSupabase()
  const { data } = await supabase.from('theme_of_week').select('*').order('created_at', { ascending: false }).limit(1).single()
  return Response.json({ theme: data || null })
}

export async function POST(request) {
  const email = await getAuthEmail()
  if (email !== ADMIN_EMAIL) return Response.json({ error: 'Admin only' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const supabase = adminSupabase()
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `theme/theme-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('piece-images')
    .upload(fileName, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('piece-images').getPublicUrl(fileName)

  const { data, error } = await supabase.from('theme_of_week').insert([{ image_url: publicUrl }]).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ theme: data })
}
