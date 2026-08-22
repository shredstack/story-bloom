/**
 * Reading Guide — defaults, value→CSS mapping tables, and sanitization.
 *
 * PURE MODULE: no React, no DOM.
 *
 * Every "setting value → CSS value" mapping lives here rather than being
 * scattered through components (spec §6.7), so a tweak is a one-line change and
 * the contrast assertions in the tests have a single source of truth.
 */
import type {
  ColumnWidth,
  FontSize,
  HighlightPreset,
  LineHeightStep,
  MaskLines,
  MaskStrength,
  PageTint,
  ParagraphGap,
  PartialReadingPreferences,
  ReadingFontFamily,
  ReadingGuideMode,
  ReadingPreferences,
  SpacingStep,
} from './types'

// ============================================
// Body text
// ============================================

/**
 * Body text colour. Fixed, not a preference: every band/word colour below is
 * chosen to keep THIS colour at ≥4.5:1 (asserted in colors.test.ts).
 */
export const BODY_TEXT_COLOR = '#1F2937'

// ============================================
// Mapping tables
// ============================================

/** Matches the existing FONT_SIZE_CLASSES steps (text-base/lg/xl/2xl). */
export const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '1rem',
  medium: '1.125rem',
  large: '1.25rem',
  'extra-large': '1.5rem',
}

/**
 * Atkinson Hyperlegible and OpenDyslexic are loaded lazily (only when actually
 * selected) — see components/reading/ReadingFontLoader.tsx. Each stack falls
 * back to Nunito so a failed font load degrades to today's reader.
 */
export const FONT_STACKS: Record<ReadingFontFamily, string> = {
  nunito: "'Nunito', system-ui, -apple-system, sans-serif",
  atkinson: "'Atkinson Hyperlegible', 'Nunito', system-ui, sans-serif",
  opendyslexic: "'OpenDyslexic', 'Comic Sans MS', 'Nunito', system-ui, sans-serif",
}

/** Strongest-evidence typographic lever: reduces visual crowding (spec §2.2). */
export const LETTER_SPACING: Record<SpacingStep, string> = {
  normal: '0em',
  roomy: '0.06em',
  'extra-roomy': '0.12em',
}

export const WORD_SPACING: Record<SpacingStep, string> = {
  normal: '0em',
  roomy: '0.16em',
  'extra-roomy': '0.3em',
}

/** Shorter lines = fewer return-sweep failures. Highest-leverage single fix. */
export const COLUMN_WIDTH: Record<ColumnWidth, string> = {
  narrow: '46ch',
  medium: '58ch',
  wide: '70ch',
}

export const PARAGRAPH_GAP: Record<ParagraphGap, string> = {
  small: '1em',
  medium: '1.6em',
  large: '2.2em',
}

/**
 * BDA: pure white "can appear too dazzling". This is a GLARE/COMFORT measure —
 * UI copy must never claim a tint improves reading ability (spec §2.2).
 */
export const PAGE_TINT: Record<PageTint, string> = {
  white: '#FFFFFF',
  cream: '#FFFBF0',
  mint: '#F2FBF6',
  sky: '#F3F8FF',
  peach: '#FFF6F0',
}

export interface HighlightColors {
  /** Soft band behind the whole current line. */
  band: string
  /** Stronger highlight behind the current word. */
  word: string
}

/**
 * Band/word colours. All render BEHIND the glyphs (spec §6.5), and all keep
 * BODY_TEXT_COLOR at ≥4.5:1 — asserted in lib/reading/colors.test.ts.
 */
export const HIGHLIGHT_PRESETS: Record<HighlightPreset, HighlightColors> = {
  butter: { band: '#FFF1A8', word: '#FFD84D' },
  mint: { band: '#D6F5E8', word: '#8DE3C0' },
  peach: { band: '#FFE3D0', word: '#FFB98A' },
  sky: { band: '#DCEDFF', word: '#9CCDFF' },
  lavender: { band: '#EAE2FF', word: '#C4AEFF' },
}

