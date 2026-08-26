'use client'

import { useState, useCallback, useRef } from 'react'
import type { PracticeWord, PracticeSession, PracticeAttemptResult } from '@/lib/types'
import { isWordMatch } from '@/lib/utils/wordMatch'

interface UseWordQuestOptions {
  childId: string
  readingLevel: string
  wordsPerSession?: number
}

interface UseWordQuestReturn {
  words: PracticeWord[]
  currentWordIndex: number
  currentWord: PracticeWord | null
  sessionId: string | null
  isLoading: boolean
  error: string | null
  wordsCorrect: number
  totalAttempts: number
  isSessionComplete: boolean
  attempts: PracticeAttemptResult[]
  startSession: () => Promise<void>
  checkAnswer: (spokenText: string) => Promise<boolean>
  /** Record a verdict a grown-up gave instead of the microphone. */
  markAnswer: (correct: boolean) => Promise<boolean>
  skipWord: () => void
  endSession: () => Promise<PracticeSession | null>
}

const DEFAULT_WORDS_PER_SESSION = 10

export function useWordQuest(options: UseWordQuestOptions): UseWordQuestReturn {
  const {
    childId,
    readingLevel,
    wordsPerSession = DEFAULT_WORDS_PER_SESSION,
  } = options

  const [words, setWords] = useState<PracticeWord[]>([])
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wordsCorrect, setWordsCorrect] = useState(0)
  const [attempts, setAttempts] = useState<PracticeAttemptResult[]>([])

  const sessionStartTime = useRef<Date | null>(null)

  const currentWord = words[currentWordIndex] || null
  const isSessionComplete = currentWordIndex >= words.length && words.length > 0

  const startSession = useCallback(async () => {
    if (!childId || !readingLevel) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/word-quest/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          readingLevel,
          count: wordsPerSession,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch words')
      }

      const { words: fetchedWords, sessionId: newSessionId } = await response.json()

      setWords(fetchedWords)
      setSessionId(newSessionId)
      setCurrentWordIndex(0)
      setWordsCorrect(0)
      setAttempts([])
      sessionStartTime.current = new Date()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setIsLoading(false)
    }
  }, [childId, readingLevel, wordsPerSession])

  /**
   * The one place a word attempt is recorded, whether the microphone or a
   * grown-up produced the verdict.
   */
  const recordAttempt = useCallback(
    async (isCorrect: boolean, spokenText: string): Promise<boolean> => {
      if (!currentWord || !sessionId) return false

      const attempt: PracticeAttemptResult = {
        word: currentWord.word,
        spoken: spokenText,
        correct: isCorrect,
        timestamp: new Date(),
      }
      setAttempts((prev) => [...prev, attempt])

      if (isCorrect) {
        setWordsCorrect((prev) => prev + 1)
      }

      // Record progress via API (fire and forget)
      fetch('/api/word-quest/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          wordListId: currentWord.word_list_id,
          correct: isCorrect,
          sessionId,
        }),
      }).catch(console.error)

      // Advance to next word after recording progress
      setCurrentWordIndex((prev) => prev + 1)

      return isCorrect
    },
    [currentWord, childId, sessionId]
  )

  const checkAnswer = useCallback(
    (spokenText: string): Promise<boolean> => {
      if (!currentWord) return Promise.resolve(false)
      return recordAttempt(isWordMatch(spokenText, currentWord.word), spokenText)
    },
    [currentWord, recordAttempt]
  )

  // No transcript exists for a grown-up's verdict, so the attempt records none.
  const markAnswer = useCallback(
    (correct: boolean): Promise<boolean> => recordAttempt(correct, ''),
    [recordAttempt]
  )

  const skipWord = useCallback(() => {
    if (currentWord) {
      const attempt: PracticeAttemptResult = {
        word: currentWord.word,
        spoken: '',
        correct: false,
        timestamp: new Date(),
      }
      setAttempts((prev) => [...prev, attempt])
    }
    setCurrentWordIndex((prev) => prev + 1)
  }, [currentWord])

  const endSession = useCallback(async (): Promise<PracticeSession | null> => {
    if (!sessionId || !sessionStartTime.current) return null

    const duration = Math.round(
      (new Date().getTime() - sessionStartTime.current.getTime()) / 1000
    )

    try {
      const response = await fetch('/api/word-quest/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          wordsPracticed: attempts.length,
          wordsCorrect,
          durationSeconds: duration,
        }),
      })

      if (!response.ok) return null
      return response.json()
    } catch {
      return null
    }
  }, [sessionId, attempts.length, wordsCorrect])

  return {
    words,
    currentWordIndex,
    currentWord,
    sessionId,
    isLoading,
    error,
    wordsCorrect,
    totalAttempts: attempts.length,
    isSessionComplete,
    attempts,
    startSession,
    checkAnswer,
    markAnswer,
    skipWord,
    endSession,
  }
}

// Re-export isWordMatch for backward compatibility
export { isWordMatch } from '@/lib/utils/wordMatch'
