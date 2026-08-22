'use client'

import { useCallback, useRef, useState } from 'react'
import { useSpeechSynthesis } from '@/lib/hooks/useSpeechSynthesis'
import { isTappable } from '@/lib/reading/tokenize'
import type { WordToken } from '@/lib/reading/types'

interface UseWordSpeechOptions {
  childId: string | undefined
  /** Mirrors preferences.tapToHearEnabled. */
  enabled: boolean
}

interface UseWordSpeechReturn {
  isSupported: boolean
  /** The word index currently being spoken, or -1. */
  speakingWordIndex: number
  sayWord: (token: WordToken | undefined) => void
}

/**
 * Tap-to-hear ONE word (spec §5.4).
 *
 * Never automatic. There is no read-along and no karaoke: she stays the
 * decoder, and this is a lifeline rather than a substitute. It speaks the word
 * only — never the sentence or the line.
 */
export function useWordSpeech({
  childId,
  enabled,
}: UseWordSpeechOptions): UseWordSpeechReturn {
  const [speakingWordIndex, setSpeakingWordIndex] = useState(-1)
  const voicesReadyRef = useRef(false)

  const { speak, isSupported } = useSpeechSynthesis({
    // Neutral, and slower than conversational: she is decoding, not listening
    // to a story.
    voice: { pitch: 1, rate: 0.8, volume: 1 },
    onEnd: () => setSpeakingWordIndex(-1),
    onError: () => setSpeakingWordIndex(-1),
  })

  /**
   * WKWebView frequently reports zero voices until `voiceschanged` fires, and
   * speaking before then picks the wrong voice or nothing at all. Awaited once.
   */
  const ensureVoices = useCallback(async () => {
    if (voicesReadyRef.current) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    if (window.speechSynthesis.getVoices().length > 0) {
      voicesReadyRef.current = true
      return
    }

    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.speechSynthesis.removeEventListener('voiceschanged', finish)
        resolve()
      }
      window.speechSynthesis.addEventListener('voiceschanged', finish)
      // Never hang: some platforms simply never fire the event.
      setTimeout(finish, 1000)
    })

    voicesReadyRef.current = true
  }, [])

  const sayWord = useCallback(
    (token: WordToken | undefined) => {
      if (!enabled || !token || !isTappable(token)) return

      // Speak the word as written, minus only the punctuation hanging off its
      // ends. `normalized` would say "wellknown" for "well-known", because it
      // exists to be a matching key, not a pronunciation.
      const spoken =
        token.raw.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, '') ||
        token.normalized
      if (!spoken) return

      setSpeakingWordIndex(token.index)

      void ensureVoices().then(() => {
        speak(spoken)
      })

      // Fire-and-forget: a failed count must never interrupt her reading.
      if (childId) {
        void fetch('/api/reading-word-taps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, word: token.normalized }),
        }).catch(() => {})
      }
    },
    [enabled, childId, ensureVoices, speak]
  )

  return { isSupported, speakingWordIndex, sayWord }
}
