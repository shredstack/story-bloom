import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScavengerLocation, ScavengerReadingLevel } from '@/lib/types'
import { getProgressForChild, type PromptProgress } from './scavenger-progress'
import { extractHintColor } from './scavenger-color-hints'

/**
 * Prompt selection for the scavenger hunt.
 *
 * Isolated from the routes so selection rules (reading level, location, adaptive
 * repetition, mastery, randomization) can be reused by both session creation and the
 * "give me a new one" replace action, and tested on their own. The pure bucketing
 * logic lives in `pickPrompts` so it can be exercised with a fake progress set.
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
  image_url: string | null
}

// Shape returned to the client (verification criteria stripped).
export interface ClientPrompt {
  id: string
  promptText: string
  location: ScavengerLocation
  category: string | null
  imageUrl: string | null
  // Pre-K swatch hint for single-color clues ("Find something pink"). Takes the
  // place of an AI image — the color itself is the cue. Null for everyone else.
  hintColor: string | null
}

/**
 * Map a stored row to the client shape. `withImages` gates the Pre-K picture hint:
 * it is driven by the *child's* reading level (set by the route), never the prompt's,
 * so a Kindergartner who draws an easier pre_k prompt does not get a picture.
 */
export function toClientPrompt(
  row: ScavengerPromptRow,
  opts: { withImages?: boolean } = {}
): ClientPrompt {
  const hintColor = opts.withImages
    ? extractHintColor(row.prompt_text, row.category)
    : null
  return {
    id: row.id,
    promptText: row.prompt_text,
    location: row.location,
    category: row.category,
    // A color swatch supersedes the picture hint for single-color clues, so don't
    // also ship an image the card would ignore.
    imageUrl: opts.withImages && !hintColor ? row.image_url : null,
    hintColor,
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

// A prompt seen this many times that has never been found and was never flagged
// tricky is silently hard for this child — deprioritize it so it doesn't crowd out
// variety (open question #2: a soft, lowest-priority bucket rather than retirement).
const STALE_ENGAGEMENTS = 6

const PROMPT_COLUMNS =
  'id, prompt_text, target_description, example_objects, location, reading_level, difficulty, category, image_url'

interface PickOptions {
  limit: number
  // Hard exclusions (e.g. prompts already in the current session). Never returned.
  excludeIds?: Set<string>
  // Soft exclusions (e.g. prompts engaged in the immediately previous session).
  // Skipped on the first pass, but re-included before falling back to mastered.
  softExcludeIds?: Set<string>
}

/**
 * Pure, progress-aware bucketing — the heart of adaptive selection.
 *
 * Priority: Struggling (owed forced repeats) > Fresh (no progress) > Review (seen,
 * learning) > Stale (seen a lot, never found, not flagged). Mastered prompts are
 * excluded unless they still owe struggle repeats. A hunt is never *only* drills:
 * struggling prompts are capped at ceil(limit/2). Fallbacks relax the soft exclusion
 * and finally allow mastered prompts so play is never blocked.
 */
export function pickPrompts(
  pool: ScavengerPromptRow[],
  progress: Map<string, PromptProgress>,
  opts: PickOptions
): ScavengerPromptRow[] {
  const { limit, excludeIds = new Set(), softExcludeIds = new Set() } = opts

  const owesRepeats = (p: ScavengerPromptRow) =>
    (progress.get(p.id)?.struggle_repeats_remaining ?? 0) > 0

  // Candidates: drop hard-excludes and retired (mastered) prompts that owe nothing.
  const candidates = pool.filter((p) => {
    if (excludeIds.has(p.id)) return false
    const pr = progress.get(p.id)
    if (pr?.status === 'mastered' && !owesRepeats(p)) return false
    return true
  })

  // A struggling prompt must reappear even if it's in the soft-exclude set.
  const struggling: ScavengerPromptRow[] = []
  const fresh: ScavengerPromptRow[] = []
  const review: ScavengerPromptRow[] = []
  const stale: ScavengerPromptRow[] = []
  const softHeld: ScavengerPromptRow[] = [] // soft-excluded, kept for the fallback pass

  for (const p of candidates) {
    if (owesRepeats(p)) {
      struggling.push(p)
      continue
    }
    if (softExcludeIds.has(p.id)) {
      softHeld.push(p)
      continue
    }
    const pr = progress.get(p.id)
    if (!pr) {
      fresh.push(p)
    } else if (
      pr.times_shown >= STALE_ENGAGEMENTS &&
      pr.times_found === 0 &&
      !pr.struggle_flagged
    ) {
      stale.push(p)
    } else {
      review.push(p)
    }
  }

  // Review: fewest finds first, then oldest last_shown (longest unseen) first.
  const byReviewOrder = (a: ScavengerPromptRow, b: ScavengerPromptRow) => {
    const pa = progress.get(a.id)!
    const pb = progress.get(b.id)!
    if (pa.times_found !== pb.times_found) return pa.times_found - pb.times_found
    const ta = pa.last_shown_at ? Date.parse(pa.last_shown_at) : 0
    const tb = pb.last_shown_at ? Date.parse(pb.last_shown_at) : 0
    return ta - tb
  }
  review.sort(byReviewOrder)
  stale.sort(byReviewOrder)

  // Cap drills so a hunt is never only struggling prompts; keep the overflow as a
  // last resort in case the other buckets can't fill the session.
  const shuffledStruggling = shuffle(struggling)
  const cap = Math.max(1, Math.ceil(limit / 2))
  const drills = shuffledStruggling.slice(0, cap)
  const drillOverflow = shuffledStruggling.slice(cap)

  const ordered: ScavengerPromptRow[] = [
    ...drills,
    ...shuffle(fresh),
    ...review,
    ...stale,
    ...drillOverflow,
    // Fallbacks, in order: soft-excluded (previous session), then mastered.
    ...shuffle(softHeld),
    ...shuffle(
      pool.filter(
        (p) =>
          !excludeIds.has(p.id) &&
          progress.get(p.id)?.status === 'mastered' &&
          !owesRepeats(p)
      )
    ),
  ]

  // Dedupe (a prompt can appear in both drillOverflow paths only once anyway) and cap.
  const seen = new Set<string>()
  const result: ScavengerPromptRow[] = []
  for (const p of ordered) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    result.push(p)
    if (result.length >= limit) break
  }
  return result
}

interface SelectOptions {
  childId: string
  locationSet: ScavengerLocation
  levels: ScavengerReadingLevel[]
  limit: number
  excludePromptIds?: string[]
  softExcludePromptIds?: string[]
}

/**
 * Fetch the eligible active prompts (matching reading levels + location) plus the
 * child's progress, then bucket them adaptively (see pickPrompts). Falls back to
 * looser exclusions / mastered prompts internally so play is never blocked.
 */
export async function selectScavengerPrompts(
  supabase: SupabaseClient,
  options: SelectOptions
): Promise<ScavengerPromptRow[]> {
  const {
    childId,
    locationSet,
    levels,
    limit,
    excludePromptIds = [],
    softExcludePromptIds = [],
  } = options

  const { data, error } = await supabase
    .from('scavenger_hunt_prompts')
    .select(PROMPT_COLUMNS)
    .eq('is_active', true)
    .in('reading_level', levels)
    .in('location', locationFilter(locationSet))
    .limit(500)

  if (error || !data) {
    return []
  }

  const pool = data as ScavengerPromptRow[]
  const progress = await getProgressForChild(supabase, childId)

  return pickPrompts(pool, progress, {
    limit,
    excludeIds: new Set(excludePromptIds),
    softExcludeIds: new Set(softExcludePromptIds),
  })
}

/**
 * Prompt ids the child engaged with (submitted a photo for) in their most recent
 * prior session — a soft signal to avoid back-to-back repeats. Supersedes the old
 * 14-day matched-only exclusion (per-child progress now drives anti-repeat).
 */
export async function previousSessionEngagedPromptIds(
  supabase: SupabaseClient,
  childId: string
): Promise<string[]> {
  const { data: lastSession } = await supabase
    .from('scavenger_hunt_sessions')
    .select('id')
    .eq('child_id', childId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSession?.id) return []

  const { data } = await supabase
    .from('scavenger_hunt_finds')
    .select('prompt_id')
    .eq('session_id', lastSession.id)

  if (!data) return []
  return data
    .map((r: { prompt_id: string | null }) => r.prompt_id)
    .filter((id): id is string => !!id)
}
