'use client'

import type { ReadingGuideApi } from '@/lib/hooks/useReadingGuide'
import type { ReadingGuideMode } from '@/lib/reading/types'

interface ReadingGuideOverlayProps {
  guide: ReadingGuideApi
  mode: ReadingGuideMode
}

/**
 * The band and word rects (spec §6.5).
 *
 * Two things about this component are load-bearing:
 *
 * 1. It renders BEHIND the glyphs. `.reading-paragraph` carries z-index 2; the
 *    word rect is 1 and the band is 0. Painting a translucent band OVER text
 *    lowers its contrast, which is precisely backwards for the reader this is
 *    built for.
 * 2. It has no props that change on pointer movement. Position, size and the
 *    animate flag are all written imperatively by useReadingGuide's rAF flush,
 *    so moving the guide never re-renders React.
 *
 * Purely decorative, so aria-hidden and pointer-events: none.
 */
export function ReadingGuideOverlay({ guide, mode }: ReadingGuideOverlayProps) {
  if (mode === 'off') return null

  const showBand = mode === 'line' || mode === 'line-word' || mode === 'mask'
  const showWord = mode === 'line-word' || mode === 'word'

  return (
    <div aria-hidden="true" className="no-print">
      {showBand && (
        <div
          ref={guide.bandRef}
          className="reading-guide-layer reading-guide-band"
          data-mask={mode === 'mask' ? 'on' : 'off'}
          // Hidden until the first flush, so nothing flashes at 0,0 on load.
          style={{ visibility: 'hidden' }}
        />
      )}
      {showWord && (
        <div
          ref={guide.wordRef}
          className="reading-guide-layer reading-guide-word"
          style={{ visibility: 'hidden' }}
        />
      )}
    </div>
  )
}
