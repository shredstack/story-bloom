'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchAppSettings } from '@/lib/api/appSettingsClient'
import {
  isPinVerified,
  markPinVerified,
  clearPinVerification,
} from '@/components/parent/ParentPinGate'

export interface UseGrownUpUnlockReturn {
  /** True until we know whether a PIN exists. */
  isLoading: boolean
  /** A parent PIN is configured on this account. */
  hasPin: boolean
  /** The grown-up controls may be used right now. */
  isUnlocked: boolean
  /** True while the PIN prompt should be on screen. */
  isPrompting: boolean
  /** Open the PIN prompt (no-op, auto-unlocks, when no PIN is set). */
  requestUnlock: () => void
  /** The PIN prompt succeeded. */
  confirmUnlock: () => void
  /** The PIN prompt was dismissed. */
  cancelUnlock: () => void
  /** Hide the controls again — for stepping away mid-session. */
  lock: () => void
}

/**
 * Gates the grown-up scoring controls behind the parent PIN.
 *
 * The threat model is small and specific: a child alone with the tablet tapping
 * "correct" for every word. It is not an attacker — so this reuses the PIN the
 * app already has, unlocks once for the whole browser session (the same
 * `sessionStorage` flag `ParentPinGate` sets, so a parent who just came from
 * settings isn't asked twice), and never interrupts a word-by-word rhythm with
 * a prompt.
 *
 * With no PIN configured the controls are simply open. Locking a family out of
 * the only working input on their device would be worse than the thing being
 * prevented; the games nudge toward setting a PIN instead.
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
    if (!hasPin) {
      setVerified(true)
      return
    }
    setIsPrompting(true)
  }, [hasPin])

  const confirmUnlock = useCallback(() => {
    markPinVerified()
    setIsPrompting(false)
    setVerified(true)
  }, [])

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
    isUnlocked: !hasPin || verified,
    isPrompting,
    requestUnlock,
    confirmUnlock,
    cancelUnlock,
    lock,
  }
}
