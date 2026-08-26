'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAppSettings } from '@/lib/api/appSettingsClient'
import type { AnswerCheckMode } from '@/lib/types'
import { DEFAULT_APP_SETTINGS, normalizeAnswerCheckMode } from '@/lib/types'

interface UseAnswerCheckModeOptions {
  /**
   * Whether speech recognition exists on this device, from
   * `useSpeechRecognition().isSupported`.
   */
  speechSupported: boolean
}

export interface UseAnswerCheckModeReturn {
  /** True until the saved preference has been read. */
  isLoading: boolean
  /** What the parent chose in settings. */
  savedMode: AnswerCheckMode
  /** What this session is actually doing, after fallbacks and overrides. */
  mode: AnswerCheckMode
  /**
   * Show the microphone controls. The grown-up controls have no equivalent
   * flag — they are always shown, which is the whole point of them.
   */
  micEnabled: boolean
  /** The device forced the switch — no mic exists here. */
  autoFellBack: boolean
  /** The mic exists but keeps failing; worth offering the grown-up route. */
  micTrouble: boolean
  /** Call from the speech hook's `onError`. Two strikes raises `micTrouble`. */
  reportMicTrouble: () => void
  /** Stop offering the switch for this session (the parent said no thanks). */
  dismissMicTrouble: () => void
  /**
   * Hand scoring to a grown-up for the rest of this session. `persist` also
   * saves it as the parent's default so the next game starts that way.
   */
  switchToGrownUp: (persist?: boolean) => void
}

/** Consecutive-ish speech failures before we offer a way out. */
const MIC_TROUBLE_THRESHOLD = 2

/**
 * Decides whether the current game session offers the microphone.
 *
 * The grown-up check is never in question — every game renders it, always. This
 * hook only decides whether the mic appears next to it, from three inputs in
 * increasing priority:
 *
 *  1. The saved `answer_check_mode` preference.
 *  2. The device — with no speech recognition at all the mic button would do
 *     nothing, so it is hidden. (This is also what replaced the old "Browser
 *     Not Supported" screens, which used to end the game before it started.)
 *  3. An in-game override, for the case that actually bites on an Amazon Fire
 *     tablet: recognition *exists*, so nothing looks broken, it just mishears
 *     or times out. `reportMicTrouble` counts those failures and `micTrouble`
 *     offers to put the mic away for good.
 */
export function useAnswerCheckMode({
  speechSupported,
}: UseAnswerCheckModeOptions): UseAnswerCheckModeReturn {
  const [savedMode, setSavedMode] = useState<AnswerCheckMode>(
    DEFAULT_APP_SETTINGS.answer_check_mode
  )
  const [isLoading, setIsLoading] = useState(true)
  const [sessionOverride, setSessionOverride] = useState<AnswerCheckMode | null>(
    null
  )
  const [failureCount, setFailureCount] = useState(0)
  const [troubleDismissed, setTroubleDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadMode() {
      // A null result means offline or failing — the microphone default is the
      // safe assumption, and the in-game switch is still there if it doesn't
      // work out.
      const settings = await fetchAppSettings()
      if (cancelled) return
      if (settings?.answer_check_mode) {
        setSavedMode(normalizeAnswerCheckMode(settings.answer_check_mode))
      }
      setIsLoading(false)
    }

    loadMode()
    return () => {
      cancelled = true
    }
  }, [])

  // `speechSupported` is false on the very first render of the speech hook (it
  // is set from an effect), so only trust it once the settings fetch has
  // resolved — a network round-trip is always later than an effect flush.
  const noMicOnDevice = !isLoading && !speechSupported

  const mode: AnswerCheckMode = useMemo(() => {
    if (sessionOverride) return sessionOverride
    if (noMicOnDevice) return 'grownup'
    return savedMode
  }, [sessionOverride, noMicOnDevice, savedMode])

  const micEnabled = mode !== 'grownup'

  const switchToGrownUp = useCallback((persist = false) => {
    setSessionOverride('grownup')
    setTroubleDismissed(true)

    if (persist) {
      setSavedMode('grownup')
      // Fire-and-forget: a failed save must not interrupt the session, and the
      // override already took effect locally.
      void fetch('/api/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer_check_mode: 'grownup' }),
      }).catch(() => {})
    }
  }, [])

  const reportMicTrouble = useCallback(() => {
    setFailureCount((prev) => prev + 1)
  }, [])

  const dismissMicTrouble = useCallback(() => {
    setTroubleDismissed(true)
    setFailureCount(0)
  }, [])

  return {
    isLoading,
    savedMode,
    mode,
    micEnabled,
    autoFellBack: noMicOnDevice && !sessionOverride,
    micTrouble:
      micEnabled &&
      !troubleDismissed &&
      failureCount >= MIC_TROUBLE_THRESHOLD,
    reportMicTrouble,
    dismissMicTrouble,
    switchToGrownUp,
  }
}
