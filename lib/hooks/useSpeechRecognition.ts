'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SpeechRecognitionStatus } from '@/lib/types'
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder'
import { isFireOSDevice } from '@/lib/utils/platform'

/**
 * How long to wait for `onstart` before deciding this browser's speech
 * recognition is a shell with nothing behind it. A working engine fires in well
 * under a second; the extra headroom is for slow tablets, and the cost of being
 * wrong is only that we transcribe on the server instead.
 *
 * Only used when the mic permission is known-granted, which is the one case
 * where `onstart` has nothing legitimate left to wait on.
 */
const RECOGNITION_START_TIMEOUT_MS = 3000

/**
 * The budget when we can't read the mic permission at all. Safari is the case
 * that matters: it supports `webkitSpeechRecognition` *and* refuses a
 * `microphone` permission query, so the state stays 'unknown' while its own
 * permission sheet is open. A grown-up hunting for the Allow button is not a
 * dead engine, and a 3s verdict would silently move the whole session onto paid
 * server transcription. Long budget here, and one timeout is never enough to
 * convict — see `startTimeoutStrikesRef`.
 */
const RECOGNITION_START_TIMEOUT_UNKNOWN_MS = 10000

/**
 * How many consecutive misses it takes to write a device off, per signal.
 * Anything that can be caused by a human or a passing wifi glitch needs two;
 * a browser that reports `service-not-allowed` is telling us about itself.
 */
const UNCERTAIN_SIGNAL_STRIKES = 2

/**
 * Recognition errors that mean "this device will never do speech recognition",
 * as opposed to "that attempt didn't work". Chromium forks without Google
 * services report `service-not-allowed` here forever.
 */
const FATAL_RECOGNITION_ERRORS = new Set([
  'service-not-allowed',
  'language-not-supported',
])

/**
 * `network` is the ambiguous one: a Chromium fork with no speech backend raises
 * it every single time, but so does a desktop browser whose wifi dropped for a
 * second. The fallback path POSTs to `/api/speech/transcribe` and needs that
 * same network, so latching on a hiccup trades a working implementation for one
 * that is equally broken. Requires `UNCERTAIN_SIGNAL_STRIKES` consecutive hits,
 * and only counts them while the browser believes it is online.
 */
const AMBIGUOUS_RECOGNITION_ERRORS = new Set(['network'])

/**
 * Slack between aborting recognition and asking for the mic again. Long enough
 * for the engine to let go of the device, short enough that a child mid-tap
 * reads it as the button being a beat slow.
 */
const MIC_HANDOFF_DELAY_MS = 150

// Web Speech API type definitions
interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEventInit extends EventInit {
  resultIndex?: number
  results: SpeechRecognitionResultList
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition
}

export interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
  // Continuous mode options
  continuous?: boolean           // Enable continuous listening (default: false)
  interimResults?: boolean       // Show words as they're recognized (default: false)
  onInterimResult?: (interim: string) => void  // Callback for interim results
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean
  status: SpeechRecognitionStatus
  transcript: string
  interimTranscript: string      // Current interim (unfinalized) text
  finalTranscript: string        // Accumulated finalized text
  startListening: () => void
  stopListening: () => void
  finishListening: () => void    // For continuous mode "Done" action
  resetTranscript: () => void
  error: string | null
}

/**
 * Why the web implementation was written off. Logged rather than shown: a latch
 * is invisible by design, so without this you can't tell "Fire OS detection is
 * working" from "we're paying for Whisper on a device that was fine".
 */
type SpeechUnavailableReason =
  | 'fire-os'
  | 'start-threw'
  | 'start-timeout'
  | `fatal:${string}`

interface WebSpeechOptions extends UseSpeechRecognitionOptions {
  /**
   * This device has `webkitSpeechRecognition` but it provably does not work —
   * it threw on start, never started, or failed fatally. The caller should stop
   * using this implementation for the rest of the session. `wasListening` is
   * true when a child was mid-tap, so the caller can hand the attempt on rather
   * than dropping it.
   */
  onUnavailable?: (wasListening: boolean, reason: SpeechUnavailableReason) => void
}

/**
 * Web Speech API implementation (Chrome/Edge desktop, Android WebView), for
 * devices where it genuinely works — including iOS-Safari abort retries and the
 * continuous/interim modes. `isSupported` reflects whether `webkitSpeechRecognition`
 * actually exists, which is FALSE in iOS WKWebView (the native shell).
 *
 * Existing is not the same as working, though: see `onUnavailable`.
 */
