/**
 * Reading Guide — preferences → CSS custom properties.
 *
 * PURE MODULE: no React, no DOM. Returns a plain string map; the caller casts
 * it to React.CSSProperties (React accepts custom properties at runtime, the
 * cast is only to satisfy the typings).
 *
 * The matching CSS block lives in app/globals.css under ".reading-surface".
 */
import {
  COLUMN_WIDTH,
  FONT_SIZE_PX,
  FONT_STACKS,
  HIGHLIGHT_PRESETS,
  LETTER_SPACING,
  MASK_ALPHA,
  PAGE_TINT,
  PARAGRAPH_GAP,
  WORD_SPACING,
} from './defaults'
import type { ReadingPreferences } from './types'

/** `--rg-*` custom properties. Assign to an element's inline `style`. */
export type ReadingCssVars = Record<string, string>

export function cssVars(prefs: ReadingPreferences): ReadingCssVars {
  const highlight = HIGHLIGHT_PRESETS[prefs.highlightPreset]

  return {
    '--rg-font-size': FONT_SIZE_PX[prefs.fontSize],
    '--rg-font-family': FONT_STACKS[prefs.fontFamily],
    '--rg-letter-spacing': LETTER_SPACING[prefs.letterSpacing],
    '--rg-word-spacing': WORD_SPACING[prefs.wordSpacing],
    '--rg-line-height': String(prefs.lineHeight),
    '--rg-column-width': COLUMN_WIDTH[prefs.columnWidth],
    '--rg-paragraph-gap': PARAGRAPH_GAP[prefs.paragraphGap],
    '--rg-page-tint': PAGE_TINT[prefs.pageTint],
    '--rg-band-color': highlight.band,
    '--rg-word-color': highlight.word,
    '--rg-mask-alpha': String(MASK_ALPHA[prefs.maskStrength]),
  }
}
