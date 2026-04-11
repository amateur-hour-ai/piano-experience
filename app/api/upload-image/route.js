import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const pieceId = formData.get('piece_id')
    const imageType = formData.get('image_type') || 'first_page'

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${pieceId}/${imageType}-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('piece-images')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('piece-images')
      .getPublicUrl(fileName)

    // Save image record
    await supabase.from('piece_images').insert([{
      piece_id: pieceId,
      image_url: publicUrl,
      image_type: imageType,
    }])

    return Response.json({ url: publicUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
