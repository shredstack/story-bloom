'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Story, StoryGenerationResponse, Illustration, SkinTone, HairColor, EyeColor, Gender, Pronouns } from '@/lib/types'

export interface PhysicalCharacteristicsForApi {
  skinTone: SkinTone | null
  hairColor: HairColor | null
  eyeColor: EyeColor | null
  gender: Gender | null
  pronouns: Pronouns | null
}

export interface SourceIllustrationForApi {
  url: string
  title: string
  description: string | null
}

export function useStories(childId: string | undefined) {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchStories = useCallback(async () => {
    if (!childId) {
      setStories([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching stories:', error)
      setLoading(false)
      return
    }

    setStories(data || [])
    setLoading(false)
  }, [childId, supabase])

  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  const createStory = async (
    title: string,
    content: string,
    customPrompt: string | null,
    illustrations: Illustration[] | null,
    sourceIllustrationUrl: string | null = null
  ): Promise<Story | null> => {
    if (!childId) return null

    const { data, error } = await supabase
      .from('stories')
      .insert([{
        child_id: childId,
        title,
        content,
        custom_prompt: customPrompt,
        illustrations,
        is_favorited: false,
        source_illustration_url: sourceIllustrationUrl,
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating story:', error)
      return null
    }

    setStories(prev => [data, ...prev])
    return data
  }

  const toggleFavorite = async (storyId: string): Promise<boolean> => {
    const story = stories.find(s => s.id === storyId)
    if (!story) return false

    const { error } = await supabase
      .from('stories')
      .update({ is_favorited: !story.is_favorited })
      .eq('id', storyId)

    if (error) {
      console.error('Error toggling favorite:', error)
      return false
    }

    setStories(prev =>
      prev.map(s => s.id === storyId ? { ...s, is_favorited: !s.is_favorited } : s)
    )
    return true
  }

  const deleteStory = async (storyId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('stories')
      .delete()
      .eq('id', storyId)

    if (error) {
      console.error('Error deleting story:', error)
      return false
    }

    setStories(prev => prev.filter(s => s.id !== storyId))
    return true
  }

  const updateStoryIllustrations = async (
    storyId: string,
    illustrations: Illustration[]
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('stories')
      .update({ illustrations })
      .eq('id', storyId)

    if (error) {
      console.error('Error updating story illustrations:', error)
      return false
    }

    setStories(prev =>
      prev.map(s => s.id === storyId ? { ...s, illustrations } : s)
    )
    return true
  }

  return {
    stories,
    loading,
    createStory,
    toggleFavorite,
    deleteStory,
    updateStoryIllustrations,
    refreshStories: fetchStories,
  }
}

/**
 * Generating a story is one long request: Claude writes the text, then
 * gpt-image-1 draws the illustration, then it uploads to storage. That routinely
 * takes 25-90s, so the browser holds a connection open the whole time. On a phone
 * that connection is fragile — locking the screen, backgrounding the app, or a
 * wifi/cellular handoff kills it. The ceiling below just makes that failure
 * arrive cleanly instead of hanging on a spinner forever.
 */
const GENERATION_TIMEOUT_MS = 180_000

/**
 * A network failure this fast means the request never reached the server, so no
 * story was written and no API spend happened — retrying is free. Past this
 * point the server may well have finished the work, so we surface the error and
 * let the parent decide rather than silently paying for a second story that
 * nobody will ever see.
 */
const SAFE_RETRY_WINDOW_MS = 3_000

const NETWORK_ERROR_MESSAGE =
  "The connection dropped before the story was ready. This can happen if the app goes to sleep or your connection changes while it's writing. Tap Generate to try again."

const TIMEOUT_ERROR_MESSAGE =
  'The story took too long to write and timed out. Tap Generate to try again.'

/**
 * A TypeError here means the transport failed rather than the server. Usually
 * that's fetch() rejecting before any response headers arrived — but it also
 * covers a connection that drops mid-body, where `response.json()` throws a
 * TypeError even though the server did (and billed for) the whole job.
 *
 * So this alone must never authorise a retry: the SAFE_RETRY_WINDOW_MS elapsed
 * check is what distinguishes "never reached the server" from "we lost the
 * answer to work already paid for". Don't relax that guard.
 */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError
}

/**
 * `controller.abort()` rejects the fetch with a DOMException named AbortError.
 * Match on the name alone — a failed `instanceof` would leak the engine's raw
 * "signal is aborted without reason" text to a parent.
 */
function isTimeoutError(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError'
}

function toParentFacingMessage(err: unknown): string {
  if (isTimeoutError(err)) return TIMEOUT_ERROR_MESSAGE
  if (isNetworkError(err)) return NETWORK_ERROR_MESSAGE
  return err instanceof Error ? err.message : 'An error occurred'
}

export function useGenerateStory() {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateStory = async (
    childName: string,
    childAge: number,
    readingLevel: string,
    favoriteThings: string[],
    parentSummary: string | null,
    customPrompt: string | null,
    sourceIllustration: SourceIllustrationForApi | null = null,
    physicalCharacteristics: PhysicalCharacteristicsForApi | null = null
  ): Promise<StoryGenerationResponse | null> => {
    setGenerating(true)
    setError(null)

    const payload = {
      childName,
      childAge,
      readingLevel,
      favoriteThings,
      parentSummary,
      customPrompt,
      sourceIllustration,
      physicalCharacteristics,
    }

    const attempt = async (): Promise<StoryGenerationResponse> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

      try {
        const response = await fetch('/api/generate-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          console.error('API returned non-JSON response:', {
            status: response.status,
            contentType,
            url: response.url,
          })
          throw new Error('LLM API failure - please try again!')
        }

        if (!response.ok) {
          const errorData = await response.json()
          console.error('API error response:', errorData)
          throw new Error(errorData.error || 'Failed to generate story')
        }

        return (await response.json()) as StoryGenerationResponse
      } finally {
        clearTimeout(timeoutId)
      }
    }

    const startedAt = Date.now()

    try {
      return await attempt()
    } catch (err) {
      const elapsed = Date.now() - startedAt
      console.error('Story generation failed:', err)

      if (isNetworkError(err) && elapsed < SAFE_RETRY_WINDOW_MS) {
        console.warn(`Request failed after ${elapsed}ms without reaching the server; retrying once.`)
        try {
          return await attempt()
        } catch (retryErr) {
          console.error('Story generation retry failed:', retryErr)
          setError(toParentFacingMessage(retryErr))
          return null
        }
      }

      setError(toParentFacingMessage(err))
      return null
    } finally {
      setGenerating(false)
    }
  }

  return { generateStory, generating, error }
}