function useWebSpeechRecognition(
  options: WebSpeechOptions = {}
): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const abortRetryCountRef = useRef(0)
  const maxAbortRetries = 3
  const isListeningIntentRef = useRef(false)
  // Track accumulated final transcript for continuous mode (avoids stale closure issues)
  const finalTranscriptRef = useRef('')
  // Timeout to auto-stop listening if no result is received
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Watchdog for `onstart` — see RECOGNITION_START_TIMEOUT_MS
  const startWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Latched once this device has proved it can't do recognition at all. */
  const isUnavailableRef = useRef(false)
  /** Set by the setup effect, which owns the recognition object to abort. */
  const declareUnavailableRef = useRef<(reason: SpeechUnavailableReason) => void>(() => {})
  /** Mic permission state, so the watchdog never times an open prompt. */
  const micPermissionRef = useRef<PermissionState | 'unknown'>('unknown')
  /** Consecutive `onstart` misses; reset the moment recognition actually starts. */
  const startTimeoutStrikesRef = useRef(0)
  /** Consecutive `network` errors; reset by any successful start. */
  const networkErrorStrikesRef = useRef(0)

  const clearStartWatchdog = useCallback(() => {
    if (startWatchdogRef.current) {
      clearTimeout(startWatchdogRef.current)
      startWatchdogRef.current = null
    }
  }, [])

  // A pending permission prompt blocks `onstart` for as long as the grown-up
  // takes to tap Allow, which would look exactly like a dead engine. Track the
  // state so the watchdog can stand down while a decision is outstanding.
  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null
    let cancelled = false

    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (cancelled) return
        permissionStatus = result
        micPermissionRef.current = result.state
        result.onchange = () => {
          micPermissionRef.current = result.state
        }
      })
      // Not every browser exposes the microphone permission (Safari and Firefox
      // reject the query). 'unknown' is the safe read: the watchdog still arms,
      // but on the long budget and never on a single miss.
      .catch(() => {})

    return () => {
      cancelled = true
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [])

  useEffect(() => {
    // Access the Web Speech API from window
    const windowWithSpeech = window as Window & {
      SpeechRecognition?: ISpeechRecognitionConstructor
      webkitSpeechRecognition?: ISpeechRecognitionConstructor
    }

    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition
        : null

    setIsSupported(!!SpeechRecognitionAPI)

    // Detect iOS/iPadOS for retry behavior
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI()
      // Apply options - continuous and interimResults based on options
      recognition.continuous = optionsRef.current.continuous ?? false
      recognition.interimResults = optionsRef.current.interimResults ?? false
      recognition.lang = 'en-US'

      // Give up on this implementation for good and hand the attempt back. No
      // error is set: the caller has a working fallback, so the child should
      // see a mic that's a beat slow, not one that failed.
      const declareUnavailable = (reason: SpeechUnavailableReason) => {
        if (isUnavailableRef.current) return
        isUnavailableRef.current = true
        clearStartWatchdog()
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current)
          listeningTimeoutRef.current = null
        }

        const wasListening = isListeningIntentRef.current
        isListeningIntentRef.current = false
        try {
          recognition.abort()
        } catch {
          // Already dead — which is the whole reason we're here.
        }
        setStatus('idle')
        setError(null)
        optionsRef.current.onUnavailable?.(wasListening, reason)
      }
      declareUnavailableRef.current = declareUnavailable

      recognition.onstart = () => {
        clearStartWatchdog()
        // Recognition really started, so whatever the previous misses were —
        // an open permission sheet, a wifi blip — they weren't this device.
        startTimeoutStrikesRef.current = 0
        networkErrorStrikesRef.current = 0
        setStatus('listening')
        setError(null)
        abortRetryCountRef.current = 0

        // Auto-stop listening after 8 seconds if no result (prevents infinite blinking mic)
        if (!optionsRef.current.continuous) {
          if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current)
          listeningTimeoutRef.current = setTimeout(() => {
            if (isListeningIntentRef.current) {
              isListeningIntentRef.current = false
              recognition.stop()
              setError("I didn't hear anything. Try tapping the mic and saying the word again!")
              setStatus('idle')
            }
          }, 8000)
        }
      }

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        // Clear the listening timeout since we got a result
        if (listeningTimeoutRef.current) {
          clearTimeout(listeningTimeoutRef.current)
          listeningTimeoutRef.current = null
        }

        const isContinuousMode = optionsRef.current.continuous

        if (isContinuousMode) {
          // Continuous mode: accumulate final results, show interim
          let interim = ''
          let newFinal = ''

          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i]
            const text = result[0].transcript

            if (result.isFinal) {
              newFinal += text + ' '
            } else {
              interim += text
            }
          }

          // Update interim transcript (current unfinalized text)
          setInterimTranscript(interim)

          // Update final transcript if we got new final results
          if (newFinal) {
            finalTranscriptRef.current = newFinal.trim()
            setFinalTranscript(newFinal.trim())
          }

          // Call interim callback if provided
          if (interim && optionsRef.current.onInterimResult) {
            optionsRef.current.onInterimResult(interim)
          }
        } else {
          // Non-continuous mode: original behavior
          const result = event.results[event.results.length - 1]
          const text = result[0].transcript.trim().toLowerCase()
          setTranscript(text)
          setStatus('processing')
          isListeningIntentRef.current = false
          optionsRef.current.onResult?.(text)
        }
      }

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        // Everything after this point belongs to an implementation we've already
        // walked away from — including the 'aborted' that our own abort() raises.
        if (isUnavailableRef.current) return

        clearStartWatchdog()

        // No amount of retrying fixes a browser with no speech service behind
        // the API. Hand the attempt to the server-transcription path instead of
        // telling a six-year-old about the network.
        if (FATAL_RECOGNITION_ERRORS.has(event.error)) {
          declareUnavailable(`fatal:${event.error}`)
          return
        }

        // `network` only convicts on a repeat offence, and never while the
        // device knows it is offline — that's a wifi problem, not a device one,
        // and the fallback needs the network just as much.
        if (AMBIGUOUS_RECOGNITION_ERRORS.has(event.error)) {
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false
          if (!offline) {
            networkErrorStrikesRef.current += 1
            if (networkErrorStrikesRef.current >= UNCERTAIN_SIGNAL_STRIKES) {
              declareUnavailable(`fatal:${event.error}`)
              return
            }
          }
          // Otherwise fall through and report it as the transient error it
          // probably is, which is also what feeds the mic-trouble escalation.
        }

        // On iOS/iPadOS, auto-retry on 'aborted' errors (common issue with Safari)
        if (isIOS && event.error === 'aborted' && isListeningIntentRef.current) {
          if (abortRetryCountRef.current < maxAbortRetries) {
            abortRetryCountRef.current++
            // Small delay before retrying to let the system settle
            setTimeout(() => {
              if (isListeningIntentRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start()
                } catch {
                  // If retry fails, show error
                  setError(getErrorMessage(event.error))
                  setStatus('error')
                  isListeningIntentRef.current = false
                }
              }
            }, 100)
            return
          }
        }

        const errorMessage = getErrorMessage(event.error)
        setError(errorMessage)
        setStatus('error')
        isListeningIntentRef.current = false
        optionsRef.current.onError?.(errorMessage)
      }

      recognition.onend = () => {
        if (isUnavailableRef.current) return

        // In continuous mode, auto-restart if user still intends to listen
        if (optionsRef.current.continuous && isListeningIntentRef.current) {
          try {
            recognition.start()
          } catch {
            // Recognition might already be running, ignore
          }
        } else {
          setStatus((prevStatus) => {
            if (prevStatus === 'listening') {
              return 'idle'
            }
            return prevStatus
          })
        }
      }

      recognitionRef.current = recognition
    }

    return () => {
      isListeningIntentRef.current = false
      if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current)
      clearStartWatchdog()
      recognitionRef.current?.abort()
    }
  }, [clearStartWatchdog])

  const startListening = useCallback(() => {
    if (recognitionRef.current && status !== 'listening' && !isUnavailableRef.current) {
      setError(null)
      setTranscript('')
      setInterimTranscript('')
      setFinalTranscript('')
      finalTranscriptRef.current = ''
      isListeningIntentRef.current = true
      abortRetryCountRef.current = 0

      // Arm the watchdog before starting, so a start() that resolves to silence
      // is caught as well as one that throws. What a timeout *proves* depends
      // entirely on what we know about the mic permission:
      //
      //   'prompt'  — a sheet is open and the wait is the grown-up's. Not armed.
      //   'granted' — nothing legitimate left to wait on, so one miss convicts.
      //   'unknown' — the browser won't answer a permission query (Safari), so
      //               an invisible prompt may be open. Long budget, and it takes
      //               a second consecutive miss to write the device off.
      //
      // Getting that last case wrong is expensive and invisible: a slow tap
      // would move the rest of the session onto paid server transcription.
      clearStartWatchdog()
      const permission = micPermissionRef.current
      if (permission !== 'prompt') {
        const certain = permission === 'granted'
        startWatchdogRef.current = setTimeout(() => {
          startWatchdogRef.current = null
          startTimeoutStrikesRef.current += 1
          if (certain || startTimeoutStrikesRef.current >= UNCERTAIN_SIGNAL_STRIKES) {
            declareUnavailableRef.current('start-timeout')
          }
        }, certain ? RECOGNITION_START_TIMEOUT_MS : RECOGNITION_START_TIMEOUT_UNKNOWN_MS)
      }

      try {
        recognitionRef.current.start()
      } catch (err) {
        // `InvalidStateError` is the benign one: recognition is already running,
        // so `onstart` has fired and the watchdog can stand down. Anything else
        // is a browser that took the call and cannot honour it — which is how a
        // mic button ends up doing nothing at all, silently, forever.
        clearStartWatchdog()
        if ((err as DOMException)?.name !== 'InvalidStateError') {
          declareUnavailableRef.current('start-threw')
        }
      }
    }
  }, [status, clearStartWatchdog])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      isListeningIntentRef.current = false
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current)
        listeningTimeoutRef.current = null
      }
      clearStartWatchdog()
      recognitionRef.current.stop()
      setStatus('idle')
    }
  }, [clearStartWatchdog])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setFinalTranscript('')
    finalTranscriptRef.current = ''
    setStatus('idle')
    setError(null)
    isListeningIntentRef.current = false
    clearStartWatchdog()
  }, [clearStartWatchdog])

  // For continuous mode: finalize and process the complete transcript
  const finishListening = useCallback(() => {
    if (recognitionRef.current) {
      isListeningIntentRef.current = false
      clearStartWatchdog()
      recognitionRef.current.stop()

      // Combine final + interim for complete transcript
      const fullTranscript = (finalTranscriptRef.current + ' ' + interimTranscript).trim().toLowerCase()

      if (fullTranscript) {
        setTranscript(fullTranscript)
        setStatus('processing')
        // Fire the onResult callback with complete transcript
        optionsRef.current.onResult?.(fullTranscript)
      } else {
        // Nothing was recognized
        setError("I didn't hear anything. Try tapping the microphone and reading again!")
        setStatus('idle')
      }

      // Clear interim states
      setInterimTranscript('')
      setFinalTranscript('')
      finalTranscriptRef.current = ''
    }
  }, [interimTranscript, clearStartWatchdog])

  return {
    isSupported,
    status,
    transcript,
    interimTranscript,
    finalTranscript,
    startListening,
    stopListening,
    finishListening,
    resetTranscript,
    error,
  }
}

