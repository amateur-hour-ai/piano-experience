import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const { imageBase64, imageMediaType } = await request.json()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageMediaType || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this sheet music image. Return a JSON object with these fields (use null for anything you can't determine):
{
  "title": "piece title",
  "composer": "composer full name",
  "book_title": "if from a book/collection, the book title",
  "book_editor": "editor of the book if visible",
  "key_signature": "e.g. C Major, A minor",
  "time_signature": "e.g. 4/4, 3/4",
  "tempo_marking": "e.g. Allegro, Andante",
  "difficulty_level": "Beginner/Intermediate/Advanced",
  "period": "e.g. Baroque, Classical, Romantic, Modern",
  "ai_summary": "A 2-3 sentence interesting description about this piece, the composer, or the musical period. Make it engaging and educational."
}
Return ONLY the JSON, no other text.`
            }
          ]
        }
      ]
    })

    const text = response.content[0].text
    // Try to parse JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return Response.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const analysis = JSON.parse(jsonMatch[0])
    return Response.json({ analysis })
  } catch (error) {
    console.error('AI analysis error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
