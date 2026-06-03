import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

/**
 * Offline, one-time generator for Pre-K scavenger-hunt picture hints. Closely
 * modeled on pet-image-generator.ts (DALL-E 3 -> fetch -> upload to Supabase ->
 * return public URL). Separation of concerns: this module only turns a prompt row
 * into a stored image; it does not touch selection or gameplay. It is driven by
 * scripts/generate-scavenger-prompt-images.ts and is never called during a hunt.
 */

const STORAGE_BUCKET = 'scavenger-hunt-prompt-images'

export interface PromptImageRow {
  id: string
  prompt_text: string
  target_description: string | null
  example_objects: string[] | null
}

export interface GeneratePromptImageResult {
  success: boolean
  imageUrl?: string
  storagePath?: string
  error?: string
}

/**
 * Build the DALL-E prompt for a clue. Uses the hidden target description (and a
 * representative example object) so the picture matches what the verifier accepts.
 * Hard constraints: a single centered object, plain white background, NO text — a
 * non-reader must get the meaning from the picture alone.
 */
export function buildImagePrompt(row: PromptImageRow): string {
  const target =
    row.target_description?.trim() ||
    row.example_objects?.[0] ||
    row.prompt_text.replace(/^find\s+/i, '').replace(/[.!?]$/, '')
  return (
    `A simple, friendly, brightly colored flat illustration of ${target}, ` +
    `a single object centered on a plain white background. ` +
    `Picture-book style for a preschooler. No text, no words, no letters.`
  )
}

/**
 * Generate one image and upload it to the public bucket. Stateless (takes its own
 * OpenAI + Supabase service clients) so the driver script can call it per prompt.
 */
export async function generatePromptImage(
  row: PromptImageRow
): Promise<GeneratePromptImageResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!openaiApiKey) {
    return { success: false, error: 'Missing OPENAI_API_KEY' }
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: 'Missing Supabase configuration' }
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: buildImagePrompt(row),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    })

    const tempImageUrl = response.data?.[0]?.url
    if (!tempImageUrl) {
      return { success: false, error: 'No image URL returned from DALL-E' }
    }

    const imageResponse = await fetch(tempImageUrl)
    if (!imageResponse.ok) {
      return { success: false, error: 'Failed to fetch generated image' }
    }
    const imageBuffer = await imageResponse.arrayBuffer()

    const storagePath = `prompts/${row.id}.png`
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '31536000', // 1 year — these illustrations never change
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    // Persist the URL on the prompt row so gameplay (and other environments, via the
    // emitted migration) get it without re-paying for generation.
    const { error: updateError } = await supabase
      .from('scavenger_hunt_prompts')
      .update({
        image_url: publicUrlData.publicUrl,
        image_storage_path: storagePath,
      })
      .eq('id', row.id)

    if (updateError) {
      return { success: false, error: `Row update failed: ${updateError.message}` }
    }

    return {
      success: true,
      imageUrl: publicUrlData.publicUrl,
      storagePath,
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        return { success: false, error: 'Rate limited — slow down and retry.' }
      }
      if (error.status === 400) {
        return { success: false, error: 'Image request rejected (content policy?).' }
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown generation error',
    }
  }
}
