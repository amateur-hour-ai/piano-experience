import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { pieceId, title, composer, bookTitle, bookEditor, period, existingFacts, aiSummary, composerBio } = await request.json()

    const context = [
      title && `Piece: "${title}"`,
      composer && `Composer: ${composer}`,
      bookTitle && `From the book: "${bookTitle}"`,
      bookEditor && `Edited by: ${bookEditor}`,
      period && `Period: ${period}`,
    ].filter(Boolean).join('\n')

    let avoidSection = ''
    const avoidItems = []
    if (aiSummary) avoidItems.push(`AI Summary: ${aiSummary}`)
    if (composerBio) avoidItems.push(`Composer Bio: ${composerBio}`)
    if (existingFacts?.length) {
      existingFacts.forEach((f, i) => avoidItems.push(`Previous fact ${i + 1}: ${f}`))
    }
    if (avoidItems.length) {
      avoidSection = `\n\nIMPORTANT — The following information has already been shared with the user. Do NOT repeat, rephrase, or overlap with any of it:\n${avoidItems.join('\n')}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Here is information about a piano piece:\n${context}${avoidSection}\n\nTell me one interesting, surprising, or fun fact about this piece, its composer, the book it comes from, the editor, the musical period, contemporaries of the composer, or similar pieces. Be specific and educational. Keep it to 2-3 sentences. Start directly with the fact. Do not use markdown formatting — no headings, no bold, no bullet points. Plain text only.`
        }
      ]
    })

    let fact = response.content[0].text.trim()
    // Strip any leading markdown heading characters
    fact = fact.replace(/^#+\s*/, '')

    // Save the fact
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    await supabase.from('interesting_facts').insert([{
      piece_id: pieceId,
      fact
    }])

    return Response.json({ fact })
  } catch (error) {
    console.error('Interesting fact error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
