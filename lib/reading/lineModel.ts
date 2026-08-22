/**
 * Reading Guide — measured word rects → a model of visual lines.
 *
 * PURE MODULE: no React, no DOM. It takes plain rect objects, never elements —
 * which is precisely why the bucketing logic below is cheap to test.
 *
 * Visual lines are a product of layout, not of markup: there is no element that
 * corresponds to "the third line". They have to be measured and reconstructed.
 */
import type { Line, LineModel, WordRect } from './types'

export type { Line, LineModel, WordRect }

export const EMPTY_LINE_MODEL: LineModel = {
  lines: [],
  lineHeightPx: 0,
  wordToLine: new Map(),
  columnLeft: 0,
  columnRight: 0,
}

/** Median, not mean: one period-only token has a much shorter rect. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

interface ColumnBounds {
  left: number
  right: number
}

/**
 * Groups word rects into visual lines.
 *
 * `columnBounds` is optional and, when supplied, comes from the paragraph
 * element rather than the text extent — so the band reads as a ruler spanning
 * the column rather than as a selection hugging the words. Without it we fall
 * back to the min/max of the rects themselves.
 */
export function buildLineModel(
  rects: WordRect[],
  columnBounds?: ColumnBounds
): LineModel {
  if (rects.length === 0) {
    return columnBounds
      ? { ...EMPTY_LINE_MODEL, wordToLine: new Map(), columnLeft: columnBounds.left, columnRight: columnBounds.right }
      : { ...EMPTY_LINE_MODEL, wordToLine: new Map() }
  }

  const lineHeightPx = median(rects.map((r) => r.bottom - r.top))

  // Two words on the same line can differ by a pixel or two in `top` (different
  // glyph heights, subpixel layout). Half a line-height is comfortably larger
  // than that jitter and comfortably smaller than the gap to the next line.
  const bucketTolerance = lineHeightPx > 0 ? lineHeightPx / 2 : 1

  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left)

  const buckets: WordRect[][] = []
  let bucketTop = Number.NaN

  for (const rect of sorted) {
    if (buckets.length === 0 || Math.abs(rect.top - bucketTop) >= bucketTolerance) {
      buckets.push([rect])
      bucketTop = rect.top
    } else {
      buckets[buckets.length - 1].push(rect)
    }
  }

  const wordToLine = new Map<number, number>()

  const lines: Line[] = buckets.map((bucket, index) => {
    // DOM order is not reading order for a wrapped line if rects arrive out of
    // order; sort by `left` so first/last word are genuinely first/last.
    const words = [...bucket].sort((a, b) => a.left - b.left)
    for (const word of words) wordToLine.set(word.index, index)

    return {
      index,
      top: Math.min(...words.map((w) => w.top)),
      bottom: Math.max(...words.map((w) => w.bottom)),
      firstWordIndex: words[0].index,
      lastWordIndex: words[words.length - 1].index,
      words,
    }
  })

  return {
    lines,
    lineHeightPx,
    wordToLine,
    columnLeft: columnBounds ? columnBounds.left : Math.min(...rects.map((r) => r.left)),
    columnRight: columnBounds
      ? columnBounds.right
      : Math.max(...rects.map((r) => r.right)),
  }
}

/** The rect of one word, or null if the index isn't in the model. */
export function findWordRect(model: LineModel, wordIndex: number): WordRect | null {
  const lineIndex = model.wordToLine.get(wordIndex)
  if (lineIndex === undefined) return null
  return model.lines[lineIndex]?.words.find((w) => w.index === wordIndex) ?? null
}
