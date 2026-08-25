'use client'

import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react'
import type { ReadingGuideApi } from '@/lib/hooks/useReadingGuide'
import { cssVars } from '@/lib/reading/cssVars'
import { tokenizeStory } from '@/lib/reading/tokenize'
import type { Paragraph, ReadingPreferences } from '@/lib/reading/types'
import { ReadingFontLoader } from './ReadingFontLoader'
import { ReadingGuideOverlay } from './ReadingGuideOverlay'

interface ReadingSurfaceProps {
  /** Plain passage text. Deliberately NOT a Story — keeps this reusable for
   *  Sentence Shenanigans and the Word Rescue cards later (spec §9). */
  content: string
  /** Pre-tokenized `content`, when the caller already has it. Purely an
   *  optimization; omit it and the surface tokenizes `content` itself. */
  paragraphs?: Paragraph[]
  preferences: ReadingPreferences
  className?: string
  surfaceRef?: React.RefObject<HTMLDivElement>
  /** Omit for a plain, fully selectable reading surface. */
  guide?: ReadingGuideApi | null
  /**
   * Extra classes for one word, by global token index — Sentence Shenanigans
   * colors the words she missed.
   *
   * Must only ever change COLOR. Anything that changes layout (display,
   * margin, padding, font-size) silently invalidates the measured line model,
   * because a class change alone does not trigger a re-measure.
   */
  wordClassName?: (wordIndex: number) => string | undefined
  /** Rendered inside the surface, after the text (e.g. the gutter handle). */
  children?: ReactNode
}

/**
 * Renders body text with the child's typography, and — when a guide is
 * supplied — the per-word spans the line model measures.
 *
 * Replaces the old single `<p className="whitespace-pre-wrap">`, which also
 * fixes print layout for free.
 */
export function ReadingSurface({
  content,
  paragraphs,
  preferences,
  className = '',
  surfaceRef,
  guide = null,
  wordClassName,
  children,
}: ReadingSurfaceProps) {
  const resolved = useMemo(
    () => paragraphs ?? tokenizeStory(content),
    [paragraphs, content]
  )

  // The preview in the settings panel passes no guide; it must never pick up
  // the drag/selection lock-down.
  const guideActive = Boolean(guide) && preferences.guideMode !== 'off'

  return (
    <div
      ref={surfaceRef}
      className={`reading-surface ${className}`}
      data-guide={guideActive ? 'on' : 'off'}
      style={cssVars(preferences) as CSSProperties}
      {...(guideActive && guide ? guide.surfaceHandlers : {})}
    >
      <ReadingFontLoader family={preferences.fontFamily} />

      {guideActive && guide && (
        <ReadingGuideOverlay guide={guide} mode={preferences.guideMode} />
      )}

      {resolved.map((paragraph) => (
        <p key={paragraph.index} className="reading-paragraph">
          {paragraph.tokens.map((token, i) => (
            <Fragment key={token.index}>
              {/* No onClick here: all pointer handling is delegated on the
                  container, and per-word listeners on 800 spans would be
                  wasteful. The span exists to be measured. */}
              <span
                data-word-index={token.index}
                className={`reading-word ${wordClassName?.(token.index) ?? ''}`}
              >
                {token.raw}
              </span>
              {/* The separating space must be an explicit string OUTSIDE the
                  span: JSX collapses incidental whitespace between elements,
                  and keeping it outside means each span's rect is exactly the
                  word. */}
              {i < paragraph.tokens.length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </p>
      ))}

      {children}
    </div>
  )
}
