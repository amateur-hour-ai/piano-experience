import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getAuthEmail() {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll() {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email
}

export async function POST(request) {
  const email = await getAuthEmail()
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await request.json()
  if (!text?.trim()) return Response.json({ error: 'Text required' }, { status: 400 })

  // Truncate to avoid huge API costs on very long text
  const truncated = text.slice(0, 4000)

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: truncated,
        voice: 'nova',
        response_format: 'mp3',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI TTS error:', err)
      return Response.json({ error: 'Voice generation failed' }, { status: 500 })
    }

    // Stream the audio back
    return new Response(res.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('TTS error:', err)
    return Response.json({ error: 'Voice generation failed' }, { status: 500 })
  }
}
