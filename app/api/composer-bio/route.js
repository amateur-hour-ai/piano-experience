import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { pieceId, composer, aiSummary } = await request.json()

    if (!composer) {
      return Response.json({ error: 'No composer provided' }, { status: 400 })
    }

    let avoidSection = ''
    if (aiSummary) {
      avoidSection = `\n\nIMPORTANT: The following AI summary about the piece has already been shared. Make sure your composer bio covers different ground and does not repeat this information:\n${aiSummary}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `Write a brief, engaging biography of the composer ${composer} for a piano student. Focus on who they were as a person — their life, musical style, significance in music history, and any interesting personal details. Keep it to 3-4 sentences. Do not use markdown formatting — no headings, no bold, no bullet points. Plain text only. Start directly with the biography.${avoidSection}`
        }
      ]
    })

    let bio = response.content[0].text.trim()
    bio = bio.replace(/^#+\s*/, '')

    // Save to the piece
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    await supabase.from('pieces').update({ composer_bio: bio }).eq('id', pieceId)

    return Response.json({ bio })
  } catch (error) {
    console.error('Composer bio error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
