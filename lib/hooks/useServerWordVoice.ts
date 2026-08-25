'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Plays a single word from /api/speech/say — the fallback for devices whose own
 * `speechSynthesis` is present but mute (Fire tablets ship no TTS engine; iOS
 * WKWebView has no voices early in page life).
 *
 * PURE PLAYBACK: it decides nothing about *when* to fall back. `useWordSpeech`
 * owns that policy; this hook owns one `<audio>` element and the autoplay
 * dance around it.
 *
 * Not to be confused with `useWordAudio`, which uploads a parent's own voice
 * recording for a struggling word — a different feature entirely.
 */

/**
 * 44-byte silent WAV. Chromium only allows a programmatic `play()` on an
 * element that has already played once from inside a real user gesture, and our
 * fallback fires ~700ms after the tap — too late to still be "in" the gesture.
 * So we play this instead, during the tap, purely to bless the element.
 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

interface UseServerWordVoiceOptions {
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
}

interface UseServerWordVoiceReturn {
  /**
   * Call inside a user gesture on the path where playback MIGHT be needed
   * later. Idempotent and inaudible.
   */
  unlock: () => void
  /** Speak one word. Failures surface through `onError`, never as a throw. */
  play: (word: string) => void
  stop: () => void
}

export function useServerWordVoice(
  options: UseServerWordVoiceOptions = {}
): UseServerWordVoiceReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const unlockedRef = useRef(false)
  /** Set while the silent unlock clip is loaded, so its events aren't reported. */
  const silentRef = useRef(false)

  const optionsRef = useRef(options)
  optionsRef.current = options

  const getElement = useCallback((): HTMLAudioElement | null => {
    if (audioRef.current) return audioRef.current
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null

    const element = new Audio()
    element.preload = 'auto'
    element.addEventListener('playing', () => {
      if (!silentRef.current) optionsRef.current.onStart?.()
    })
    element.addEventListener('ended', () => {
      if (!silentRef.current) optionsRef.current.onEnd?.()
    })
    // Fires for a 4xx/5xx from the route, a decode failure, or no network.
    element.addEventListener('error', () => {
      if (!silentRef.current) optionsRef.current.onError?.()
    })

    audioRef.current = element
    return element
  }, [])

  const unlock = useCallback(() => {
    if (unlockedRef.current) return
    const element = getElement()
    if (!element) return

    unlockedRef.current = true
    silentRef.current = true
    element.src = SILENT_WAV
    void element.play().catch(() => {
      // Blocked anyway — `play()` below will try again and report honestly.
    })
  }, [getElement])

  const play = useCallback(
    (word: string) => {
      const element = getElement()
      if (!element) {
        optionsRef.current.onError?.()
        return
      }

      // A gesture-initiated play is itself the unlock.
      unlockedRef.current = true
      silentRef.current = false

      element.src = `/api/speech/say?word=${encodeURIComponent(word)}`
      const started = element.play()
      if (started) {
        void started.catch(() => optionsRef.current.onError?.())
      }
    },
    [getElement]
  )

  const stop = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  // Don't leave a word talking over the next page.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  return { unlock, play, stop }
}
