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
 * Never armed while a permission prompt is open — that wait is the grown-up's,
 * not the browser's.
 */
const RECOGNITION_START_TIMEOUT_MS = 3000

/**
 * Recognition errors that mean "this device will never do speech recognition",
 * as opposed to "that attempt didn't work". Chromium forks without Google
 * services report `network` or `service-not-allowed` here forever.
 */
const FATAL_RECOGNITION_ERRORS = new Set([
  'network',
  'service-not-allowed',
  'language-not-supported',
])

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

interface WebSpeechOptions extends UseSpeechRecognitionOptions {
  /**
   * This device has `webkitSpeechRecognition` but it provably does not work —
   * it threw on start, never started, or failed fatally. The caller should stop
   * using this implementation for the rest of the session. `wasListening` is
   * true when a child was mid-tap, so the caller can hand the attempt on rather
   * than dropping it.
   */
  onUnavailable?: (wasListening: boolean) => void
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
  const declareUnavailableRef = useRef<() => void>(() => {})
  /** Mic permission state, so the watchdog never times an open prompt. */
  const micPermissionRef = useRef<PermissionState | 'unknown'>('unknown')

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
      // Not every browser exposes the microphone permission (Firefox throws);
      // 'unknown' is the safe read and the watchdog stays armed.
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
      const declareUnavailable = () => {
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
        optionsRef.current.onUnavailable?.(wasListening)
      }
      declareUnavailableRef.current = declareUnavailable

      recognition.onstart = () => {
        clearStartWatchdog()
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
          declareUnavailable()
          return
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
      // is caught as well as one that throws. Skipped while a permission prompt
      // is open — `onstart` legitimately waits on a human there.
      clearStartWatchdog()
      if (micPermissionRef.current !== 'prompt') {
        startWatchdogRef.current = setTimeout(() => {
          startWatchdogRef.current = null
          declareUnavailableRef.current()
        }, RECOGNITION_START_TIMEOUT_MS)
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
          declareUnavailableRef.current()
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
 *     fatal `network` / `service-not-allowed`. The in-flight attempt is handed
 *     to the recorder rather than dropped, so the tap that discovered the
 *     problem still gets the child an answer.
 *
 * Both internal hooks are invoked unconditionally (Rules of Hooks); only the
 * selected one is ever *started*, so the other stays inert.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const [webSpeechUsable, setWebSpeechUsable] = useState(true)
  // Read during render so the handoff below always reaches the live recorder.
  const recorderRef = useRef<UseSpeechRecognitionReturn | null>(null)

  useEffect(() => {
    if (isFireOSDevice()) setWebSpeechUsable(false)
  }, [])

  const handleUnavailable = useCallback((wasListening: boolean) => {
    setWebSpeechUsable(false)
    if (wasListening) recorderRef.current?.startListening()
  }, [])

  const web = useWebSpeechRecognition({
    ...options,
    onUnavailable: handleUnavailable,
  })
  const recorder = useRecorderSpeechRecognition(options)
  recorderRef.current = recorder

  return webSpeechUsable && web.isSupported ? web : recorder
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return "I didn't hear anything. Try again!"
    case 'audio-capture':
      return 'Microphone not found. Please check your microphone.'
    case 'not-allowed':
      return 'Microphone access denied. Please allow microphone access.'
    case 'network':
      return 'Network error. Please check your connection.'
    case 'aborted':
      return 'Listening was cancelled.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
