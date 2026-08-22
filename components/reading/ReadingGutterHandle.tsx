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
      guide.moveToLineAtClientY(e.clientY)
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

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== draggingPointerRef.current) return
    e.stopPropagation()
    draggingPointerRef.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

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
      {/* Hit-slop: the visible puck is 44px, the target is a comfortable 56+. */}
      <span aria-hidden className="absolute -inset-2" />
      <span aria-hidden className="reading-gutter-handle__grip" />
    </div>
  )
}
