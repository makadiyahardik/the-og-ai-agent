import Replicate from 'replicate'

const replicate = process.env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null

export async function generateImage(prompt, options = {}) {
  if (!replicate) {
    throw new Error('Replicate API token not configured')
  }

  const {
    model = 'black-forest-labs/flux-schnell',
    aspectRatio = '1:1'
  } = options

  console.log('Generating image with model:', model)
  console.log('Prompt:', prompt)

  try {
    let output

    if (model === 'black-forest-labs/flux-schnell') {
      // FLUX Schnell - fast and high quality
      output = await replicate.run(
        'black-forest-labs/flux-schnell',
        {
          input: {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            output_format: 'webp',
            output_quality: 90,
            num_outputs: 1
          }
        }
      )
    } else if (model === 'stability-ai/stable-diffusion-3') {
      // Stable Diffusion 3
      output = await replicate.run(
        'stability-ai/stable-diffusion-3',
        {
          input: {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            output_format: 'webp',
            output_quality: 90
          }
        }
      )
    } else {
      // Default/Imagen 4
      output = await replicate.run(
        model,
        {
          input: {
            prompt: prompt,
            aspect_ratio: aspectRatio,
            number_of_images: 1
          }
        }
      )
    }

    console.log('Replicate output:', output)
    console.log('Output type:', typeof output)

    // Handle array of URLs (most common)
    if (Array.isArray(output) && output.length > 0) {
      const url = output[0]
      // Handle FileOutput object
      if (typeof url === 'object' && url.url) {
        return { success: true, imageUrl: url.url(), model }
      }
      // Handle string URL
      if (typeof url === 'string') {
        return { success: true, imageUrl: url, model }
      }
      // Try toString for FileOutput
      if (url && typeof url.toString === 'function') {
        const urlStr = url.toString()
        if (urlStr.startsWith('http')) {
          return { success: true, imageUrl: urlStr, model }
        }
      }
    }

    // Handle single string URL
    if (typeof output === 'string' && output.startsWith('http')) {
      return { success: true, imageUrl: output, model }
    }

    // Handle object with url property
    if (output && typeof output === 'object') {
      if (output.url) {
        const url = typeof output.url === 'function' ? output.url() : output.url
        return { success: true, imageUrl: url, model }
      }
      // Try toString
      if (typeof output.toString === 'function') {
        const urlStr = output.toString()
        if (urlStr.startsWith('http')) {
          return { success: true, imageUrl: urlStr, model }
        }
      }
    }

    console.error('Unexpected output format:', JSON.stringify(output, null, 2))
    throw new Error('Unexpected response format from image generation')

  } catch (error) {
    console.error('Image generation error:', error.message)

    // If primary model fails, try fallback
    if (model === 'black-forest-labs/flux-schnell') {
      console.log('Falling back to Stable Diffusion 3...')
      return generateImage(prompt, {
        ...options,
        model: 'stability-ai/stable-diffusion-3'
      })
    }

    throw error
  }
}
