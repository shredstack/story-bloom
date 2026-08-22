/**
 * Reading Guide — shared value types.
 *
 * PURE MODULE: no React, no DOM. Everything here is a plain value type so the
 * logic modules (tokenize / lineModel / hitTest / cssVars) stay unit-testable
 * without a browser. See claude_instruction_docs/reading_guide_spec.md §6.1.
 */
import type { FontSize } from '@/lib/types'

export type { FontSize }

// ============================================
// Preferences
// ============================================

/**
 * `off` must be genuinely zero-cost — no pointer listeners, no measurement loop
 * (spec §5.1). `line-word` is the 1st–2nd grade default.
 */
export type ReadingGuideMode = 'off' | 'line' | 'line-word' | 'word' | 'mask'

/** Immersive Reader's Line Focus granularity. Discrete, not a slider (spec §2.1). */
export type MaskLines = 1 | 3 | 5

export type HighlightPreset = 'butter' | 'mint' | 'peach' | 'sky' | 'lavender'
export type MaskStrength = 'soft' | 'strong'
export type ReadingFontFamily = 'nunito' | 'atkinson' | 'opendyslexic'
export type SpacingStep = 'normal' | 'roomy' | 'extra-roomy'
export type LineHeightStep = 1.5 | 1.8 | 2.1
export type ColumnWidth = 'narrow' | 'medium' | 'wide'
export type ParagraphGap = 'small' | 'medium' | 'large'
export type PageTint = 'white' | 'cream' | 'mint' | 'sky' | 'peach'

export interface ReadingPreferences {
  guideMode: ReadingGuideMode
  maskLines: MaskLines
  highlightPreset: HighlightPreset
  maskStrength: MaskStrength
  /** How far ABOVE the fingertip the guide sits, in lines. 0–1.5. Spec §5.3. */
  touchOffsetLines: number
  keepLineCentered: boolean
  hapticOnLineChange: boolean
  fontSize: FontSize
  fontFamily: ReadingFontFamily
  letterSpacing: SpacingStep
  wordSpacing: SpacingStep
  lineHeight: LineHeightStep
  columnWidth: ColumnWidth
  paragraphGap: ParagraphGap
  pageTint: PageTint
  tapToHearEnabled: boolean
  /** Set once the first-run touch-offset calibration has been run or skipped. */
  calibrated: boolean
}

/**
 * Stored sparsely in `children.reading_preferences` — only keys the parent has
 * actually changed. Always merge over DEFAULT_READING_PREFERENCES.
 */
export type PartialReadingPreferences = Partial<ReadingPreferences>

// ============================================
// Tokenization (tokenize.ts)
// ============================================

export interface WordToken {
  /** Global index across the whole story. Stable identity for the guide & resume. */
  index: number
  /** As it appears, punctuation included: `"dog,"` */
  raw: string
  /** Lowercased, punctuation stripped, for TTS + struggling-word matching. */
  normalized: string
}

export interface Paragraph {
  index: number
  tokens: WordToken[]
}

// ============================================
// Line model (lineModel.ts)
// ============================================

/** A measured word rect, ALWAYS container-relative (spec §6.4 step 4). */
export interface WordRect {
  index: number
  left: number
  top: number
  right: number
  bottom: number
}

export interface Line {
  index: number
  /** Container-relative. */
  top: number
  bottom: number
  firstWordIndex: number
  lastWordIndex: number
  /** Sorted by `left`. */
  words: WordRect[]
}

export interface LineModel {
  lines: Line[]
  /** Median line height — drives band height AND the touch offset. */
  lineHeightPx: number
  wordToLine: Map<number, number>
  columnLeft: number
  columnRight: number
}

/** Result of a hit test. Never null — see hitTest.ts. */
export interface GuidePosition {
  lineIndex: number
  wordIndex: number
}
