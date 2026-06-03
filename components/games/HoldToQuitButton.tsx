'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { tapHaptic, successHaptic } from '@/lib/native/haptics'

interface HoldToQuitButtonProps {
  /** Called once the hold completes — typically opens the QuitGameDialog. */
  onHoldComplete: () => void
  /** How long the kid must hold. Default 1200ms. */
  holdMs?: number
  label?: string
  /** Positioning/visibility classes (place it in a hard-to-reach corner). */
  className?: string
}

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Press-and-hold "Quit" control (§B2). Replacing tap-to-quit with a deliberate
 * hold (+ a filling progress ring) means a stray tap can't end the game; the kid
 * has to mean it. Intentionally small and visually quiet — quieter than the play
 * buttons — and meant to live in a hard-to-reach top corner.
 *
 * On completion it calls `onHoldComplete`, which should open the shared
 * QuitGameDialog (the existing confirm) rather than quitting outright.
 */
export function HoldToQuitButton({
  onHoldComplete,
  holdMs = 1200,
  label = 'Quit',
  className = '',
}: HoldToQuitButtonProps) {
  const [progress, setProgress] = useState(0) // 0..1
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const completedRef = useRef(false)

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setProgress(0)
  }, [])

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current
    const p = Math.min(1, elapsed / holdMs)
    setProgress(p)
    if (p >= 1) {
      if (!completedRef.current) {
        completedRef.current = true
        successHaptic()
        stop()
        onHoldComplete()
      }
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [holdMs, onHoldComplete, stop])

  const start = useCallback(() => {
    completedRef.current = false
    startRef.current = performance.now()
    tapHaptic()
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  useEffect(() => stop, [stop]) // cleanup on unmount

  return (
    <button
      type="button"
      aria-label={`Hold to ${label.toLowerCase()}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className={`
        relative flex flex-col items-center justify-center
        w-16 h-16 rounded-full select-none touch-manipulation
        text-gray-400 hover:text-gray-600 transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
        ${className}
      `}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-20"
        />
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="text-red-500 transition-[stroke-dashoffset] duration-75"
        />
      </svg>
      <span className="text-base leading-none" aria-hidden>
        ✕
      </span>
      <span className="text-[10px] font-semibold leading-none mt-0.5">{label}</span>
    </button>
  )
}
