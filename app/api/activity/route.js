import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function GET(request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit')) || 20
  const pieceId = url.searchParams.get('piece_id')

  const supabase = adminSupabase()
  let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (pieceId) q = q.eq('piece_id', pieceId)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ activities: data })
}

export async function POST(request) {
  const { user_email, action, piece_id, piece_title, details } = await request.json()

  const supabase = adminSupabase()
  const { error } = await supabase.from('activity_log').insert([{
    user_email, action, piece_id, piece_title, details
  }])

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
