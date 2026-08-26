import type { WordMasteryStage } from '@/lib/types'

/**
 * Which words a Word Rescue session serves, and in what order.
 *
 * Pure and DB-free so the policy can be tested without a session: the route
 * fetches the child's eligible words and hands them straight to
 * `selectWordRescueWords`.
 */

/**
 * Practice order by stage — the newest struggles first, the nearly-learned
 * last. This cannot be an `ORDER BY current_stage` in the query: the column is
 * text, and alphabetically `blooming` sorts before `seedling`, which is the
 * exact opposite of what a session wants.
 */
export const WORD_RESCUE_STAGE_PRIORITY: Record<WordMasteryStage, number> = {
  seedling: 0,
  growing: 1,
  blooming: 2,
  mastered: 3,
}

/** Sessions a starred word is owed when a parent stars it. */
export const DEFAULT_FOCUS_REPEATS = 5

/**
 * A session is never *only* the parent's drills — the child still meets the
 * rest of their list, so starring six words doesn't silently replace practice.
 */
export function maxFocusWordsPerSession(wordsPerSession: number): number {
  return Math.max(1, Math.ceil(wordsPerSession / 2))
}

/** The fields selection reads. Rows carry much more; this is all that matters. */
export interface SelectableWord {
  current_stage: WordMasteryStage
  focus_repeats: number | null
  last_practiced_at: string | null
}

/** Never practiced comes first, then longest-ago. */
function byPracticeRecency(a: SelectableWord, b: SelectableWord): number {
  if (a.last_practiced_at === b.last_practiced_at) return 0
  if (a.last_practiced_at === null) return -1
  if (b.last_practiced_at === null) return 1
  return a.last_practiced_at < b.last_practiced_at ? -1 : 1
}

function byStageThenRecency(a: SelectableWord, b: SelectableWord): number {
  const stageDiff =
    WORD_RESCUE_STAGE_PRIORITY[a.current_stage] -
    WORD_RESCUE_STAGE_PRIORITY[b.current_stage]
  return stageDiff !== 0 ? stageDiff : byPracticeRecency(a, b)
}

function isFocused(word: SelectableWord): boolean {
  return (word.focus_repeats ?? 0) > 0
}

/**
 * Pick and order the words for one session.
 *
 * Starred words lead — a session can be abandoned halfway, and the ones the
 * parent asked for should be the ones that got practiced. They're capped at
 * `maxFocusWordsPerSession` so the rest of the list still gets a turn, but the
 * cap only holds words back when there are others to fill with: a child whose
 * whole list is starred still gets a full session.
 *
 * Mastered words are dropped defensively — the query already excludes them,
 * but "what a session contains" should be answerable from this file alone.
 */
export function selectWordRescueWords<T extends SelectableWord>(
  candidates: T[],
  wordsPerSession: number
): T[] {
  if (wordsPerSession <= 0) return []

  const eligible = candidates.filter((w) => w.current_stage !== 'mastered')

  const focused = eligible.filter(isFocused).sort(byPracticeRecency)
  const unfocused = eligible.filter((w) => !isFocused(w)).sort(byStageThenRecency)

  const focusCap = Math.min(maxFocusWordsPerSession(wordsPerSession), wordsPerSession)
  const selected: T[] = focused.slice(0, focusCap)

  for (const word of unfocused) {
    if (selected.length >= wordsPerSession) break
    selected.push(word)
  }

  // Room left over (few or no unstarred words) — spend it on the rest of the
  // starred ones rather than serving a short session.
  for (const word of focused.slice(focusCap)) {
    if (selected.length >= wordsPerSession) break
    selected.push(word)
  }

  return selected
}
