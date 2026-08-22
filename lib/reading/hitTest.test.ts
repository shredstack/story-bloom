import { describe, expect, it } from 'vitest'
import { clampLineIndex, hitTest } from './hitTest'
import { buildLineModel } from './lineModel'
import type { WordRect } from './types'

function rect(index: number, top: number, left: number, width = 40): WordRect {
  return { index, top, left, right: left + width, bottom: top + 24 }
}

/**
 * Three lines, 36px apart, words at x = 0..40, 50..90, 100..140.
 * The 10px runs between them are the gutters a fingertip lands in constantly.
 */
const MODEL = buildLineModel([
  rect(0, 0, 0),
  rect(1, 0, 50),
  rect(2, 0, 100),
  rect(3, 36, 0),
  rect(4, 36, 50),
  rect(5, 36, 100),
  rect(6, 72, 0),
  rect(7, 72, 50),
  rect(8, 72, 100),
])

describe('hitTest — direct hits', () => {
  it('returns the word under the point', () => {
    expect(hitTest(MODEL, 20, 12)).toEqual({ lineIndex: 0, wordIndex: 0 })
    expect(hitTest(MODEL, 70, 48)).toEqual({ lineIndex: 1, wordIndex: 4 })
    expect(hitTest(MODEL, 120, 84)).toEqual({ lineIndex: 2, wordIndex: 8 })
  })

  it('counts the exact edges of a word as inside it', () => {
    expect(hitTest(MODEL, 0, 0).wordIndex).toBe(0)
    expect(hitTest(MODEL, 40, 24).wordIndex).toBe(0)
  })
})

describe('hitTest — nearest match, never null', () => {
  it('picks the nearer word in the gutter between two words', () => {
    // Gutter runs 40..50. 42 is nearer word 0, 48 nearer word 1.
    expect(hitTest(MODEL, 42, 12).wordIndex).toBe(0)
    expect(hitTest(MODEL, 48, 12).wordIndex).toBe(1)
  })

  it('picks the nearest line in the gap between lines', () => {
    // Line 0 ends at y=24, line 1 starts at y=36.
    expect(hitTest(MODEL, 20, 26).lineIndex).toBe(0)
    expect(hitTest(MODEL, 20, 34).lineIndex).toBe(1)
  })

  it('never returns a null-ish result in a paragraph gap', () => {
    const result = hitTest(MODEL, 45, 30)
    expect(result.lineIndex).toBeGreaterThanOrEqual(0)
    expect(result.wordIndex).toBeGreaterThanOrEqual(0)
  })

  it('resolves a far-away point to the nearest line and word', () => {
    expect(hitTest(MODEL, 9999, 9999)).toEqual({ lineIndex: 2, wordIndex: 8 })
  })
})

describe('hitTest — clamping', () => {
  it('resolves a negative y to line 0', () => {
    // This is the normal case near the top of the page: with
    // touchOffsetLines = 0.9 the hit-test point sits ABOVE the container.
    expect(hitTest(MODEL, 20, -30).lineIndex).toBe(0)
    expect(hitTest(MODEL, 20, -500).lineIndex).toBe(0)
  })

  it('keeps the correct word when y is negative', () => {
    expect(hitTest(MODEL, 120, -30)).toEqual({ lineIndex: 0, wordIndex: 2 })
  })

  it('resolves a y past the last line to the last line', () => {
    expect(hitTest(MODEL, 20, 500).lineIndex).toBe(2)
  })

  it('resolves an x past the end of a line to the last word', () => {
    expect(hitTest(MODEL, 900, 84)).toEqual({ lineIndex: 2, wordIndex: 8 })
  })

  it('resolves an x left of the line to the first word', () => {
    expect(hitTest(MODEL, -900, 84)).toEqual({ lineIndex: 2, wordIndex: 6 })
  })
})

describe('hitTest — empty model', () => {
  it('reports "nothing to point at" rather than inventing a position', () => {
    // The caller gates the overlay on isReady; -1 is the honest answer when
    // nothing has been measured. It must not silently resolve to word 0.
    expect(hitTest(buildLineModel([]), 10, 10)).toEqual({
      lineIndex: -1,
      wordIndex: -1,
    })
  })
})

describe('hitTest — single line', () => {
  it('works with one line of one word', () => {
    const model = buildLineModel([rect(0, 0, 0)])
    expect(hitTest(model, -50, -50)).toEqual({ lineIndex: 0, wordIndex: 0 })
    expect(hitTest(model, 5000, 5000)).toEqual({ lineIndex: 0, wordIndex: 0 })
  })
})

describe('clampLineIndex', () => {
  it('clamps into range', () => {
    expect(clampLineIndex(MODEL, -3)).toBe(0)
    expect(clampLineIndex(MODEL, 1)).toBe(1)
    expect(clampLineIndex(MODEL, 99)).toBe(2)
  })

  it('returns -1 for an empty model', () => {
    expect(clampLineIndex(buildLineModel([]), 0)).toBe(-1)
  })
})
