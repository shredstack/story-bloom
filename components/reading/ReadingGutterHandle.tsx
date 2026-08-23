'use client'

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { ReadingGuideApi } from '@/lib/hooks/useReadingGuide'

interface ReadingGutterHandleProps {
  guide: ReadingGuideApi
}

/**
 * "The bookmark" — a chunky puck pinned to the left gutter at the guide's
 * current line (spec §5.2c).
 *
 * This is the escape hatch. It never fights the page scroller (it is a small
 * dedicated target, so `touch-action: none` is safe here in a way it never is
 * on the reading surface) and it is the easiest of the three ways to move the
 * guide for a child with poor fine-motor control.
 *
 * It moves by LINE and resets to the first word of that line, and it does NOT
 * apply the touch offset — she is dragging an object she can see, not reading
 * under her own fingertip.
 *
 * The rail it lives in is reserved by `.reading-surface[data-guide='on']`'s
 * padding-left. That is load-bearing, not decoration: without a reserved rail
 * the puck clamps to the surface edge and paints over the first word of the
 * line, hiding the exact word she is trying to read.
 */
export function ReadingGutterHandle({ guide }: ReadingGutterHandleProps) {
  const draggingPointerRef = useRef<number | null>(null)

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingPointerRef.current !== null) return
      // Must not reach the surface's hold-then-slide machine underneath.
      e.stopPropagation()
      e.preventDefault()
      draggingPointerRef.current = e.pointerId
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.dataset.grabbed = 'on'
      // Record the grab point but do NOT move: taking hold of the puck should
      // never itself shift her place in the story.
      guide.startHandleDrag(e.clientY)
    },
    [guide]
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== draggingPointerRef.current) return
      e.stopPropagation()
      guide.moveToLineAtClientY(e.clientY)
    },
    [guide]
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== draggingPointerRef.current) return
      e.stopPropagation()
      draggingPointerRef.current = null
      e.currentTarget.dataset.grabbed = 'off'
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      guide.endHandleDrag()
      // The guide STICKS where she left it — nothing is cleared here.
    },
    [guide]
  )

  return (
    <div
      ref={guide.handleRef}
      // .no-print explicitly: it is `absolute`, not `fixed`, so the existing
      // @media print block would not catch it.
      className="reading-gutter-handle no-print"
      style={{ visibility: 'hidden' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // Deliberately hidden from assistive tech: it is a touch-only duplicate
      // of the bottom bar's Back/Next controls, which are the accessible path.
      aria-hidden="true"
    >
      {/* Hit-slop. Vertical only, plus leftward into the page margin: it must
          NOT extend right, or it would swallow taps meant for the first word
          of the line. Vertical is the axis that matters for a vertical drag. */}
      <span aria-hidden className="absolute -top-3 -bottom-3 -left-3 right-0" />
      <span aria-hidden className="reading-gutter-handle__grip" />
    </div>
  )
}
