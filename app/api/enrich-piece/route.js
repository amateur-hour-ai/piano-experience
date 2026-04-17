import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { title, composer, bookTitle, bookEditor } = await request.json()

    const context = [
      title && `Title: "${title}"`,
      composer && `Composer: ${composer}`,
      bookTitle && `From the book: "${bookTitle}"`,
      bookEditor && `Edited by: ${bookEditor}`,
    ].filter(Boolean).join('\n')

    if (!context) {
      return Response.json({ error: 'Please enter at least a title or composer' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `I have the following information about a piano piece:\n${context}\n\nBased on this information, return a JSON object with as many of these fields as you can determine (use null for anything you can't determine with confidence):\n{\n  "title": "full piece title if you can confirm or correct it",\n  "composer": "composer full name",\n  "book_title": "if from a known book/collection",\n  "book_editor": "editor of the book if known",\n  "key_signature": "e.g. C Major, A minor",\n  "time_signature": "e.g. 4/4, 3/4",\n  "tempo_marking": "e.g. Allegro, Andante",\n  "period": "e.g. Baroque, Classical, Romantic, Modern",\n  "ai_summary": "A 2-3 sentence interesting description about this piece, the composer, or the musical period. Make it engaging and educational. Do not use markdown formatting."\n}\nReturn ONLY the JSON, no other text.`
        }
      ]
    })

    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const analysis = JSON.parse(jsonMatch[0])
    return Response.json({ analysis })
  } catch (error) {
    console.error('AI enrichment error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
