'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cssVars } from '@/lib/reading/cssVars'
import { EMPTY_LINE_MODEL, buildLineModel } from '@/lib/reading/lineModel'
import type { LineModel, ReadingPreferences, WordRect } from '@/lib/reading/types'

interface UseLineModelOptions {
  containerRef: React.RefObject<HTMLElement | null>
  /** When false, nothing is measured and no observers are attached at all. */
  enabled: boolean
  content: string
  preferences: ReadingPreferences
}

interface UseLineModelReturn {
  model: LineModel
  /** Gate the overlay on this: a guide flashing at the wrong position on load
   *  is worse than a guide appearing 80ms late. */
  isReady: boolean
  remeasure: () => void
}

const RESIZE_DEBOUNCE_MS = 100
/** iOS sometimes fires resize before layout settles after a rotation. */
const ORIENTATION_SETTLE_MS = 250

/**
 * Measures the rendered word spans into a LineModel (spec §6.4).
 *
 * Cost is ~1–3ms for a 1500-word story, and StoryBloom stories are far
 * shorter — no virtualization needed.
 */
export function useLineModel({
  containerRef,
  enabled,
  content,
  preferences,
}: UseLineModelOptions): UseLineModelReturn {
  const [model, setModel] = useState<LineModel>(EMPTY_LINE_MODEL)
  const [isReady, setIsReady] = useState(false)

  // Anything that changes layout changes these vars, so this is exactly the
  // right re-measure trigger — and it can't drift out of sync with the CSS.
  const layoutKey = JSON.stringify(cssVars(preferences))

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // One layout read for the container, then pure rect reads per word.
    const containerRect = container.getBoundingClientRect()
    const elements = container.querySelectorAll<HTMLElement>('[data-word-index]')

    const rects: WordRect[] = []
    elements.forEach((el) => {
      // getClientRects()[0], NOT getBoundingClientRect(): a span that wraps
      // returns a two-line union rect from the latter, which would straddle
      // two buckets and poison the model. Words rarely wrap, but a long token
      // in a narrow column can.
      const rect = el.getClientRects()[0]
      if (!rect) return

      const index = Number(el.dataset.wordIndex)
      if (!Number.isFinite(index)) return

      // Container-relative, so the model survives page scroll and is only
      // invalidated by an actual layout change.
      rects.push({
        index,
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        right: rect.right - containerRect.left,
        bottom: rect.bottom - containerRect.top,
      })
    })

    // Column bounds come from a paragraph, not the text extent, so the band
    // reads as a ruler rather than as a selection.
    const paragraph = container.querySelector<HTMLElement>('.reading-paragraph')
    const columnBounds = paragraph
      ? (() => {
          const r = paragraph.getBoundingClientRect()
          return { left: r.left - containerRect.left, right: r.right - containerRect.left }
        })()
      : undefined

    setModel(buildLineModel(rects, columnBounds))
    setIsReady(rects.length > 0)
  }, [containerRef])

  useEffect(() => {
    if (!enabled) {
      // Guide off must cost nothing: no measurement, no observers.
      setModel(EMPTY_LINE_MODEL)
      setIsReady(false)
      return
    }

    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let rafId = 0
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let orientationTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!cancelled) measure()
      })
    }

    const start = async () => {
      // Nunito loads from Google Fonts. Measuring before it lands produces a
      // model built on the fallback font's metrics, and the guide is visibly
      // wrong on first paint.
      try {
        await document.fonts?.ready
      } catch {
        // No Font Loading API — measure anyway.
      }
      if (!cancelled) scheduleMeasure()
    }

    void start()

    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(scheduleMeasure, RESIZE_DEBOUNCE_MS)
    })
    observer.observe(container)

    const handleOrientationChange = () => {
      scheduleMeasure()
      if (orientationTimer) clearTimeout(orientationTimer)
      orientationTimer = setTimeout(scheduleMeasure, ORIENTATION_SETTLE_MS)
    }
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      if (resizeTimer) clearTimeout(resizeTimer)
      if (orientationTimer) clearTimeout(orientationTimer)
      observer.disconnect()
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
    // `layoutKey` and `content` are the layout inputs; changing either
    // invalidates every measured rect.
  }, [enabled, content, layoutKey, containerRef, measure])

  return { model, isReady, remeasure: measure }
}
