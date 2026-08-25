'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpeechSynthesis } from '@/lib/hooks/useSpeechSynthesis'
import { useServerWordVoice } from '@/lib/hooks/useServerWordVoice'
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
  /** Kid-facing message when a word could not be spoken at all; null otherwise. */
  error: string | null
  sayWord: (token: WordToken | undefined) => void
}

/**
 * How long the device's own voice gets to actually start before we stop
 * believing it. A real engine fires `onstart` in well under 200ms; an engine
 * that isn't there never fires it at all and never reports an error either.
 */
const NATIVE_START_TIMEOUT_MS = 700

/**
 * `speechSynthesis.cancel()` — which every `speak()` calls first — raises these
 * on the utterance it replaced. They mean "superseded", not "broken".
 */
const BENIGN_SPEECH_ERRORS = new Set(['canceled', 'cancelled', 'interrupted'])

const FAILURE_MESSAGE = "This tablet couldn't say that word. Check the volume, or try again."

/** True only if the device has a voice it can actually speak with right now. */
function hasNativeVoices(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  try {
    return window.speechSynthesis.getVoices().length > 0
  } catch {
    return false
  }
}

/**
 * Tap-to-hear ONE word (spec §5.4).
 *
 * Never automatic. There is no read-along and no karaoke: she stays the
 * decoder, and this is a lifeline rather than a substitute. It speaks the word
 * only — never the sentence or the line.
 *
 * Two routes, in order of preference:
 *
 *  1. The device's own voice — free, instant, works offline.
 *  2. /api/speech/say — for devices where `speechSynthesis` exists but cannot
 *     speak. Amazon Fire tablets are the case that forced this: Fire OS ships
 *     no TTS engine, so `getVoices()` is `[]`, `speak()` returns cleanly, and
 *     absolutely nothing happens — no error, no event, a button that looks
 *     broken. iOS WKWebView fails the same way before its voices load.
 *
 * Route 1 failing is therefore SILENT by nature, so it is detected by timeout
 * rather than by an error, and the fallback is latched for the rest of the
 * session once it has happened.
 */
export function useWordSpeech({
  childId,
  enabled,
}: UseWordSpeechOptions): UseWordSpeechReturn {
  const [speakingWordIndex, setSpeakingWordIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  /** Latched to true once the device's own voice has proved it can't speak. */
  const useServerRef = useRef(false)
  const nativeStartedRef = useRef(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The word the current attempt is about, so a late failure can retry it. */
  const pendingWordRef = useRef<string | null>(null)

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    watchdogRef.current = null
  }, [])

  const { play: playAudio, unlock: unlockAudio } = useServerWordVoice({
    onEnd: () => setSpeakingWordIndex(-1),
    onError: () => {
      setSpeakingWordIndex(-1)
      setError(FAILURE_MESSAGE)
    },
  })

  const { speak, stop, isSupported } = useSpeechSynthesis({
    // Neutral, and slower than conversational: she is decoding, not listening
    // to a story.
    voice: { pitch: 1, rate: 0.8, volume: 1 },
    onStart: () => {
      nativeStartedRef.current = true
      clearWatchdog()
    },
    onEnd: () => setSpeakingWordIndex(-1),
    onError: (reason) => {
      if (BENIGN_SPEECH_ERRORS.has(reason)) return
      clearWatchdog()
      // A real error is the same verdict as the timeout, just faster.
      if (!nativeStartedRef.current) {
        useServerRef.current = true
        const word = pendingWordRef.current
        if (word) playAudio(word)
        return
      }
      setSpeakingWordIndex(-1)
    },
  })

  /**
   * Warm the voice list on mount rather than inside the tap. WKWebView reports
   * zero voices until `voiceschanged` fires, and awaiting that *during* the tap
   * (as this used to) burned the user-activation window Chromium requires for
   * `speechSynthesis.speak()` — the tap that mattered was the one that got
   * swallowed. By the time she taps a word, this has long since settled.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    // Merely calling this kicks off population on most engines.
    window.speechSynthesis.getVoices()
    const noop = () => {}
    window.speechSynthesis.addEventListener('voiceschanged', noop)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', noop)
  }, [])

  useEffect(() => clearWatchdog, [clearWatchdog])

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

      clearWatchdog()
      setError(null)
      setSpeakingWordIndex(token.index)
      pendingWordRef.current = spoken

      if (useServerRef.current || !hasNativeVoices()) {
        // No voice on this device — don't spend 700ms proving it every time.
        playAudio(spoken)
      } else {
        // Bless the audio element now, while we still have the gesture, in
        // case the watchdog below needs it after the gesture has expired.
        unlockAudio()

        nativeStartedRef.current = false
        speak(spoken)

        watchdogRef.current = setTimeout(() => {
          watchdogRef.current = null
          if (nativeStartedRef.current) return
          // It accepted the utterance and said nothing. Stop trusting it.
          useServerRef.current = true
          stop()
          playAudio(spoken)
        }, NATIVE_START_TIMEOUT_MS)
      }

      // Fire-and-forget: a failed count must never interrupt her reading.
      if (childId) {
        void fetch('/api/reading-word-taps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, word: token.normalized }),
        }).catch(() => {})
      }
    },
    [enabled, childId, clearWatchdog, playAudio, unlockAudio, speak, stop]
  )

  return { isSupported, speakingWordIndex, error, sayWord }
}
