import type { SupabaseClient } from '@supabase/supabase-js'
import { SCAVENGER_HUNT_DEFAULTS } from '@/lib/types'
import { extractHintColor } from './scavenger-color-hints'

/**
 * Per-child, per-prompt progress for the scavenger hunt's adaptive repetition &
 * mastery features. Isolated from the routes so the read/write rules can be reused
 * (selection, verify, skip, struggle, mastered list) and reasoned about on their own.
 *
 * All writes go through SECURITY DEFINER RPCs (increment_scavenger_progress /
 * flag_scavenger_struggle) so counter bumps are atomic SQL increments — parallel
 * verifies can't clobber each other — and mastery is evaluated in the same statement.
 */

// The progress fields the selector needs (a thin slice of the full table row).
export interface PromptProgress {
  prompt_id: string
  times_shown: number
  times_found: number
  struggle_flagged: boolean
  struggle_repeats_remaining: number
  status: 'learning' | 'mastered'
  last_shown_at: string | null
}

const PROGRESS_COLUMNS =
  'prompt_id, times_shown, times_found, struggle_flagged, struggle_repeats_remaining, status, last_shown_at'

/**
 * Load all progress rows for a child, keyed by prompt_id. The bank is small
 * (hundreds of prompts) so fetching the child's whole progress set is cheap and
 * keeps the selector a pure function over an in-memory map.
 */
export async function getProgressForChild(
  supabase: SupabaseClient,
  childId: string
): Promise<Map<string, PromptProgress>> {
  const { data, error } = await supabase
    .from('scavenger_prompt_progress')
    .select(PROGRESS_COLUMNS)
    .eq('child_id', childId)

  const map = new Map<string, PromptProgress>()
  if (error || !data) return map
  for (const row of data as PromptProgress[]) {
    map.set(row.prompt_id, row)
  }
  return map
}

/**
 * Record an engagement (a verify submission or a skip). Best-effort: never throws,
 * so a progress hiccup can't block gameplay.
 *
 * @param countShown  true when this is the prompt's first engagement in the session
 *                     (increments times_shown and pays off one struggle repeat).
 * @param found       true when this is the first verified match for the prompt this
 *                     session (increments times_found; may trigger mastery).
 */
export async function recordEngagement(
  supabase: SupabaseClient,
  args: { childId: string; promptId: string; countShown: boolean; found: boolean }
): Promise<void> {
  try {
    await supabase.rpc('increment_scavenger_progress', {
      p_child_id: args.childId,
      p_prompt_id: args.promptId,
      p_count_shown: args.countShown,
      p_found: args.found,
      p_mastery_threshold: SCAVENGER_HUNT_DEFAULTS.masteryThreshold,
    })
  } catch (e) {
    console.error('recordEngagement failed:', e)
  }
}

/**
 * Flag a clue as "tricky": owe at least `struggleRepeats` forced reappearances and
 * (if it had been mastered) bring it back into rotation. Best-effort.
 */
export async function flagStruggle(
  supabase: SupabaseClient,
  args: { childId: string; promptId: string }
): Promise<void> {
  try {
    await supabase.rpc('flag_scavenger_struggle', {
      p_child_id: args.childId,
      p_prompt_id: args.promptId,
      p_repeats: SCAVENGER_HUNT_DEFAULTS.struggleRepeats,
    })
  } catch (e) {
    console.error('flagStruggle failed:', e)
  }
}

// A mastered clue for the kid-facing trophy shelf.
export interface MasteredPrompt {
  promptId: string
  promptText: string
  imageUrl: string | null
  hintColor: string | null
  masteredAt: string | null
}

/**
 * The child's mastered (retired) clues, newest first, for the trophy shelf.
 * Image is included only when requested (Pre-K children).
 */
export async function getMasteredPrompts(
  supabase: SupabaseClient,
  childId: string,
  opts: { withImages: boolean }
): Promise<MasteredPrompt[]> {
  const { data, error } = await supabase
    .from('scavenger_prompt_progress')
    .select(
      'prompt_id, mastered_at, scavenger_hunt_prompts!inner(prompt_text, image_url, category)'
    )
    .eq('child_id', childId)
    .eq('status', 'mastered')
    .order('mastered_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const prompt = row.scavenger_hunt_prompts as unknown as {
      prompt_text: string
      image_url: string | null
      category: string | null
    }
    const hintColor = opts.withImages
      ? extractHintColor(prompt.prompt_text, prompt.category)
      : null
    return {
      promptId: row.prompt_id as string,
      promptText: prompt.prompt_text,
      imageUrl: opts.withImages && !hintColor ? prompt.image_url : null,
      hintColor,
      masteredAt: row.mastered_at as string | null,
    }
  })
}
