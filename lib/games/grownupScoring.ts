import type { SentenceWordResult } from '@/lib/types'

/**
 * Scoring for attempts a grown-up judged instead of the microphone.
 *
 * Deliberately pure and DOM-free: the same numbers have to come out whether a
 * transcript produced them or a parent tapped them, because everything
 * downstream (accuracy thresholds, XP, pet rewards, struggling-word capture)
 * reads the result shape and not its origin.
 */

/**
 * Split a target sentence into the word list the rest of the game counts by.
 *
 * This is the ONE definition of "the words in this sentence". Speech scoring
 * (`calculateSentenceAccuracy`) and grown-up scoring both go through it, so a
 * `SentenceWordResult.position` means the same thing either way — and it stays
 * a plain whitespace split, which is also how `ReadingSurface` indexes the words
 * it renders, so the red/green coloring lands on the right word.
 */
export function splitTargetWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s']/g, '') // keep apostrophes so contractions stay one word
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

/**
 * The words as the child sees them — punctuation and capitals intact — paired
 * with the scoring index they map to. The grown-up is marking what is on the
 * screen, so the chips must read like the sentence, not like the match key.
 */
export interface ScorableWord {
  /** What to show the grown-up, e.g. `Dog,` */
  display: string
  /** Index into `splitTargetWords(sentence)` — the `position` in results. */
  position: number
}

export function toScorableWords(sentence: string): ScorableWord[] {
  const display = sentence.trim().split(/\s+/).filter((w) => w.length > 0)
  const scored = splitTargetWords(sentence)

  // Normalization can drop a token entirely (a lone "—", say), which would slide
  // every later position by one. When the two splits disagree, fall back to the
  // normalized words as the display text so positions are never wrong — a
  // cosmetic loss instead of a scoring bug.
  if (display.length !== scored.length) {
    return scored.map((word, position) => ({ display: word, position }))
  }

  return display.map((word, position) => ({ display: word, position }))
}

/**
 * Build a full result set from the positions a grown-up marked as missed.
 *
 * Absence is the "correct" signal: the adult only has to tap the words that
 * went wrong, which is the fast path for the common case of a clean read.
 */
export function buildGrownUpWordResults(
  sentence: string,
  missedPositions: Iterable<number>
): { accuracy: number; wordResults: SentenceWordResult[] } {
  const words = splitTargetWords(sentence)
  const missed = new Set(missedPositions)

  if (words.length === 0) {
    return { accuracy: 0, wordResults: [] }
  }

  const wordResults: SentenceWordResult[] = words.map((word, position) => ({
    word,
    // No transcript exists — null means "nothing was heard", which is exactly
    // true here, and keeps the feedback UI from quoting words back at the child.
    spoken: null,
    correct: !missed.has(position),
    position,
  }))

  const correctCount = wordResults.filter((r) => r.correct).length

  return {
    accuracy: Math.round((correctCount / words.length) * 100),
    wordResults,
  }
}
