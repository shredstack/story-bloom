'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  StrugglingWord,
  Pet,
  WordRescueSession,
  WordRescueStats,
  WordCheckResult,
} from '@/lib/types'

interface UseWordRescueOptions {
  childId: string
}

interface UseWordRescueReturn {
  // Words
  words: StrugglingWord[]
  currentWordIndex: number
  currentWord: StrugglingWord | null

  // Session
  sessionId: string | null
  buddyPet: Pet | null

  // Stats
  stats: WordRescueStats

  // State
  isLoading: boolean
  error: string | null
  isSessionComplete: boolean

  // Actions
  startSession: (buddyPetId?: string) => Promise<void>
  checkWord: (spokenText: string, usedCoach?: boolean) => Promise<WordCheckResult | null>
  /** Record a verdict a grown-up gave instead of the microphone. */
  markWord: (correct: boolean, usedCoach?: boolean) => Promise<WordCheckResult | null>
  skipWord: () => void
  endSession: () => Promise<WordRescueSession | null>
  reset: () => void
}

export function useWordRescue({ childId }: UseWordRescueOptions): UseWordRescueReturn {
  const [words, setWords] = useState<StrugglingWord[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [buddyPet, setBuddyPet] = useState<Pet | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<WordRescueStats>({
    wordsRescued: 0,
    totalCoins: 0,
    totalGems: 0,
    totalStars: 0,
    cashEarned: 0,
    wordsMastered: 0,
  })

  const sessionStartTime = useRef<Date | null>(null)

  const currentWord = words[currentWordIndex] || null
  const isSessionComplete = currentWordIndex >= words.length && words.length > 0

  const startSession = useCallback(
    async (buddyPetId?: string) => {
      if (!childId) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/word-rescue/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, buddyPetId }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to start session')
        }

        const { session, words: fetchedWords, buddyPet: fetchedBuddyPet } =
          await response.json()

        setSessionId(session.id)
        setWords(fetchedWords)
        setBuddyPet(fetchedBuddyPet)
        setCurrentWordIndex(0)
        setStats({
          wordsRescued: 0,
          totalCoins: 0,
          totalGems: 0,
          totalStars: 0,
          cashEarned: 0,
          wordsMastered: 0,
        })
        sessionStartTime.current = new Date()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start session')
      } finally {
        setIsLoading(false)
      }
    },
    [childId]
  )

  /**
   * The one path an attempt takes to the server, whether the microphone or a
   * grown-up decided it. The server still owns rewards and mastery either way —
   * only the verdict's origin differs.
   */
  const submitAttempt = useCallback(
    async (payload: {
      spokenText?: string
      grownUpCorrect?: boolean
      usedCoach: boolean
    }): Promise<WordCheckResult | null> => {
      if (!currentWord || !sessionId) return null

      try {
        const response = await fetch(`/api/word-rescue/sessions/${sessionId}/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strugglingWordId: currentWord.id,
            usedCoach: payload.usedCoach,
            ...(payload.grownUpCorrect === undefined
              ? { spokenText: payload.spokenText, scoredBy: 'speech' }
              : { isCorrect: payload.grownUpCorrect, scoredBy: 'grownup' }),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to check word')
        }

        const result: WordCheckResult = await response.json()

        if (result.correct) {
          setStats((prev) => ({
            ...prev,
            wordsRescued: prev.wordsRescued + 1,
            totalCoins: prev.totalCoins + result.coinsEarned,
            totalGems: prev.totalGems + (result.isMastered ? 1 : 0),
            totalStars: prev.totalStars + (result.isMastered ? 1 : 0),
            cashEarned: prev.cashEarned + result.cashEarned,
            wordsMastered: prev.wordsMastered + (result.isMastered ? 1 : 0),
          }))
        }

        return result
      } catch {
        // Don't set fatal error for transient network failures during word checks.
        // Return a non-fatal failure so the game can continue.
        return null
      }
    },
    [currentWord, sessionId]
  )

  const checkWord = useCallback(
    (spokenText: string, usedCoach = false) =>
      submitAttempt({ spokenText, usedCoach }),
    [submitAttempt]
  )

  const markWord = useCallback(
    (correct: boolean, usedCoach = false) =>
      submitAttempt({ grownUpCorrect: correct, usedCoach }),
    [submitAttempt]
  )

  const skipWord = useCallback(() => {
    setCurrentWordIndex((prev) => prev + 1)
  }, [])

  const endSession = useCallback(async (): Promise<WordRescueSession | null> => {
    if (!sessionId) return null

    const durationSeconds = sessionStartTime.current
      ? Math.round((new Date().getTime() - sessionStartTime.current.getTime()) / 1000)
      : null

    try {
      const response = await fetch(`/api/word-rescue/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds }),
      })

      if (!response.ok) return null

      const { session } = await response.json()
      return session
    } catch {
      return null
    }
  }, [sessionId])

  const reset = useCallback(() => {
    setWords([])
    setCurrentWordIndex(0)
    setSessionId(null)
    setBuddyPet(null)
    setError(null)
    setStats({
      wordsRescued: 0,
      totalCoins: 0,
      totalGems: 0,
      totalStars: 0,
      cashEarned: 0,
      wordsMastered: 0,
    })
    sessionStartTime.current = null
  }, [])

  return {
    words,
    currentWordIndex,
    currentWord,
    sessionId,
    buddyPet,
    stats,
    isLoading,
    error,
    isSessionComplete,
    startSession,
    checkWord,
    markWord,
    skipWord,
    endSession,
    reset,
  }
}
