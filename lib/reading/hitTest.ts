/**
 * Reading Guide — point → line and word.
 *
 * PURE MODULE: no React, no DOM.
 *
 * NEAREST-MATCH, NEVER NULL. A fingertip is roughly 10mm across and will land
 * in the gutter between words, in the paragraph gap, or past the end of a line
 * constantly. Returning "no hit" there makes the guide stutter and feel broken,
 * so every point resolves to something.
 *
 * We deliberately do NOT use document.elementFromPoint: it returns null in
 * gutters, forces a layout read on every pointermove, and cannot express
 * "nearest".
 */
import type { GuidePosition, Line, LineModel } from './types'

export type { GuidePosition }

/** Distance from a point to a closed interval; 0 when inside. */
function distanceToInterval(value: number, start: number, end: number): number {
  if (value < start) return start - value
  if (value > end) return value - end
  return 0
}

/**
 * @param x container-relative
 * @param y container-relative, ALREADY offset-adjusted by the caller
 *
 * `y` may legitimately be negative: with touchOffsetLines = 0.9, touching the
 * first line of the story puts the hit-test point above the container. The
 * clamp in step 1 resolves that to line 0 — which is why the caller must NOT
 * clamp `y` beforehand.
 */
export function hitTest(model: LineModel, x: number, y: number): GuidePosition {
  // No model yet (nothing measured, or an empty story). The caller gates the
  // overlay on `isReady`, so this is the honest "nothing to point at" answer.
  if (model.lines.length === 0) return { lineIndex: -1, wordIndex: -1 }

  const line = findNearestLine(model, y)
  return { lineIndex: line.index, wordIndex: findNearestWordIndex(line, x) }
}

/** The line containing `y`, else the one whose [top, bottom] is nearest. */
export function findNearestLine(model: LineModel, y: number): Line {
  let best = model.lines[0]
  let bestDistance = distanceToInterval(y, best.top, best.bottom)

  for (let i = 1; i < model.lines.length; i++) {
    const line = model.lines[i]
    const distance = distanceToInterval(y, line.top, line.bottom)
    if (distance < bestDistance) {
      best = line
      bestDistance = distance
    }
    // A distance of 0 means we're inside this line; nothing can beat it.
    if (bestDistance === 0) break
  }

  return best
}

/**
 * The word containing `x`, else the nearest horizontally. `x` left of the line
 * yields the first word, right of it the last — which is what a finger
 * overshooting the end of a line should do.
 */
export function findNearestWordIndex(line: Line, x: number): number {
  let best = line.words[0]
  let bestDistance = distanceToInterval(x, best.left, best.right)

  for (let i = 1; i < line.words.length; i++) {
    const word = line.words[i]
    const distance = distanceToInterval(x, word.left, word.right)
    if (distance < bestDistance) {
      best = word
      bestDistance = distance
    }
    if (bestDistance === 0) break
  }

  return best.index
}

/** Clamps a line index into the model. Used by the Next/Back line controls. */
export function clampLineIndex(model: LineModel, lineIndex: number): number {
  if (model.lines.length === 0) return -1
  return Math.min(model.lines.length - 1, Math.max(0, lineIndex))
}
