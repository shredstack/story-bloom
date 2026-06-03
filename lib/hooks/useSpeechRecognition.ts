'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { SpeechRecognitionStatus } from '@/lib/types'
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder'

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

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
  // Continuous mode options
  continuous?: boolean           // Enable continuous listening (default: false)
  interimResults?: boolean       // Show words as they're recognized (default: false)
  onInterimResult?: (interim: string) => void  // Callback for interim results
}

interface UseSpeechRecognitionReturn {
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
 * Web Speech API implementation (Chrome/Edge desktop, Android WebView). This is
 * the original behavior, unchanged — including iOS-Safari abort retries and the
 * continuous/interim modes. `isSupported` reflects whether `webkitSpeechRecognition`
 * actually exists, which is FALSE in iOS WKWebView (the native shell).
 */
function useWebSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
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

      recognition.onstart = () => {
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
      recognitionRef.current?.abort()
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && status !== 'listening') {
      setError(null)
      setTranscript('')
      setInterimTranscript('')
      setFinalTranscript('')
      finalTranscriptRef.current = ''
      isListeningIntentRef.current = true
      abortRetryCountRef.current = 0
      try {
        recognitionRef.current.start()
      } catch {
        // Recognition might already be running
      }
    }
  }, [status])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      isListeningIntentRef.current = false
      if (listeningTimeoutRef.current) {
        clearTimeout(listeningTimeoutRef.current)
        listeningTimeoutRef.current = null
      }
      recognitionRef.current.stop()
      setStatus('idle')
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setFinalTranscript('')
    finalTranscriptRef.current = ''
    setStatus('idle')
    setError(null)
    isListeningIntentRef.current = false
  }, [])

  // For continuous mode: finalize and process the complete transcript
  const finishListening = useCallback(() => {
    if (recognitionRef.current) {
      isListeningIntentRef.current = false
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
  }, [interimTranscript])

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
 * Fallback implementation for platforms WITHOUT the Web Speech API — primarily
 * iOS WKWebView (the native StoryBloom shell), and any browser missing
 * `webkitSpeechRecognition`. It records audio with `useAudioRecorder` and POSTs it
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
 * keeps working. Picks the implementation by capability: native `webkitSpeechRecognition`
 * where it exists (Android WebView, desktop Chrome/Edge), and the Whisper-backed
 * audio-recorder fallback everywhere it doesn't (notably iOS WKWebView).
 *
 * Both internal hooks are invoked unconditionally (Rules of Hooks); only the
 * selected one is ever *started*, so the other stays inert.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const web = useWebSpeechRecognition(options)
  const recorder = useRecorderSpeechRecognition(options)
  return web.isSupported ? web : recorder
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