/** Warm-neutral dim — pure black over a cream page looks harsh. */
export const MASK_ALPHA: Record<MaskStrength, number> = {
  soft: 0.35,
  strong: 0.55,
}

/**
 * Touch offset presets. Exposed to the parent as a three-way picker rather than
 * a slider (spec §5.3) — a 7-year-old's hand does not need 0.05 granularity.
 */
export const TOUCH_OFFSET_CHOICES = [
  { value: 0, label: 'On the word' },
  { value: 0.9, label: 'Just above my finger' },
  { value: 1.4, label: 'Higher' },
] as const

export const MIN_TOUCH_OFFSET_LINES = 0
export const MAX_TOUCH_OFFSET_LINES = 1.5

// ============================================
// Interaction constants (spec §5.2, §6.9)
// ============================================

/** Hold this long before a drag starts. Below it, the browser scrolls. */
export const HOLD_MS = 180
/** Moving further than this before HOLD_MS cancels the hold → normal scroll. */
export const DRAG_CANCEL_PX = 10
/** Two taps on the same word within this window = "say it". */
export const DOUBLE_TAP_MS = 300
/** Auto-scroll when the active line enters the top/bottom this fraction of the viewport. */
export const AUTOSCROLL_DEAD_ZONE = 0.18
/** React state commits are debounced this long; the visual is already rAF-driven. */
export const COMMIT_DEBOUNCE_MS = 120
/** Resume position write debounce. */
export const RESUME_DEBOUNCE_MS = 500
/** Supabase PATCH debounce for preference changes. */
export const PREFS_SAVE_DEBOUNCE_MS = 800

// ============================================
// Defaults
// ============================================

/**
 * 1st–2nd grade defaults (spec §5.5). Note what is deliberately NOT the
 * default: OpenDyslexic (evidence is mixed-to-negative, §2.2) and mask mode
 * (the typoscope-specific evidence is weak, §2.2).
 */
export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  guideMode: 'line-word',
  maskLines: 3,
  highlightPreset: 'butter',
  maskStrength: 'soft',
  touchOffsetLines: 0.9,
  keepLineCentered: false,
  hapticOnLineChange: true,
  fontSize: 'large',
  fontFamily: 'nunito',
  letterSpacing: 'roomy',
  wordSpacing: 'roomy',
  lineHeight: 1.8,
  columnWidth: 'narrow',
  paragraphGap: 'medium',
  pageTint: 'cream',
  tapToHearEnabled: true,
  calibrated: false,
}

/**
 * Per-reading-level starting points. Lives here, not in a component, so the
 * profile UI and the API can agree without duplicating the policy (spec §6.7).
 */
export function defaultPreferencesForLevel(
  readingLevel: string | null | undefined
): ReadingPreferences {
  switch (readingLevel) {
    case 'Pre-K':
    case 'Kindergarten':
      return {
        ...DEFAULT_READING_PREFERENCES,
        guideMode: 'mask',
        maskLines: 1,
        fontSize: 'extra-large',
        letterSpacing: 'extra-roomy',
        wordSpacing: 'extra-roomy',
        lineHeight: 2.1,
        paragraphGap: 'large',
      }
    case '4th Grade':
    case '5th Grade':
    case '6th Grade':
      return {
        ...DEFAULT_READING_PREFERENCES,
        guideMode: 'line',
        fontSize: 'medium',
        columnWidth: 'wide',
        lineHeight: 1.5,
        paragraphGap: 'small',
      }
    default:
      // 1st–3rd grade, and anything unrecognised.
      return { ...DEFAULT_READING_PREFERENCES }
  }
}

// ============================================
// Merge + sanitize
// ============================================

const GUIDE_MODES: ReadingGuideMode[] = ['off', 'line', 'line-word', 'word', 'mask']
const MASK_LINE_CHOICES: MaskLines[] = [1, 3, 5]
const LINE_HEIGHTS: LineHeightStep[] = [1.5, 1.8, 2.1]
const FONT_SIZES: FontSize[] = ['small', 'medium', 'large', 'extra-large']
const SPACING_STEPS: SpacingStep[] = ['normal', 'roomy', 'extra-roomy']

