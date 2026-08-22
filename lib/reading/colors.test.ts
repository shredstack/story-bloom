import { describe, expect, it } from 'vitest'
import { BODY_TEXT_COLOR, HIGHLIGHT_PRESETS, MASK_ALPHA, PAGE_TINT } from './defaults'
import type { HighlightPreset, PageTint } from './types'

/**
 * The whole point of the guide is to make text EASIER to read. A highlight that
 * drops body-text contrast would be exactly backwards for the one user who can
 * least afford it — so every band and word colour is asserted here rather than
 * eyeballed (spec §5.6, §6.11).
 */

function srgbChannel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b)
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('contrast helper', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    // gray-800 on white — the reader's baseline.
    expect(contrastRatio('#FFFFFF', '#1F2937')).toBeGreaterThan(14)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#FFF1A8', '#1F2937')).toBeCloseTo(
      contrastRatio('#1F2937', '#FFF1A8'),
      10
    )
  })
})

describe('highlight presets', () => {
  const presets = Object.keys(HIGHLIGHT_PRESETS) as HighlightPreset[]

  it('ships all five presets from the spec', () => {
    expect(presets.sort()).toEqual(
      ['butter', 'lavender', 'mint', 'peach', 'sky'].sort()
    )
  })

  it.each(presets)('keeps body text ≥4.5:1 on the %s band', (preset) => {
    expect(
      contrastRatio(HIGHLIGHT_PRESETS[preset].band, BODY_TEXT_COLOR)
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(presets)('keeps body text ≥4.5:1 on the %s active word', (preset) => {
    expect(
      contrastRatio(HIGHLIGHT_PRESETS[preset].word, BODY_TEXT_COLOR)
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(presets)('makes the %s active word darker than its band', (preset) => {
    // The word highlight has to read as "stronger" than the line band, or
    // line-word mode collapses visually into plain line mode.
    expect(relativeLuminance(HIGHLIGHT_PRESETS[preset].word)).toBeLessThan(
      relativeLuminance(HIGHLIGHT_PRESETS[preset].band)
    )
  })
})

describe('page tints', () => {
  const tints = Object.keys(PAGE_TINT) as PageTint[]

  it.each(tints)('keeps body text ≥4.5:1 on the %s page', (tint) => {
    expect(contrastRatio(PAGE_TINT[tint], BODY_TEXT_COLOR)).toBeGreaterThanOrEqual(4.5)
  })

  it('offers a non-white default-capable option that is genuinely off-white', () => {
    // BDA guidance is to avoid pure white for glare comfort. This asserts the
    // cream tint is actually distinguishable from white, not a token gesture.
    expect(PAGE_TINT.cream).not.toBe(PAGE_TINT.white)
    expect(relativeLuminance(PAGE_TINT.cream)).toBeLessThan(
      relativeLuminance(PAGE_TINT.white)
    )
  })
})

describe('mask strengths', () => {
  it('dims meaningfully without going opaque', () => {
    expect(MASK_ALPHA.soft).toBeGreaterThan(0.2)
    expect(MASK_ALPHA.strong).toBeGreaterThan(MASK_ALPHA.soft)
    expect(MASK_ALPHA.strong).toBeLessThan(0.7)
  })
})
