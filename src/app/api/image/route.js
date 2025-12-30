import { generateImage } from '@/lib/replicate'

export async function POST(request) {
  try {
    const body = await request.json()
    const { prompt, aspectRatio, model } = body

    if (!prompt) {
      return Response.json(
        { error: 'Prompt is required for image generation' },
        { status: 400 }
      )
    }

    const result = await generateImage(prompt, {
      aspectRatio: aspectRatio || '1:1',
      model: model || 'google/imagen-4'
    })

    return Response.json({
      success: true,
      imageUrl: result.imageUrl,
      model: result.model,
      prompt: prompt
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return Response.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    )
  }
}
