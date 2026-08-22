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
import { COMMIT_DEBOUNCE_MS, DRAG_CANCEL_PX, RESUME_DEBOUNCE_MS } from '@/lib/reading/defaults'
import { clampLineIndex, hitTest } from '@/lib/reading/hitTest'
import { findWordRect } from '@/lib/reading/lineModel'
import type {
  LineModel,
  ReadingPreferences,
  WordToken,
} from '@/lib/reading/types'

/** Where a move came from. Drives whether the band animates. */
export type MoveSource = 'tap' | 'button' | 'key' | 'drag' | 'restore'

export interface ReadingGuideApi {
  /** Committed position. -1 means "not placed yet". */
  wordIndex: number
  lineIndex: number
  isReady: boolean
  bandRef: React.RefObject<HTMLDivElement>
  wordRef: React.RefObject<HTMLDivElement>
  /** Spread onto the reading surface. Empty object when the guide is off. */
  surfaceHandlers: Record<string, unknown>
  moveToWord: (wordIndex: number, source?: MoveSource) => void
  moveToLine: (lineIndex: number, source?: MoveSource) => void
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
}

const RESUME_KEY_PREFIX = 'storybloom-reading-pos:'
/** Band is inflated 2px vertically so it reads as a ruler, not a tight box. */
const BAND_INFLATE_PX = 2

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

/**
 * The guide's position and the pointer state machine (spec §6.9).
 *
 * Phase 1 handles tap-to-place, the line buttons and keyboard navigation.
 * Positioning is imperative — rAF plus `transform` — and React state is
 * committed only when the word index changes, debounced. Re-rendering 800
 * spans on every pointer event is the obvious wrong implementation.
 */
export function useReadingGuide({
  containerRef,
  model,
  isReady,
  preferences,
  tokens,
  storyId,
  onTurnOffGuide,
}: UseReadingGuideOptions): ReadingGuideApi {
  const guideOn = preferences.guideMode !== 'off'

  const bandRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLDivElement>(null)

  // The live position. React state lags this deliberately.
  const positionRef = useRef({ lineIndex: -1, wordIndex: -1 })
  const [committed, setCommitted] = useState({ lineIndex: -1, wordIndex: -1 })
  const [liveMessage, setLiveMessage] = useState('')

  const modelRef = useRef(model)
  modelRef.current = model

  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<{ lineIndex: number; wordIndex: number; animate: boolean } | null>(null)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredForRef = useRef<string | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  // ------------------------------------------------------------ positioning

  const flush = useCallback(() => {
    rafRef.current = null
    const pending = pendingRef.current
    if (!pending) return

    const currentModel = modelRef.current
    const line = currentModel.lines[pending.lineIndex]
    if (!line) return

    const band = bandRef.current
    if (band) {
      band.dataset.animate = pending.animate ? 'on' : 'off'
      // transform, not top: compositor-only, no layout.
      band.style.transform = `translateY(${line.top - BAND_INFLATE_PX}px)`
      band.style.height = `${line.bottom - line.top + BAND_INFLATE_PX * 2}px`
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

  /** Single entry point for every move. */
  const applyPosition = useCallback(
    (lineIndex: number, wordIndex: number, source: MoveSource) => {
      if (lineIndex < 0 || wordIndex < 0) return
      positionRef.current = { lineIndex, wordIndex }

      // No transition during an active drag: a band lagging under a moving
      // finger feels broken.
      scheduleFlush(lineIndex, wordIndex, source !== 'drag' && source !== 'restore')

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
    [scheduleFlush]
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

  // ------------------------------------------------- model change / restore

  // Reset when the story changes so we don't restore into the wrong text.
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
  }, [isReady, guideOn])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    }
  }, [])

  // ------------------------------------------------------------- pointer

  const placeFromPoint = useCallback(
    (clientX: number, clientY: number, source: MoveSource) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const hit = hitTest(
        modelRef.current,
        clientX - rect.left,
        clientY - rect.top
      )
      if (hit.lineIndex < 0) return
      applyPosition(hit.lineIndex, hit.wordIndex, source)
    },
    [containerRef, applyPosition]
  )

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    // Ignore secondary pointers entirely: a second finger mid-gesture is a
    // palm, not an instruction. Same defensive stance as KidButton.
    if (activePointerRef.current !== null) return
    activePointerRef.current = e.pointerId
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    // Deliberately NOT preventDefault: that would kill page scrolling.
  }, [])

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerId !== activePointerRef.current) return
      const start = pointerStartRef.current
      activePointerRef.current = null
      pointerStartRef.current = null
      if (!start) return

      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      // Anything that travelled was a scroll, and the browser already handled
      // it. Only a stationary press-and-lift places the guide.
      if (moved > DRAG_CANCEL_PX) return

      placeFromPoint(e.clientX, e.clientY, 'tap')
    },
    [placeFromPoint]
  )

  const handlePointerCancel = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerId !== activePointerRef.current) return
    activePointerRef.current = null
    pointerStartRef.current = null
  }, [])

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
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerCancel,
            onKeyDown: handleKeyDown,
            tabIndex: 0,
            'aria-label': 'Story text with reading guide',
          }
        : {},
    [guideOn, handlePointerDown, handlePointerUp, handlePointerCancel, handleKeyDown]
  )

  return {
    wordIndex: committed.wordIndex,
    lineIndex: committed.lineIndex,
    isReady: isReady && guideOn,
    bandRef,
    wordRef,
    surfaceHandlers,
    moveToWord,
    moveToLine,
    nextLine,
    previousLine,
    liveMessage,
  }
}
