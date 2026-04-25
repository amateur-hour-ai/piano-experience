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
  const type = url.searchParams.get('type')
  const email = url.searchParams.get('email') || myEmail
  const pieceId = url.searchParams.get('id')

  // Only allow fetching own data through this route
  if (email !== myEmail) return Response.json({ error: 'Use profile API for cross-profile' }, { status: 403 })

  const supabase = adminSupabase()

  if (type === 'pieces') {
    const { data } = await supabase.from('pieces').select('*, categories(name)').eq('user_id', email).order('updated_at', { ascending: false })
    const { data: schedule } = await supabase.from('practice_grid').select('*').eq('user_email', email)
    return Response.json({ pieces: data || [], schedule: schedule || [] })
  }

  if (type === 'schedule') {
    const { data } = await supabase.from('practice_grid').select('*').eq('user_email', email)
    return Response.json({ schedule: data || [] })
  }

  if (type === 'piece-detail') {
    if (!pieceId) return Response.json({ error: 'id required' }, { status: 400 })
    const [pieceRes, imagesRes, notesRes, factsRes, goalsRes, tempoRes] = await Promise.all([
      supabase.from('pieces').select('*, categories(name)').eq('id', pieceId).single(),
      supabase.from('piece_images').select('*').eq('piece_id', pieceId).order('created_at'),
      supabase.from('piece_notes').select('*').eq('piece_id', pieceId).order('created_at', { ascending: false }),
      supabase.from('interesting_facts').select('*').eq('piece_id', pieceId).order('created_at', { ascending: false }),
      supabase.from('piece_goals').select('*').eq('piece_id', pieceId).order('sort_order'),
      supabase.from('tempo_log').select('*').eq('piece_id', pieceId).order('created_at', { ascending: false }),
    ])
    return Response.json({
      piece: pieceRes.data,
      images: imagesRes.data || [],
      notes: notesRes.data || [],
      facts: factsRes.data || [],
      goals: goalsRes.data || [],
      tempoLog: tempoRes.data || [],
    })
  }

  return Response.json({ error: 'Unknown type' }, { status: 400 })
}