/**
 * Fallback implementation for platforms that can't use the Web Speech API —
 * iOS WKWebView (the native StoryBloom shell) and any browser missing
 * `webkitSpeechRecognition`, plus the browsers that *have* it and can't make it
 * work (Amazon Fire tablets). It records audio with `useAudioRecorder` and POSTs it
 * to `/api/speech/transcribe` (OpenAI Whisper), then surfaces the transcript
 * through the exact same `UseSpeechRecognitionReturn` contract.
 *
 * Behavioral mapping vs. Web Speech:
 *   - There's no on-device "end of speech" event, so the kid's "I'm done" signal
 *     (tapping the mic to stop, or "Done Reading") finalizes and transcribes. A
 *     max-duration safety auto-stops and transcribes too, so the mic never hangs.
 *   - `interimTranscript` is always empty (no streaming); `finalTranscript`
 *     mirrors the resolved `transcript`.
 */
function useRecorderSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const continuous = options.continuous ?? false

  const transcribe = useCallback(async (blob: Blob) => {
    setStatus('processing')
    try {
      const form = new FormData()
      // Filename extension hints the container to Whisper; webm/mp4 both accepted.
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      form.append('audio', blob, `speech.${ext}`)

      const res = await fetch('/api/speech/transcribe', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error(`transcribe failed: ${res.status}`)

      const data = (await res.json()) as { transcript?: string }
      const text = (data.transcript ?? '').trim().toLowerCase()

      if (text) {
        setTranscript(text)
        // Mirror the web impl: 'processing' while the caller's onResult runs.
        setStatus('processing')
        optionsRef.current.onResult?.(text)
      } else {
        setError("I didn't hear anything. Try tapping the microphone and reading again!")
        setStatus('idle')
      }
    } catch {
      const msg = 'Something went wrong. Please try again.'
      setError(msg)
      setStatus('error')
      optionsRef.current.onError?.(msg)
    }
  }, [])

  const {
    isSupported,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder({
    // Lenient windows so an uncoordinated kid never gets cut off mid-word.
    maxDurationMs: continuous ? 30000 : 8000,
    onRecordingComplete: (blob) => {
      void transcribe(blob)
    },
    onError: (msg) => {
      setError(msg)
      setStatus('error')
      optionsRef.current.onError?.(msg)
    },
  })

  const startListening = useCallback(() => {
    setError(null)
    setTranscript('')
    setStatus('listening')
    void startRecording()
  }, [startRecording])

  // Both stop and finish finalize the recording → transcription. (On a tablet
  // there's no silence-detection, so the kid's tap IS the "done" signal.)
  const stopListening = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  const finishListening = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setError(null)
    setStatus('idle')
    resetRecording()
  }, [resetRecording])

  return {
    isSupported,
    status,
    transcript,
    interimTranscript: '',
    finalTranscript: transcript,
    startListening,
    stopListening,
    finishListening,
    resetTranscript,
    error,
  }
}

