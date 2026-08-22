'use client'

import { useMemo, type CSSProperties } from 'react'
import { cssVars } from '@/lib/reading/cssVars'
import type { ReadingPreferences } from '@/lib/reading/types'
import { ReadingFontLoader } from './ReadingFontLoader'

interface ReadingSurfaceProps {
  /** Plain story/passage text. Deliberately NOT a Story — keeps this reusable
   *  for Sentence Shenanigans and the Word Rescue cards later (spec §9). */
  content: string
  preferences: ReadingPreferences
  className?: string
}

/**
 * Renders body text with the child's typography applied.
 *
 * Replaces the old single `<p className="whitespace-pre-wrap">` in the story
 * reader with real paragraphs, which also fixes print layout for free.
 *
 * Phase 0: paragraphs only. Phase 1 adds the per-word spans the line model
 * measures and the guide overlay.
 */
export function ReadingSurface({
  content,
  preferences,
  className = '',
}: ReadingSurfaceProps) {
  const paragraphs = useMemo(
    () =>
      content
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    [content]
  )

  return (
    <div
      className={`reading-surface ${className}`}
      style={cssVars(preferences) as CSSProperties}
    >
      <ReadingFontLoader family={preferences.fontFamily} />
      {paragraphs.map((text, i) => (
        <p key={i} className="reading-paragraph">
          {text}
        </p>
      ))}
    </div>
  )
}
