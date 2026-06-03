'use client'

import { useState, useEffect, useCallback } from 'react'
import { REQUEST_QUIT_EVENT } from '@/lib/native/backButtonGuard'

interface UseQuitGuardReturn {
  /** Whether the QuitGameDialog should be open. */
  showConfirm: boolean
  /** Open the quit confirm (wire to HoldToQuitButton's onHoldComplete). */
  requestQuit: () => void
  /** Dismiss the confirm and stay in the game. */
  keepPlaying: () => void
}

/**
 * Centralizes the "should we show the quit confirm?" state for a game, and — while
 * `enabled` — listens for the native back-button's `storybloom:request-quit` event
 * so the Android back button opens the same QuitGameDialog instead of navigating
 * away. Keeps every game from re-implementing the listener (CLAUDE.md: no
 * per-game duplication).
 *
 * Pass `enabled: isPlaying` so the back button only triggers the confirm while a
 * game is actually in progress.
 */
export function useQuitGuard(enabled = true): UseQuitGuardReturn {
  const [showConfirm, setShowConfirm] = useState(false)

  const requestQuit = useCallback(() => setShowConfirm(true), [])
  const keepPlaying = useCallback(() => setShowConfirm(false), [])

  useEffect(() => {
    if (!enabled) return
    const handler = () => setShowConfirm(true)
    window.addEventListener(REQUEST_QUIT_EVENT, handler)
    return () => window.removeEventListener(REQUEST_QUIT_EVENT, handler)
  }, [enabled])

  return { showConfirm, requestQuit, keepPlaying }
}
