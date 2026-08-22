'use client'

import { useEffect } from 'react'
import type { ReadingFontFamily } from '@/lib/reading/types'

/**
 * Alternate reading fonts, injected lazily.
 *
 * Nunito is already loaded by globals.css, so the default path costs nothing:
 * a stylesheet is only added once a child actually picks a different face.
 *
 * NOTE: OpenDyslexic is NOT distributed by Google Fonts (the spec says it is —
 * `fonts.googleapis.com/css2?family=OpenDyslexic` 400s). It is served here from
 * jsDelivr's @fontsource package instead. If the load fails, FONT_STACKS falls
 * back through Comic Sans to Nunito, i.e. to today's reader.
 */
const FONT_HREFS: Partial<Record<ReadingFontFamily, string>> = {
  atkinson:
    'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
  opendyslexic: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic/index.css',
}

const LINK_ID_PREFIX = 'reading-font-'

export function ReadingFontLoader({ family }: { family: ReadingFontFamily }) {
  useEffect(() => {
    const href = FONT_HREFS[family]
    if (!href) return

    const id = `${LINK_ID_PREFIX}${family}`
    if (document.getElementById(id)) return

    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)

    // Deliberately not removed on unmount: swapping back and forth would
    // re-download the face, and a cached <link> costs nothing.
  }, [family])

  return null
}
