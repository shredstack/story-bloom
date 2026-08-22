'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { tapHaptic } from '@/lib/native/haptics'
import {
  AUTOSCROLL_DEAD_ZONE,
  COMMIT_DEBOUNCE_MS,
  DOUBLE_TAP_MS,
  DRAG_CANCEL_PX,
  HOLD_MS,
  RESUME_DEBOUNCE_MS,
} from '@/lib/reading/defaults'
import { clampLineIndex, findNearestLine, hitTest } from '@/lib/reading/hitTest'
import { findWordRect } from '@/lib/reading/lineModel'
import type {
  LineModel,
  ReadingPreferences,
  WordToken,
} from '@/lib/reading/types'

/** Where a move came from. Drives animation, scroll behaviour and haptics. */
export type MoveSource = 'tap' | 'button' | 'key' | 'drag' | 'handle' | 'restore'

export interface ReadingGuideApi {
  /** Committed position. -1 means "not placed yet". */
  wordIndex: number
  lineIndex: number
  isReady: boolean
  containerRef: React.RefObject<HTMLElement | null>
  bandRef: React.RefObject<HTMLDivElement>
  wordRef: React.RefObject<HTMLDivElement>
  /** The gutter handle puck, positioned by the same rAF flush. */
  handleRef: React.RefObject<HTMLDivElement>
  /** Spread onto the reading surface. Empty object when the guide is off. */
  surfaceHandlers: Record<string, unknown>
  moveToWord: (wordIndex: number, source?: MoveSource) => void
  moveToLine: (lineIndex: number, source?: MoveSource) => void
  /** Used by the gutter handle: line only, and never touch-offset. */
  moveToLineAtClientY: (clientY: number) => void
  nextLine: () => void
  previousLine: () => void
  /** Announced to screen readers on keyboard moves only. */
  liveMessage: string
}

interface UseReadingGuideOptions {
  containerRef: React.RefObject<HTMLElement | null>
  model: LineModel
  isReady: boolean
  preferences: ReadingPreferences
  /** Flattened tokens, for the aria-live line announcement. */
  tokens: WordToken[]
  /** Namespaces the resume position. */
  storyId: string
  /** Escape key handler — lets the child bail out of the guide. */
  onTurnOffGuide?: () => void
  /**
   * Double-tap on the same word. Single tap is taken by tap-to-place and
   * long-press by hold-then-slide, so this is the only gesture left free.
   */
  onWordDoubleTap?: (wordIndex: number) => void
}

const RESUME_KEY_PREFIX = 'storybloom-reading-pos:'
/** Band is inflated 2px vertically so it reads as a ruler, not a tight box. */
const BAND_INFLATE_PX = 2
const DRAGGING_CLASS = 'reading-surface--dragging'

type PointerPhase = 'idle' | 'pending' | 'dragging' | 'released'

interface StoredPosition {
  storyId: string
  wordIndex: number
}

