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
  const { email: profileEmail, id } = await params
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminSupabase()
  const decodedEmail = decodeURIComponent(profileEmail)

  const access = await checkPermission(supabase, decodedEmail, myEmail)
  if (!access) return Response.json({ error: 'No access to this profile' }, { status: 403 })

  const [pieceRes, imagesRes, notesRes, factsRes, catsRes, goalsRes, tempoRes] = await Promise.all([
    supabase.from('pieces').select('*, categories(name)').eq('id', id).eq('user_id', decodedEmail).single(),
    supabase.from('piece_images').select('*').eq('piece_id', id).order('created_at'),
    supabase.from('piece_notes').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
    supabase.from('interesting_facts').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
    supabase.from('categories').select('*').or(`user_id.eq.${decodedEmail},user_id.is.null`).order('sort_order'),
    supabase.from('piece_goals').select('*').eq('piece_id', id).order('sort_order'),
    supabase.from('tempo_log').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
  ])

  if (!pieceRes.data) return Response.json({ error: 'Piece not found' }, { status: 404 })

  return Response.json({
    piece: pieceRes.data,
    images: imagesRes.data || [],
    notes: notesRes.data || [],
    facts: factsRes.data || [],
    categories: catsRes.data || [],
    goals: goalsRes.data || [],
    tempoLog: tempoRes.data || [],
    accessLevel: access,
  })
}

export async function POST(request, { params }) {
  const { email: profileEmail, id } = await params
  const myEmail = await getAuthEmail()
  if (!myEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = adminSupabase()
  const decodedEmail = decodeURIComponent(profileEmail)

  const access = await checkPermission(supabase, decodedEmail, myEmail)
  if (access !== 'edit') return Response.json({ error: 'Edit access required' }, { status: 403 })

  const { action, ...body } = await request.json()

  if (action === 'update') {
    // Log tempo change if metronome marking changed
    const newBpm = body.fields?.metronome_marking
    const oldBpm = body.oldMetronome
    if (newBpm && newBpm !== oldBpm) {
      const bpmNum = parseInt(newBpm.replace(/[^\d]/g, ''))
      if (bpmNum > 0) {
        await supabase.from('tempo_log').insert([{ piece_id: id, bpm: bpmNum }])
      }
    }
    const { error } = await supabase.from('pieces').update(body.fields).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  if (action === 'delete') {
    await supabase.from('piece_notes').delete().eq('piece_id', id)
    await supabase.from('piece_images').delete().eq('piece_id', id)
    await supabase.from('interesting_facts').delete().eq('piece_id', id)
    await supabase.from('practice_schedule').delete().eq('piece_id', id)
    await supabase.from('pieces').delete().eq('id', id)
    return Response.json({ success: true })
  }

  if (action === 'add_note') {
    const { error } = await supabase.from('piece_notes').insert([{
      piece_id: id, user_id: decodedEmail, note_type: body.note_type, note: body.note
    }])
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
