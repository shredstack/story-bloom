'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { PetType } from '@/lib/types'

export type SpeechSynthesisStatus = 'idle' | 'speaking' | 'paused' | 'error'

interface VoiceSettings {
  pitch: number // 0 to 2, 1 is normal
  rate: number // 0.1 to 10, 1 is normal
  volume: number // 0 to 1
  preferMale?: boolean // prefer a male voice for this pet type
}

// Fun voice settings for different pet types - higher pitch for smaller/cuter pets
const PET_VOICE_SETTINGS: Record<PetType, VoiceSettings> = {
  cat: { pitch: 1.4, rate: 0.95, volume: 1 },
  dog: { pitch: 1.2, rate: 1.0, volume: 1 },
  bunny: { pitch: 1.5, rate: 0.9, volume: 1 },
  bird: { pitch: 1.7, rate: 1.15, volume: 1 },
  fish: { pitch: 1.3, rate: 0.85, volume: 1 },
  bear: { pitch: 0.8, rate: 0.9, volume: 1, preferMale: true },
  dragon: { pitch: 0.7, rate: 1.0, volume: 1, preferMale: true },
  dinosaur: { pitch: 1.1, rate: 1.1, volume: 1, preferMale: true }, // energetic & fun, not slow
  unicorn: { pitch: 1.5, rate: 0.95, volume: 1 },
  butterfly: { pitch: 1.6, rate: 1.0, volume: 1 },
  axolotl: { pitch: 1.4, rate: 0.9, volume: 1 }, // bubbly and friendly
}

interface UseSpeechSynthesisOptions {
  petType?: PetType
  /**
   * Overrides the default (or pet) voice settings. Used by the reading guide,
   * which speaks a single word slowly and in a neutral voice — a pet voice
   * would turn a decoding aid into a character doing a bit.
   */
  voice?: Partial<VoiceSettings>
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
}

interface UseSpeechSynthesisReturn {
  isSupported: boolean
  status: SpeechSynthesisStatus
  speak: (text: string) => void
  stop: () => void
  pause: () => void
  resume: () => void
  isSpeaking: boolean
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [status, setStatus] = useState<SpeechSynthesisStatus>('idle')

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
    setIsSupported(supported)

    return () => {
      // Clean up any ongoing speech when component unmounts
      if (supported && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!isSupported || !text) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance

    // Apply pet-specific voice settings
    const petType = optionsRef.current.petType
    const base = petType
      ? PET_VOICE_SETTINGS[petType]
      : { pitch: 1.3, rate: 0.95, volume: 1 }
    const settings = { ...base, ...optionsRef.current.voice }

    utterance.pitch = settings.pitch
    utterance.rate = settings.rate
    utterance.volume = settings.volume
    utterance.lang = 'en-US'

    // Try to find a good voice based on pet preferences
    const voices = window.speechSynthesis.getVoices()
    const englishVoices = voices.filter(v => v.lang.startsWith('en'))

    let preferredVoice: SpeechSynthesisVoice | undefined

    if (settings.preferMale) {
      // For dinosaur/dragon/bear - find a male voice for more character
      preferredVoice = englishVoices.find(v => {
        const name = v.name.toLowerCase()
        return (
          name.includes('daniel') ||
          name.includes('alex') ||
          name.includes('fred') ||
          name.includes('ralph') ||
          name.includes('tom') ||
          name.includes('male')
        )
      })
    }

    // Fallback to female voices (good for most pets)
    if (!preferredVoice) {
      preferredVoice = englishVoices.find(v => {
        const name = v.name.toLowerCase()
        return (
          name.includes('samantha') ||
          name.includes('karen') ||
          name.includes('moira') ||
          name.includes('female')
        )
      }) || englishVoices[0]
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    utterance.onstart = () => {
      setStatus('speaking')
      optionsRef.current.onStart?.()
    }

    utterance.onend = () => {
      setStatus('idle')
      optionsRef.current.onEnd?.()
    }

    utterance.onerror = (event) => {
      setStatus('error')
      optionsRef.current.onError?.(event.error || 'Speech synthesis failed')
    }

    utterance.onpause = () => {
      setStatus('paused')
    }

    utterance.onresume = () => {
      setStatus('speaking')
    }

    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      setStatus('idle')
    }
  }, [isSupported])

  const pause = useCallback(() => {
    if (isSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
    }
  }, [isSupported])

  const resume = useCallback(() => {
    if (isSupported && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
  }, [isSupported])

  return {
    isSupported,
    status,
    speak,
    stop,
    pause,
    resume,
    isSpeaking: status === 'speaking',
  }
}