function readResume(storyId: string): number | null {
  try {
    const raw = localStorage.getItem(`${RESUME_KEY_PREFIX}${storyId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPosition
    // Word index, not line index: line indices change with font size,
    // orientation and column width; word indices don't.
    if (parsed?.storyId !== storyId) return null
    return Number.isInteger(parsed.wordIndex) && parsed.wordIndex >= 0
      ? parsed.wordIndex
      : null
  } catch {
    return null
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * The guide's position and the pointer state machine (spec §6.9).
 *
 *   idle ──pointerdown──> pending ──180ms──> dragging ──pointerup──> idle
 *                            │
 *                            ├──move >10px──> released (the browser scrolls)
 *                            └──pointerup <180ms──> tap (place) ──> idle
 *
 * The 180ms hold plus the 10px cancel threshold is what preserves ordinary
 * page scrolling. `touch-action: none` is applied ONLY once a drag has
 * actually started; setting it statically on the reading surface would break
 * scrolling outright, which is the single most likely way this ships broken.
 *
 * Positioning is imperative — rAF plus `transform`. React state is committed
 * only when the committed word index changes, debounced, because re-rendering
 * 800 spans on pointermove is the obvious wrong implementation.
 */
export function useReadingGuide({
  containerRef,
  model,
  isReady,
  preferences,
  tokens,
  storyId,
  onTurnOffGuide,
  onWordDoubleTap,
}: UseReadingGuideOptions): ReadingGuideApi {
  const guideOn = preferences.guideMode !== 'off'

  const bandRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  // The live position. React state lags this deliberately.
  const positionRef = useRef({ lineIndex: -1, wordIndex: -1 })
  const [committed, setCommitted] = useState({ lineIndex: -1, wordIndex: -1 })
  const [liveMessage, setLiveMessage] = useState('')

  const modelRef = useRef(model)
  modelRef.current = model
  const prefsRef = useRef(preferences)
  prefsRef.current = preferences

  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<{
    lineIndex: number
    wordIndex: number
    animate: boolean
  } | null>(null)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredForRef = useRef<string | null>(null)

  // Pointer state machine.
  const phaseRef = useRef<PointerPhase>('idle')
  const activePointerRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const isTouchLikeRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cached per gesture and refreshed on scroll — never read per pointermove.
  const containerRectRef = useRef<DOMRect | null>(null)
  const lastHapticLineRef = useRef(-1)
  const lastTapRef = useRef<{ wordIndex: number; time: number } | null>(null)
  // The gutter handle is a fixed 56px square. Measured once, because reading
  // offsetWidth after writing styles forces a synchronous layout every frame.
  const handleSizeRef = useRef({ width: 0, height: 0 })

  const doubleTapRef = useRef(onWordDoubleTap)
  doubleTapRef.current = onWordDoubleTap

  // ------------------------------------------------------------ positioning

  const flush = useCallback(() => {
    rafRef.current = null
    const pending = pendingRef.current
    if (!pending) return

    const currentModel = modelRef.current
    const prefs = prefsRef.current
    const line = currentModel.lines[pending.lineIndex]
    if (!line) return

    // All layout READS happen here, before any writes below.
    let handleSize = handleSizeRef.current
    if (handleRef.current && handleSize.width === 0) {
      handleSize = {
        width: handleRef.current.offsetWidth,
        height: handleRef.current.offsetHeight,
      }
      handleSizeRef.current = handleSize
    }

    // Mask mode lights 1, 3 or 5 lines centred on the active one.
    let bandTop = line.top
    let bandBottom = line.bottom
    if (prefs.guideMode === 'mask' && prefs.maskLines > 1) {
      const half = Math.floor(prefs.maskLines / 2)
      const first =
        currentModel.lines[clampLineIndex(currentModel, pending.lineIndex - half)]
      const last =
        currentModel.lines[clampLineIndex(currentModel, pending.lineIndex + half)]
      if (first) bandTop = first.top
      if (last) bandBottom = last.bottom
    }

    const band = bandRef.current
    if (band) {
      band.dataset.animate = pending.animate ? 'on' : 'off'
      // transform, not top: compositor-only, no layout.
      band.style.transform = `translateY(${bandTop - BAND_INFLATE_PX}px)`
      band.style.height = `${bandBottom - bandTop + BAND_INFLATE_PX * 2}px`
      band.style.left = `${currentModel.columnLeft}px`
      band.style.width = `${currentModel.columnRight - currentModel.columnLeft}px`
      band.style.visibility = 'visible'
    }

    const wordEl = wordRef.current
    if (wordEl) {
      const rect = findWordRect(currentModel, pending.wordIndex)
      if (rect) {
        wordEl.dataset.animate = pending.animate ? 'on' : 'off'
        wordEl.style.transform = `translate(${rect.left - BAND_INFLATE_PX}px, ${
          rect.top - BAND_INFLATE_PX
        }px)`
        wordEl.style.width = `${rect.right - rect.left + BAND_INFLATE_PX * 2}px`
        wordEl.style.height = `${rect.bottom - rect.top + BAND_INFLATE_PX * 2}px`
        wordEl.style.visibility = 'visible'
      } else {
        wordEl.style.visibility = 'hidden'
      }
    }

    const handle = handleRef.current
    if (handle) {
      handle.dataset.animate = pending.animate ? 'on' : 'off'
      // Sits in the gutter beside the column, clamped to the surface on a
      // narrow phone where there is no gutter to sit in.
      handle.style.left = `${Math.max(0, currentModel.columnLeft - handleSize.width - 4)}px`
      handle.style.transform = `translateY(${
        line.top + (line.bottom - line.top) / 2 - handleSize.height / 2
      }px)`
      handle.style.visibility = 'visible'
    }
  }, [])

  const scheduleFlush = useCallback(
    (lineIndex: number, wordIndex: number, animate: boolean) => {
      pendingRef.current = { lineIndex, wordIndex, animate }
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush)
      }
    },
    [flush]
  )

  // ----------------------------------------------------------- auto-scroll

  /**
   * Keeps the active line out of the top/bottom 18% of the viewport, so she
   * never has to choose between tracking and scrolling.
   *
   * During a drag this is instant: smooth scrolling fights the finger and
   * feels like the page is sliding away.
   */
  const autoScroll = useCallback(
    (lineIndex: number, source: MoveSource) => {
      const container = containerRef.current
      const line = modelRef.current.lines[lineIndex]
      if (!container || !line) return

      // Reuse the rect cached for hit-testing rather than forcing another
      // layout read on every move of a drag.
      const containerTop = (
        containerRectRef.current ?? container.getBoundingClientRect()
      ).top
      const lineTop = containerTop + line.top
      const lineBottom = containerTop + line.bottom
      const viewportHeight = window.innerHeight
      const deadZone = viewportHeight * AUTOSCROLL_DEAD_ZONE

      const outOfZone = lineTop < deadZone || lineBottom > viewportHeight - deadZone
      if (!prefsRef.current.keepLineCentered && !outOfZone) return

      const delta = (lineTop + lineBottom) / 2 - viewportHeight / 2
      if (Math.abs(delta) < 1) return

      window.scrollBy({
        top: delta,
        behavior: source === 'drag' || prefersReducedMotion() ? 'auto' : 'smooth',
      })

      // The cached rect just went stale by exactly `delta`. Correct it rather
      // than forcing another layout read mid-drag.
      const cached = containerRectRef.current
      if (cached) {
        containerRectRef.current = new DOMRect(
          cached.x,
          cached.y - delta,
          cached.width,
          cached.height
        )
      }
    },
    [containerRef]
  )

  /** Single entry point for every move. */
  const applyPosition = useCallback(
    (lineIndex: number, wordIndex: number, source: MoveSource) => {
      if (lineIndex < 0 || wordIndex < 0) return

      const previousLineIndex = positionRef.current.lineIndex
      positionRef.current = { lineIndex, wordIndex }

      // No transition during an active drag: a band lagging under a moving
      // finger feels broken.
      const animate = source !== 'drag' && source !== 'restore'
      scheduleFlush(lineIndex, wordIndex, animate)

      if (
        prefsRef.current.hapticOnLineChange &&
        (source === 'drag' || source === 'handle') &&
        lineIndex !== previousLineIndex &&
        lineIndex !== lastHapticLineRef.current
      ) {
        lastHapticLineRef.current = lineIndex
        tapHaptic()
      }

      if (source !== 'restore') autoScroll(lineIndex, source)

      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null
        setCommitted((prev) =>
          prev.lineIndex === lineIndex && prev.wordIndex === wordIndex
            ? prev
            : { lineIndex, wordIndex }
        )
      }, COMMIT_DEBOUNCE_MS)
    },
    [scheduleFlush, autoScroll]
  )

  const moveToWord = useCallback(
    (wordIndex: number, source: MoveSource = 'button') => {
      const lineIndex = modelRef.current.wordToLine.get(wordIndex)
      if (lineIndex === undefined) return
      applyPosition(lineIndex, wordIndex, source)
    },
    [applyPosition]
  )

  const moveToLine = useCallback(
    (lineIndex: number, source: MoveSource = 'button') => {
      const clamped = clampLineIndex(modelRef.current, lineIndex)
      const line = modelRef.current.lines[clamped]
      if (!line) return
      // Word position resets to the start of the line — Next line from the last
      // line of a paragraph therefore lands on the first word of the next.
      applyPosition(clamped, line.firstWordIndex, source)
    },
    [applyPosition]
  )

  const nextLine = useCallback(() => {
    const current = positionRef.current.lineIndex
    moveToLine(current < 0 ? 0 : current + 1)
  }, [moveToLine])

  const previousLine = useCallback(() => {
    const current = positionRef.current.lineIndex
    moveToLine(current < 0 ? 0 : current - 1)
  }, [moveToLine])

  /** The gutter handle drags by LINE and never applies the touch offset. */
  const moveToLineAtClientY = useCallback(
    (clientY: number) => {
      const container = containerRef.current
      const currentModel = modelRef.current
      if (!container || currentModel.lines.length === 0) return
      const rect = containerRectRef.current ?? container.getBoundingClientRect()
      const line = findNearestLine(currentModel, clientY - rect.top)
      applyPosition(line.index, line.firstWordIndex, 'handle')
    },
    [containerRef, applyPosition]
  )

  // ------------------------------------------------- model change / restore

  // Reset when the story changes so we don't restore into the wrong text.
  // Declared BEFORE the restore effect: effects run in declaration order.
  useEffect(() => {
    positionRef.current = { lineIndex: -1, wordIndex: -1 }
    setCommitted({ lineIndex: -1, wordIndex: -1 })
    restoredForRef.current = null
  }, [storyId])

  // Re-anchor on the same WORD when the model rebuilds (font size change,
  // rotation, column change). This is the whole reason the position is stored
  // as a word index.
  useEffect(() => {
    if (!guideOn || !isReady) return

    const { wordIndex } = positionRef.current
    if (wordIndex >= 0) {
      const lineIndex = model.wordToLine.get(wordIndex)
      if (lineIndex !== undefined) {
        positionRef.current = { lineIndex, wordIndex }
        scheduleFlush(lineIndex, wordIndex, false)
      }
      return
    }

    // Nothing placed yet — restore where she left off, once per story.
    if (restoredForRef.current === storyId) return
    restoredForRef.current = storyId

    const resumed = readResume(storyId)
    const target =
      resumed !== null && model.wordToLine.has(resumed)
        ? resumed
        : (model.lines[0]?.firstWordIndex ?? -1)

    if (target >= 0) {
      const lineIndex = model.wordToLine.get(target)
      if (lineIndex !== undefined) applyPosition(lineIndex, target, 'restore')
    }
  }, [guideOn, isReady, model, storyId, applyPosition, scheduleFlush])

  // Re-flush when the guide mode or mask line count changes, so the band
  // resizes without waiting for the next move.
  useEffect(() => {
    const { lineIndex, wordIndex } = positionRef.current
    if (lineIndex >= 0) scheduleFlush(lineIndex, wordIndex, false)
  }, [preferences.guideMode, preferences.maskLines, scheduleFlush])

  // Persist the resume position.
  useEffect(() => {
    if (!guideOn || committed.wordIndex < 0) return
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          `${RESUME_KEY_PREFIX}${storyId}`,
          JSON.stringify({ storyId, wordIndex: committed.wordIndex })
        )
      } catch {
        // Private mode / quota. Losing the resume position is survivable.
      }
    }, RESUME_DEBOUNCE_MS)
  }, [guideOn, committed.wordIndex, storyId])

  // Hide the overlay when there is nothing to point at.
  useEffect(() => {
    if (isReady && guideOn) return
    if (bandRef.current) bandRef.current.style.visibility = 'hidden'
    if (wordRef.current) wordRef.current.style.visibility = 'hidden'
    if (handleRef.current) handleRef.current.style.visibility = 'hidden'
  }, [isReady, guideOn])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  // ------------------------------------------------------------- pointer

  /**
   * The finger occludes what it touches, so the hit-test point sits ABOVE the
   * fingertip: she rides her finger under the line, exactly as she would with
   * a bookmark on paper.
   *
   * Mouse and trackpad get offset 0 — there is nothing to occlude, and an
   * offset cursor just feels broken.
   */
  const touchOffsetPx = useCallback(() => {
    if (!isTouchLikeRef.current) return 0
    return prefsRef.current.touchOffsetLines * modelRef.current.lineHeightPx
  }, [])

  const placeFromPoint = useCallback(
    (clientX: number, clientY: number, source: MoveSource) => {
      const container = containerRef.current
      if (!container) return
      const rect = containerRectRef.current ?? container.getBoundingClientRect()

      // Do NOT clamp y here: with touchOffsetLines = 0.9, touching the first
      // line yields a negative y and hitTest's own clamp resolves it to line 0.
      // Clamping early would break the offset near the top of the page.
      const hit = hitTest(
        modelRef.current,
        clientX - rect.left,
        clientY - rect.top - touchOffsetPx()
      )
      if (hit.lineIndex < 0) return
      applyPosition(hit.lineIndex, hit.wordIndex, source)

      if (source !== 'tap') return

      // Two taps on the SAME word inside the window = "say it". The guide has
      // already moved on the first tap, so the word does not shift underfoot.
      const now = Date.now()
      const last = lastTapRef.current
      if (
        last &&
        last.wordIndex === hit.wordIndex &&
        now - last.time < DOUBLE_TAP_MS
      ) {
        lastTapRef.current = null
        doubleTapRef.current?.(hit.wordIndex)
      } else {
        lastTapRef.current = { wordIndex: hit.wordIndex, time: now }
      }
    },
    [containerRef, applyPosition, touchOffsetPx]
  )

  const endDrag = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    container.classList.remove(DRAGGING_CLASS)
    const pointerId = activePointerRef.current
    if (pointerId !== null && container.hasPointerCapture?.(pointerId)) {
      container.releasePointerCapture(pointerId)
    }
  }, [containerRef])

  const beginDrag = useCallback(() => {
    const container = containerRef.current
    const pointerId = activePointerRef.current
    if (!container || pointerId === null) return

    phaseRef.current = 'dragging'
    // touch-action: none goes on NOW and comes off on pointerup. Never static.
    container.classList.add(DRAGGING_CLASS)
    try {
      container.setPointerCapture(pointerId)
    } catch {
      // Pointer already gone; the drag ends on the next up/cancel.
    }
    tapHaptic()
    containerRectRef.current = container.getBoundingClientRect()
    lastHapticLineRef.current = positionRef.current.lineIndex

    // Land the guide immediately so the hold has visible feedback.
    const point = lastPointRef.current
    if (point) placeFromPoint(point.x, point.y, 'drag')
  }, [containerRef, placeFromPoint])

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // Ignore secondary pointers entirely: a second finger mid-gesture is a
      // palm, not an instruction. Same defensive stance as KidButton.
      if (activePointerRef.current !== null) return

      activePointerRef.current = e.pointerId
      pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
      lastPointRef.current = { x: e.clientX, y: e.clientY }
      isTouchLikeRef.current = e.pointerType === 'touch' || e.pointerType === 'pen'
      phaseRef.current = 'pending'
      containerRectRef.current = containerRef.current?.getBoundingClientRect() ?? null

      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      holdTimerRef.current = setTimeout(beginDrag, HOLD_MS)

      // Deliberately NOT preventDefault: that would kill page scrolling.
    },
    [containerRef, beginDrag]
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerId !== activePointerRef.current) return
      lastPointRef.current = { x: e.clientX, y: e.clientY }

      if (phaseRef.current === 'pending') {
        const start = pointerStartRef.current
        if (!start) return
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
        if (moved > DRAG_CANCEL_PX) {
          // She is scrolling. Stand down completely and let the browser do it.
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
          holdTimerRef.current = null
          phaseRef.current = 'released'
        }
        return
      }

      if (phaseRef.current === 'dragging') {
        placeFromPoint(e.clientX, e.clientY, 'drag')
      }
    },
    [placeFromPoint]
  )

  const resetPointer = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
    activePointerRef.current = null
    pointerStartRef.current = null
    lastPointRef.current = null
    phaseRef.current = 'idle'
    containerRectRef.current = null
  }, [])

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerId !== activePointerRef.current) return
      const phase = phaseRef.current
      const start = pointerStartRef.current

      if (phase === 'dragging') {
        endDrag()
      } else if (phase === 'pending' && start) {
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
        // A stationary press-and-lift is a tap. Anything that travelled was a
        // scroll, and the browser already handled it.
        if (moved <= DRAG_CANCEL_PX) {
          placeFromPoint(e.clientX, e.clientY, 'tap')
        }
      }

      resetPointer()
      // The guide STICKS: nothing is cleared on pointer-up.
    },
    [endDrag, placeFromPoint, resetPointer]
  )

  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerId !== activePointerRef.current) return
      if (phaseRef.current === 'dragging') endDrag()
      resetPointer()
    },
    [endDrag, resetPointer]
  )

  /**
   * iOS long-press over text pops the selection magnifier inside WKWebView,
   * which fights hold-then-slide. `-webkit-user-select: none` on the surface
   * covers most of it; this covers the rest, and only while a press is live.
   */
  useEffect(() => {
    if (!guideOn) return
    const container = containerRef.current
    if (!container) return

    const blockSelection = (e: Event) => {
      if (phaseRef.current === 'dragging' || phaseRef.current === 'pending') {
        e.preventDefault()
      }
    }
    const refreshRect = () => {
      if (phaseRef.current === 'dragging') {
        containerRectRef.current = container.getBoundingClientRect()
      }
    }

    container.addEventListener('selectstart', blockSelection)
    window.addEventListener('scroll', refreshRect, { passive: true })
    return () => {
      container.removeEventListener('selectstart', blockSelection)
      window.removeEventListener('scroll', refreshRect)
    }
  }, [guideOn, containerRef])

  // ------------------------------------------------------------- keyboard

  const lineText = useCallback(
    (lineIndex: number) => {
      const line = modelRef.current.lines[lineIndex]
      if (!line) return ''
      return tokens
        .slice(line.firstWordIndex, line.lastWordIndex + 1)
        .map((t) => t.raw)
        .join(' ')
    },
    [tokens]
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const currentModel = modelRef.current
      if (currentModel.lines.length === 0) return

      const { lineIndex, wordIndex } = positionRef.current
      const line = lineIndex >= 0 ? lineIndex : 0
      let handled = true

      switch (e.key) {
        case 'ArrowDown':
          moveToLine(line + 1, 'key')
          break
        case 'ArrowUp':
          moveToLine(line - 1, 'key')
          break
        case 'ArrowRight':
          moveToWord(Math.min(tokens.length - 1, Math.max(0, wordIndex) + 1), 'key')
          break
        case 'ArrowLeft':
          moveToWord(Math.max(0, Math.max(0, wordIndex) - 1), 'key')
          break
        case 'Escape':
          onTurnOffGuide?.()
          break
        default:
          handled = false
      }

      if (!handled) return
      e.preventDefault()

      // Announce ONLY for keyboard moves. During a touch drag this would fire
      // constantly and make the screen reader useless.
      if (e.key !== 'Escape') {
        // positionRef is already updated synchronously by applyPosition.
        setLiveMessage(lineText(positionRef.current.lineIndex))
      }
    },
    [moveToLine, moveToWord, tokens.length, onTurnOffGuide, lineText]
  )

  // When the guide is off we attach NOTHING (spec §6.9).
  const surfaceHandlers = useMemo(
    () =>
      guideOn
        ? {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerCancel,
            onKeyDown: handleKeyDown,
            tabIndex: 0,
            'aria-label': 'Story text with reading guide',
          }
        : {},
    [
      guideOn,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerCancel,
      handleKeyDown,
    ]
  )

  return {
    wordIndex: committed.wordIndex,
    lineIndex: committed.lineIndex,
    isReady: isReady && guideOn,
    containerRef,
    bandRef,
    wordRef,
    handleRef,
    surfaceHandlers,
    moveToWord,
    moveToLine,
    moveToLineAtClientY,
    nextLine,
    previousLine,
    liveMessage,
  }
}
