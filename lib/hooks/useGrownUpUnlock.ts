'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchAppSettings } from '@/lib/api/appSettingsClient'
import {
  isPinVerified,
  markPinVerified,
  clearPinVerification,
} from '@/components/parent/ParentPinGate'

/** Which challenge stands between the child and the scoring buttons. */
export type GrownUpChallenge = 'pin' | 'math'

export interface UseGrownUpUnlockReturn {
  /** True until we know whether a PIN exists. */
  isLoading: boolean
  /** A parent PIN is configured on this account. */
  hasPin: boolean
  /** Which prompt `requestUnlock` will raise. */
  challenge: GrownUpChallenge
  /** The grown-up controls may be used right now. */
  isUnlocked: boolean
  /** True while the unlock prompt should be on screen. */
  isPrompting: boolean
  /** Open the unlock prompt. */
  requestUnlock: () => void
  /** The prompt succeeded. */
  confirmUnlock: () => void
  /** The prompt was dismissed. */
  cancelUnlock: () => void
  /** Hide the controls again — for stepping away mid-session. */
  lock: () => void
}

/**
 * Gates the grown-up scoring controls.
 *
 * The threat model is small and specific: a child alone with the tablet tapping
 * "correct" for every word. It is not an attacker — so this unlocks once for the
 * whole browser session and never interrupts a word-by-word rhythm with a
 * prompt.
 *
 * Two challenges, because the controls are on screen in every game and "no PIN
 * means no gate" would leave a tap-to-win button under every word:
 *
 *  - **PIN**, when the account has one. Reuses the same `sessionStorage` flag
 *    `ParentPinGate` sets, so a parent arriving from settings isn't asked twice.
 *  - **Multiplication**, when it doesn't. Nothing to set up, comfortably past an
 *    early reader, three seconds for an adult. Never a hard "no" — locking a
 *    family out of the only working input on their device would be worse than
 *    the thing being prevented.
 */
export function useGrownUpUnlock(): UseGrownUpUnlockReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [verified, setVerified] = useState(false)
  const [isPrompting, setIsPrompting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkPin() {
      // A null result (offline, failing) is treated as "no PIN" — see the note
      // above about never locking a family out of their only working input.
      const settings = await fetchAppSettings()
      if (cancelled) return
      setHasPin(!!settings?.has_parent_pin)
      setIsLoading(false)
    }

    setVerified(isPinVerified())
    checkPin()
    return () => {
      cancelled = true
    }
  }, [])

  const requestUnlock = useCallback(() => {
    setIsPrompting(true)
  }, [])

  const confirmUnlock = useCallback(() => {
    // Only a real PIN entry may unlock the parent area; clearing the math gate
    // buys the scoring buttons and nothing else.
    if (hasPin) markPinVerified()
    setIsPrompting(false)
    setVerified(true)
  }, [hasPin])

  const cancelUnlock = useCallback(() => {
    setIsPrompting(false)
  }, [])

  const lock = useCallback(() => {
    // Clears the shared flag too: "lock" means the grown-up is stepping away,
    // and leaving parent settings open behind them would defeat the point.
    clearPinVerification()
    setVerified(false)
  }, [])

  return {
    isLoading,
    hasPin,
    challenge: hasPin ? 'pin' : 'math',
    isUnlocked: verified,
    isPrompting,
    requestUnlock,
    confirmUnlock,
    cancelUnlock,
    lock,
  }
}
