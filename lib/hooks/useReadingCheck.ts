'use client'

import { useEffect, useRef } from 'react'
import {
  useSpeechRecognition,
  type UseSpeechRecognitionOptions,
  type UseSpeechRecognitionReturn,
} from '@/lib/hooks/useSpeechRecognition'
import {
  useAnswerCheckMode,
  type UseAnswerCheckModeReturn,
} from '@/lib/hooks/useAnswerCheckMode'
import {
  useGrownUpUnlock,
  type UseGrownUpUnlockReturn,
} from '@/lib/hooks/useGrownUpUnlock'

interface UseReadingCheckReturn {
  /** Unchanged speech-recognition API — games use it exactly as before. */
  speech: UseSpeechRecognitionReturn
  /** Which input this session is using, plus the mid-session escape hatch. */
  check: UseAnswerCheckModeReturn
  /** PIN state for the grown-up controls. */
  unlock: UseGrownUpUnlockReturn
}

/**
 * Everything a read-aloud game needs to judge an attempt: the microphone, the
 * grown-up alternative, and the lock in front of it.
 *
 * It exists to own one awkward wiring detail in a single place instead of three
 * game pages: `useAnswerCheckMode` needs to hear about speech failures, but it
 * can only be called *after* `useSpeechRecognition` (it depends on
 * `isSupported`). The ref below closes that loop without making either hook
 * know about the other.
 */
export function useReadingCheck(
  options: UseSpeechRecognitionOptions = {}
): UseReadingCheckReturn {
  const reportTroubleRef = useRef<() => void>(() => {})
  const optionsRef = useRef(options)
  optionsRef.current = options

  const speech = useSpeechRecognition({
    ...options,
    onError: (message) => {
      reportTroubleRef.current()
      optionsRef.current.onError?.(message)
    },
  })

  const check = useAnswerCheckMode({ speechSupported: speech.isSupported })
  const unlock = useGrownUpUnlock()

  useEffect(() => {
    reportTroubleRef.current = check.reportMicTrouble
  }, [check.reportMicTrouble])

  return { speech, check, unlock }
}