function pick<T>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined
}

/**
 * Drops anything we don't recognise — a key from a newer client, a hand-edited
 * JSONB blob, a stale localStorage entry. Returns only valid, known keys, so
 * callers can merge the result over DEFAULT_READING_PREFERENCES safely.
 */
export function sanitizeReadingPreferences(input: unknown): PartialReadingPreferences {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const out: PartialReadingPreferences = {}

  const guideMode = pick(GUIDE_MODES, raw.guideMode)
  if (guideMode) out.guideMode = guideMode

  const maskLines = pick(MASK_LINE_CHOICES, raw.maskLines)
  if (maskLines) out.maskLines = maskLines

  const highlightPreset = pick(
    Object.keys(HIGHLIGHT_PRESETS) as HighlightPreset[],
    raw.highlightPreset
  )
  if (highlightPreset) out.highlightPreset = highlightPreset

  const maskStrength = pick(Object.keys(MASK_ALPHA) as MaskStrength[], raw.maskStrength)
  if (maskStrength) out.maskStrength = maskStrength

  if (typeof raw.touchOffsetLines === 'number' && Number.isFinite(raw.touchOffsetLines)) {
    out.touchOffsetLines = Math.min(
      MAX_TOUCH_OFFSET_LINES,
      Math.max(MIN_TOUCH_OFFSET_LINES, raw.touchOffsetLines)
    )
  }

  if (typeof raw.keepLineCentered === 'boolean') out.keepLineCentered = raw.keepLineCentered
  if (typeof raw.hapticOnLineChange === 'boolean') {
    out.hapticOnLineChange = raw.hapticOnLineChange
  }
  if (typeof raw.tapToHearEnabled === 'boolean') out.tapToHearEnabled = raw.tapToHearEnabled
  if (typeof raw.calibrated === 'boolean') out.calibrated = raw.calibrated

  const fontSize = pick(FONT_SIZES, raw.fontSize)
  if (fontSize) out.fontSize = fontSize

  const fontFamily = pick(Object.keys(FONT_STACKS) as ReadingFontFamily[], raw.fontFamily)
  if (fontFamily) out.fontFamily = fontFamily

  const letterSpacing = pick(SPACING_STEPS, raw.letterSpacing)
  if (letterSpacing) out.letterSpacing = letterSpacing

  const wordSpacing = pick(SPACING_STEPS, raw.wordSpacing)
  if (wordSpacing) out.wordSpacing = wordSpacing

  const lineHeight = pick(LINE_HEIGHTS, raw.lineHeight)
  if (lineHeight) out.lineHeight = lineHeight

  const columnWidth = pick(Object.keys(COLUMN_WIDTH) as ColumnWidth[], raw.columnWidth)
  if (columnWidth) out.columnWidth = columnWidth

  const paragraphGap = pick(Object.keys(PARAGRAPH_GAP) as ParagraphGap[], raw.paragraphGap)
  if (paragraphGap) out.paragraphGap = paragraphGap

  const pageTint = pick(Object.keys(PAGE_TINT) as PageTint[], raw.pageTint)
  if (pageTint) out.pageTint = pageTint

  return out
}

/**
 * Merge stored (sparse) preferences over the level-appropriate defaults.
 *
 * `fallbackFontSize` is `children.default_text_size`, so existing profiles keep
 * working before a parent has touched the new panel. We deliberately do NOT
 * migrate or drop that column here (spec §6.7 item 5).
 */
export function resolveReadingPreferences(
  stored: unknown,
  options: { readingLevel?: string | null; fallbackFontSize?: FontSize | null } = {}
): ReadingPreferences {
  const base = defaultPreferencesForLevel(options.readingLevel)
  if (options.fallbackFontSize && FONT_SIZES.includes(options.fallbackFontSize)) {
    base.fontSize = options.fallbackFontSize
  }
  return { ...base, ...sanitizeReadingPreferences(stored) }
}
