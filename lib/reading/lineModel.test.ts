import { describe, expect, it } from 'vitest'
import { buildLineModel, findWordRect } from './lineModel'
import type { WordRect } from './types'

/** Synthetic word rect. Defaults approximate a 20px font at line-height 1.8. */
function rect(
  index: number,
  top: number,
  left: number,
  { width = 40, height = 24 }: { width?: number; height?: number } = {}
): WordRect {
  return { index, top, left, right: left + width, bottom: top + height }
}

/** Three lines of three words each, 36px apart (20px × 1.8). */
const THREE_LINES: WordRect[] = [
  rect(0, 0, 0),
  rect(1, 0, 50),
  rect(2, 0, 100),
  rect(3, 36, 0),
  rect(4, 36, 50),
  rect(5, 36, 100),
  rect(6, 72, 0),
  rect(7, 72, 50),
  rect(8, 72, 100),
]

describe('buildLineModel — bucketing', () => {
  it('groups words into visual lines', () => {
    const model = buildLineModel(THREE_LINES)
    expect(model.lines).toHaveLength(3)
    expect(model.lines.map((l) => l.words.map((w) => w.index))).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ])
  })

  it('keeps two words on one line when their tops differ by 1px', () => {
    const model = buildLineModel([rect(0, 0, 0), rect(1, 1, 50)])
    expect(model.lines).toHaveLength(1)
    expect(model.lines[0].words.map((w) => w.index)).toEqual([0, 1])
  })

  it('separates words a full line apart', () => {
    const model = buildLineModel([rect(0, 0, 0), rect(1, 36, 0)])
    expect(model.lines).toHaveLength(2)
  })

  it('records first and last word index per line', () => {
    const model = buildLineModel(THREE_LINES)
    expect(model.lines[1].firstWordIndex).toBe(3)
    expect(model.lines[1].lastWordIndex).toBe(5)
  })

  it('exposes line top and bottom from the words it contains', () => {
    const model = buildLineModel([
      rect(0, 10, 0, { height: 24 }),
      rect(1, 12, 50, { height: 18 }),
    ])
    expect(model.lines[0].top).toBe(10)
    expect(model.lines[0].bottom).toBe(34)
  })

  it('maps every word index to its line', () => {
    const model = buildLineModel(THREE_LINES)
    expect(model.wordToLine.get(0)).toBe(0)
    expect(model.wordToLine.get(4)).toBe(1)
    expect(model.wordToLine.get(8)).toBe(2)
    expect(model.wordToLine.size).toBe(9)
  })

  it('sorts words by left within a line even when they arrive out of DOM order', () => {
    const model = buildLineModel([rect(2, 0, 100), rect(0, 0, 0), rect(1, 0, 50)])
    expect(model.lines[0].words.map((w) => w.index)).toEqual([0, 1, 2])
    expect(model.lines[0].firstWordIndex).toBe(0)
    expect(model.lines[0].lastWordIndex).toBe(2)
  })

  it('orders lines top to bottom regardless of input order', () => {
    const model = buildLineModel([rect(1, 72, 0), rect(2, 36, 0), rect(0, 0, 0)])
    expect(model.lines.map((l) => l.top)).toEqual([0, 36, 72])
  })
})

describe('buildLineModel — lineHeightPx', () => {
  it('is the median height, not the mean', () => {
    // A period-only token has a much shorter rect; the mean would be dragged
    // down by it and the bucket tolerance would shrink with it.
    const model = buildLineModel([
      rect(0, 0, 0, { height: 24 }),
      rect(1, 0, 50, { height: 24 }),
      rect(2, 0, 100, { height: 24 }),
      rect(3, 0, 150, { height: 6 }),
    ])
    expect(model.lineHeightPx).toBe(24)
  })

  it('is unaffected by a single tall outlier', () => {
    const model = buildLineModel([
      rect(0, 0, 0, { height: 24 }),
      rect(1, 0, 50, { height: 24 }),
      rect(2, 0, 100, { height: 90 }),
    ])
    expect(model.lineHeightPx).toBe(24)
  })

  it('averages the two middle values for an even count', () => {
    const model = buildLineModel([
      rect(0, 0, 0, { height: 20 }),
      rect(1, 0, 50, { height: 24 }),
    ])
    expect(model.lineHeightPx).toBe(22)
  })
})

describe('buildLineModel — edge cases', () => {
  it('returns an empty model for empty input rather than throwing', () => {
    const model = buildLineModel([])
    expect(model.lines).toEqual([])
    expect(model.lineHeightPx).toBe(0)
    expect(model.wordToLine.size).toBe(0)
    expect(model.columnLeft).toBe(0)
    expect(model.columnRight).toBe(0)
  })

  it('handles a single-word story', () => {
    const model = buildLineModel([rect(0, 0, 0)])
    expect(model.lines).toHaveLength(1)
    expect(model.lines[0].firstWordIndex).toBe(0)
    expect(model.lines[0].lastWordIndex).toBe(0)
  })

  it('handles a single-word line inside a longer story', () => {
    const model = buildLineModel([rect(0, 0, 0), rect(1, 0, 50), rect(2, 36, 0)])
    expect(model.lines[1].words).toHaveLength(1)
    expect(model.lines[1].firstWordIndex).toBe(2)
    expect(model.lines[1].lastWordIndex).toBe(2)
  })

  it('does not collapse everything into one bucket when all heights are zero', () => {
    // Degenerate measurement (fonts not loaded, display:none). The tolerance
    // must not become 0 or Infinity.
    const model = buildLineModel([
      rect(0, 0, 0, { height: 0 }),
      rect(1, 36, 0, { height: 0 }),
    ])
    expect(model.lines).toHaveLength(2)
  })
})

describe('buildLineModel — column bounds', () => {
  it('derives the column from the rects when no bounds are given', () => {
    const model = buildLineModel([rect(0, 0, 10), rect(1, 36, 40, { width: 100 })])
    expect(model.columnLeft).toBe(10)
    expect(model.columnRight).toBe(140)
  })

  it('prefers explicit bounds so the band spans the column, not the text', () => {
    const model = buildLineModel([rect(0, 0, 10), rect(1, 36, 40)], {
      left: 0,
      right: 400,
    })
    expect(model.columnLeft).toBe(0)
    expect(model.columnRight).toBe(400)
  })

  it('keeps explicit bounds even when there are no words', () => {
    const model = buildLineModel([], { left: 8, right: 300 })
    expect(model.columnLeft).toBe(8)
    expect(model.columnRight).toBe(300)
  })
})

describe('findWordRect', () => {
  it('finds a word by index', () => {
    const model = buildLineModel(THREE_LINES)
    expect(findWordRect(model, 4)?.left).toBe(50)
    expect(findWordRect(model, 4)?.top).toBe(36)
  })

  it('returns null for an unknown index', () => {
    expect(findWordRect(buildLineModel(THREE_LINES), 99)).toBeNull()
    expect(findWordRect(buildLineModel([]), 0)).toBeNull()
  })
})
