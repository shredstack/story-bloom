import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScavengerLocation, ScavengerReadingLevel } from '@/lib/types'

/**
 * Prompt selection for the scavenger hunt.
 *
 * Isolated from the routes so selection rules (reading level, location, anti-repeat,
 * randomization) can be reused by both session creation and the "give me a new one"
 * replace action, and tested on their own.
 */

// A prompt row as stored (server-side; includes hidden verification criteria).
export interface ScavengerPromptRow {
  id: string
  prompt_text: string
  target_description: string
  example_objects: string[]
  location: ScavengerLocation
  reading_level: ScavengerReadingLevel
  difficulty: string
  category: string | null
}

// Shape returned to the client (verification criteria stripped).
export interface ClientPrompt {
  id: string
  promptText: string
  location: ScavengerLocation
  category: string | null
}

export function toClientPrompt(row: ScavengerPromptRow): ClientPrompt {
  return {
    id: row.id,
    promptText: row.prompt_text,
    location: row.location,
    category: row.category,
  }
}

function locationFilter(locationSet: ScavengerLocation): ScavengerLocation[] {
  switch (locationSet) {
    case 'indoor':
      return ['indoor', 'either']
    case 'outdoor':
      return ['outdoor', 'either']
    default:
      return ['indoor', 'outdoor', 'either']
  }
}

// Fisher-Yates shuffle (runtime route code — Math.random is fine here).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface SelectOptions {
  locationSet: ScavengerLocation
  levels: ScavengerReadingLevel[]
  limit: number
  excludePromptIds?: string[]
}

/**
 * Fetch eligible active prompts (matching reading levels + location, excluding the
 * given ids), shuffle, and return up to `limit`. If the exclusion list leaves too
 * few, it relaxes by ignoring the exclusions so play is never blocked.
 */
export async function selectScavengerPrompts(
  supabase: SupabaseClient,
  options: SelectOptions
): Promise<ScavengerPromptRow[]> {
  const { locationSet, levels, limit, excludePromptIds = [] } = options

  const { data, error } = await supabase
    .from('scavenger_hunt_prompts')
    .select(
      'id, prompt_text, target_description, example_objects, location, reading_level, difficulty, category'
    )
    .eq('is_active', true)
    .in('reading_level', levels)
    .in('location', locationFilter(locationSet))
    .limit(300)

  if (error || !data) {
    return []
  }

  const all = data as ScavengerPromptRow[]
  const excluded = new Set(excludePromptIds)
  const fresh = all.filter((p) => !excluded.has(p.id))

  // Prefer fresh prompts; fall back to the full set if exclusions exhausted it.
  const pool = fresh.length >= limit ? fresh : fresh.length > 0 ? fresh : all

  return shuffle(pool).slice(0, limit)
}

/**
 * Prompt ids the child has verified-found recently, so sessions don't repeat them.
 * Looks at matched finds within the lookback window.
 */
export async function recentlyFoundPromptIds(
  supabase: SupabaseClient,
  childId: string,
  lookbackDays = 14
): Promise<string[]> {
  const since = new Date()
  since.setDate(since.getDate() - lookbackDays)

  const { data } = await supabase
    .from('scavenger_hunt_finds')
    .select('prompt_id')
    .eq('child_id', childId)
    .eq('is_match', true)
    .gte('created_at', since.toISOString())

  if (!data) return []
  return data
    .map((r: { prompt_id: string | null }) => r.prompt_id)
    .filter((id): id is string => !!id)
}