/**
 * Public speech-recognition hook. Unchanged contract — every game's call site
 * keeps working. Picks the implementation by capability: native
 * `webkitSpeechRecognition` where it works (Android WebView, desktop
 * Chrome/Edge), and the Whisper-backed audio-recorder fallback everywhere else
 * (iOS WKWebView, Amazon Fire tablets).
 *
 * "Where it works" is doing real work in that sentence. Feature detection alone
 * used to decide this, and it is wrong on Fire OS: Silk is Chromium, so
 * `webkitSpeechRecognition` is defined, but Amazon ships no Google services, so
 * there is no speech backend behind it. The child taps the mic and *nothing
 * happens* — no result, no error, no state change. Same shape as the missing
 * TTS engine that `useWordSpeech` works around.
 *
 * So the choice has two additional inputs beyond `isSupported`, both latched for
 * the session once they fire:
 *
 *  1. The user agent, for Fire OS — known-bad devices skip the discovery cost
 *     entirely rather than spending the first tap on it.
 *  2. `onUnavailable` from the web implementation, for everything else that
 *     behaves this way: a start that throws, a start that never starts, or a
 *     fatal `service-not-allowed`. Signals a human or a flaky connection could
 *     have produced — a start timeout on a browser that hides its permission
 *     state, a lone `network` error — take two strikes first. The in-flight
 *     attempt is handed to the recorder rather than dropped, so the tap that
 *     discovered the problem still gets the child an answer.
 *
 * Both internal hooks are invoked unconditionally (Rules of Hooks); only the
 * selected one is ever *started*, so the other stays inert.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [webSpeechUsable, setWebSpeechUsable] = useState(true)
  // Kept current by an effect below, so the handoff always reaches the live
  // recorder without writing to a ref during render.
  const recorderRef = useRef<UseSpeechRecognitionReturn | null>(null)
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isFireOSDevice()) {
      console.warn('[speech] falling back to server transcription: fire-os')
      setWebSpeechUsable(false)
    }
  }, [])

  const handleUnavailable = useCallback(
    (wasListening: boolean, reason: SpeechUnavailableReason) => {
      console.warn(`[speech] falling back to server transcription: ${reason}`)
      setWebSpeechUsable(false)
      if (!wasListening) return

      // The recognition engine was just aborted and may not have released the
      // mic yet; on some Android/Fire WebViews an immediate `getUserMedia` loses
      // the race and the tap that found the problem dies with it. One tick of
      // slack costs the child nothing and avoids the contention entirely.
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current)
      handoffTimerRef.current = setTimeout(() => {
        handoffTimerRef.current = null
        recorderRef.current?.startListening()
      }, MIC_HANDOFF_DELAY_MS)
    },
    []
  )

  const web = useWebSpeechRecognition({
    ...options,
    onUnavailable: handleUnavailable,
  })
  const recorder = useRecorderSpeechRecognition(options)

  useEffect(() => {
    recorderRef.current = recorder
  })

  // A pending handoff must never start a microphone on a page the child has
  // already left.
  useEffect(() => {
    return () => {
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current)
    }
  }, [])

  return webSpeechUsable && web.isSupported ? web : recorder
}

/**
 * These are read by the child, not by a grown-up: `SpeechErrorNotice` puts them
 * on the game screen. So they say what happened and what to do about it in
 * words a six-year-old can decode, and hand anything needing a settings screen
 * to a grown-up rather than describing it.
 */
function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return "I didn't hear anything. Try again!"
    case 'audio-capture':
      return "I can't find the microphone. Ask a grown-up for help!"
    case 'not-allowed':
      return 'The microphone is turned off. Ask a grown-up to turn it on!'
    case 'network':
      return "I can't connect right now. Try again in a moment!"
    case 'aborted':
      return 'I stopped listening. Tap the microphone to try again!'
    default:
      return 'Something went wrong. Tap the microphone to try again!'
  }
}
