/**
 * Reading Guide — story text → paragraphs of word tokens.
 *
 * PURE MODULE: no React, no DOM.
 */
import { normalizeWord } from '@/lib/utils/syllabify'
import type { Paragraph, WordToken } from './types'

export type { Paragraph, WordToken }

/**
 * Splits `content` into paragraphs of word tokens.
 *
 * Rules (spec §6.2):
 * - Paragraphs split on a blank line; a single `\n` inside one becomes a space.
 * - Punctuation stays ATTACHED to its word (`"dog,"` is one token) so the
 *   measured rect matches what the eye sees as one word.
 * - Apostrophes and hyphens never split: `don't` and `well-known` are single
 *   tokens.
 * - `index` is global across the whole story, which is what the guide and the
 *   resume position are keyed on — word indices survive a font-size change or
 *   a device rotation, line indices do not.
 * - A token whose `normalized` is empty (a bare `—`) still renders and still
 *   occupies an index; callers use `isTappable` to skip it for audio.
 */
export function tokenizeStory(content: string): Paragraph[] {
  if (!content) return []

  // Normalize CRLF/CR first so the blank-line split below sees only \n.
  const text = content.replace(/\r\n?/g, '\n')

  const paragraphs: Paragraph[] = []
  let wordIndex = 0

  for (const chunk of text.split(/\n\s*\n/)) {
    // Splitting on /\s+/ is what turns a single interior newline into a plain
    // word separator — the renderer re-joins tokens with a single space.
    const words = chunk.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    const tokens: WordToken[] = words.map((raw) => ({
      index: wordIndex++,
      raw,
      normalized: normalizeWord(raw),
    }))

    paragraphs.push({ index: paragraphs.length, tokens })
  }

  return paragraphs
}

/** Punctuation-only tokens hold a position but have nothing to say aloud. */
export function isTappable(token: WordToken): boolean {
  return token.normalized.length > 0
}

/** Flattens to a single index-ordered array — handy for lookup by word index. */
export function flattenTokens(paragraphs: Paragraph[]): WordToken[] {
  return paragraphs.flatMap((p) => p.tokens)
}
