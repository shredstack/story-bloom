'use client'

import { useState, useCallback, useRef } from 'react'
import { isWordMatch } from './useWordQuest'
import {
  buildGrownUpWordResults,
  splitTargetWords,
} from '@/lib/games/grownupScoring'
import type {
  AttemptScoredBy,
  ReadingMaterial,
  MaterialSentence,
  SentencePracticeSession,
  SentenceAttemptResult,
  SentenceWordResult,
} from '@/lib/types'
import { SENTENCE_ACCURACY_THRESHOLD } from '@/lib/types'

interface UseSentenceShenanigansOptions {
  childId: string
}

interface UseSentenceShenanigansReturn {
  // Material management
  materials: ReadingMaterial[]
  isLoadingMaterials: boolean
  materialsError: string | null
  fetchMaterials: () => Promise<void>
  createMaterial: (
    name: string,
    sentences: { text: string; order: number; confidence?: number }[],
    description?: string,
    imageData?: string
  ) => Promise<ReadingMaterial | null>
  deleteMaterial: (materialId: string) => Promise<boolean>

  // Session state
  sentences: MaterialSentence[]
  currentSentenceIndex: number
  currentSentence: MaterialSentence | null
  sessionId: string | null
  isLoading: boolean
  error: string | null
  sentencesCorrect: number
  totalAttempts: number
  isSessionComplete: boolean
  attempts: SentenceAttemptResult[]
  currentMaterial: ReadingMaterial | null
  // Word-level stats
  totalWordsCorrect: number
  totalWordsAttempted: number

  // Actions
  startSession: (materialId: string) => Promise<void>
  checkSentence: (spokenText: string) => Promise<SentenceAttemptResult | null>
  /** Score the current sentence from a grown-up's word-by-word marking. */
  scoreSentenceByGrownUp: (
    missedPositions: number[]
  ) => Promise<SentenceAttemptResult | null>
  advanceToNextSentence: () => void
  skipSentence: () => void
  endSession: () => Promise<SentencePracticeSession | null>
}

/**
 * Common filler words and hesitation sounds that children make while reading.
 * These should be filtered out before alignment.
 */
const FILLER_WORDS = new Set([
  'um', 'uh', 'umm', 'uhh', 'erm', 'er', 'ah', 'ahh',
  'like', 'so', 'well', 'okay', 'ok',
  'hmm', 'hm', 'mm', 'mmm',
  'oh', 'ooh',
])

/**
 * Calculate the accuracy of a spoken sentence compared to the target sentence.
 * Uses word-level comparison with fuzzy matching from useWordQuest.
 * Enhanced for children's voices with filler word filtering and improved alignment.
 */
export function calculateSentenceAccuracy(
  spoken: string,
  target: string
): { accuracy: number; wordResults: SentenceWordResult[] } {
  // Normalize both strings
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s']/g, '') // Keep apostrophes for contractions
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Filter out filler words from spoken text (children often say "um", "uh", etc.)
  const filterFillers = (words: string[]): string[] => {
    return words.filter(w => !FILLER_WORDS.has(w.toLowerCase()))
  }

  const rawSpokenWords = normalizeText(spoken).split(/\s+/).filter(w => w.length > 0)
  const spokenWords = filterFillers(rawSpokenWords)
  // Shared with grown-up scoring, so `position` means the same thing whichever
  // route produced the result.
  const targetWords = splitTargetWords(target)

  if (targetWords.length === 0) {
    return { accuracy: 0, wordResults: [] }
  }

  const wordResults: SentenceWordResult[] = []
  let correctCount = 0

  // Use improved alignment to handle insertions/deletions/substitutions
  const alignment = alignWords(targetWords, spokenWords)

  for (let i = 0; i < targetWords.length; i++) {
    const targetWord = targetWords[i]
    const spokenWord = alignment[i]
    const correct = spokenWord !== null && isWordMatch(spokenWord, targetWord)

    if (correct) {
      correctCount++
    }

    wordResults.push({
      word: targetWord,
      spoken: spokenWord,
      correct,
      position: i,
    })
  }

  const accuracy = Math.round((correctCount / targetWords.length) * 100)

  return { accuracy, wordResults }
}

/**
 * Align spoken words to target words, handling insertions and deletions.
 * Returns an array of spoken words aligned to target word positions.
 *
 * Enhanced algorithm for children's speech:
 * - Handles word repetitions (stuttering: "the the dog")
 * - Handles skipped words gracefully
 * - Uses fuzzy matching with lookahead to find best alignment
 * - Looks further ahead when words might be out of order
 */
function alignWords(target: string[], spoken: string[]): (string | null)[] {
  const result: (string | null)[] = new Array(target.length).fill(null)

  if (spoken.length === 0) {
    return result
  }

  let spokenIndex = 0

  for (let i = 0; i < target.length; i++) {
    if (spokenIndex >= spoken.length) {
      // No more spoken words to align
      break
    }

    // Look ahead for a match within next 3 spoken words (increased from 2)
    // This helps when children repeat words or add extra words
    let foundMatch = false
    const lookaheadLimit = Math.min(3, spoken.length - spokenIndex)

    for (let j = 0; j < lookaheadLimit; j++) {
      const candidateWord = spoken[spokenIndex + j]

      if (isWordMatch(candidateWord, target[i])) {
        result[i] = candidateWord
        spokenIndex = spokenIndex + j + 1
        foundMatch = true
        break
      }
    }

    // If no match in immediate lookahead, check if current spoken word
    // matches any upcoming target word (child might have skipped ahead)
    if (!foundMatch) {
      const currentSpoken = spoken[spokenIndex]
      let matchesLaterTarget = false

      // Check if current spoken word matches a target word we haven't reached yet
      for (let k = i + 1; k < Math.min(i + 3, target.length); k++) {
        if (isWordMatch(currentSpoken, target[k])) {
          matchesLaterTarget = true
          break
        }
      }

      // If the current spoken word matches a later target, don't consume it
      // for this position - leave it for when we reach that target word
      if (!matchesLaterTarget) {
        // Assign current spoken word to this position even if it doesn't match
        // This gives the fuzzy matcher a chance to evaluate it
        result[i] = currentSpoken
        spokenIndex++
      }
      // If it matches a later target, we leave this position null (skipped)
      // and don't advance spokenIndex so we can use it later
    }
  }

  return result
}

export function useSentenceShenanigans(
  options: UseSentenceShenanigansOptions
): UseSentenceShenanigansReturn {
  const { childId } = options

  // Material management state
  const [materials, setMaterials] = useState<ReadingMaterial[]>([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [materialsError, setMaterialsError] = useState<string | null>(null)

  // Session state
  const [sentences, setSentences] = useState<MaterialSentence[]>([])
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentencesCorrect, setSentencesCorrect] = useState(0)
  const [attempts, setAttempts] = useState<SentenceAttemptResult[]>([])
  const [currentMaterial, setCurrentMaterial] = useState<ReadingMaterial | null>(null)
  // Word-level stats
  const [totalWordsCorrect, setTotalWordsCorrect] = useState(0)
  const [totalWordsAttempted, setTotalWordsAttempted] = useState(0)

  const sessionStartTime = useRef<Date | null>(null)

  const currentSentence = sentences[currentSentenceIndex] || null
  const isSessionComplete =
    currentSentenceIndex >= sentences.length && sentences.length > 0

  // Fetch all materials for the child
  const fetchMaterials = useCallback(async () => {
    if (!childId) return

    setIsLoadingMaterials(true)
    setMaterialsError(null)

    try {
      const response = await fetch(
        `/api/sentence-shenanigans/materials?childId=${childId}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch materials')
      }

      const { materials: fetchedMaterials } = await response.json()
      setMaterials(fetchedMaterials || [])
    } catch (err) {
      setMaterialsError(err instanceof Error ? err.message : 'Failed to load materials')
    } finally {
      setIsLoadingMaterials(false)
    }
  }, [childId])

  // Create a new material with sentences
  const createMaterial = useCallback(
    async (
      name: string,
      sentencesData: { text: string; order: number; confidence?: number }[],
      description?: string,
      imageData?: string
    ): Promise<ReadingMaterial | null> => {
      if (!childId) return null

      try {
        const response = await fetch('/api/sentence-shenanigans/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId,
            name,
            description,
            sentences: sentencesData,
            imageData,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create material')
        }

        const { material } = await response.json()

        // Add to local state
        setMaterials((prev) => [material, ...prev])

        return material
      } catch (err) {
        setMaterialsError(err instanceof Error ? err.message : 'Failed to create material')
        return null
      }
    },
    [childId]
  )

  // Delete a material
  const deleteMaterial = useCallback(
    async (materialId: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/sentence-shenanigans/materials/${materialId}`,
          { method: 'DELETE' }
        )

        if (!response.ok) {
          throw new Error('Failed to delete material')
        }

        // Remove from local state
        setMaterials((prev) => prev.filter((m) => m.id !== materialId))
        return true
      } catch (err) {
        setMaterialsError(err instanceof Error ? err.message : 'Failed to delete material')
        return false
      }
    },
    []
  )

  // Start a practice session for a specific material
  const startSession = useCallback(
    async (materialId: string) => {
      if (!childId) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/sentence-shenanigans/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, materialId }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to start session')
        }

        const { session, sentences: fetchedSentences, material } = await response.json()

        setSentences(fetchedSentences)
        setSessionId(session.id)
        setCurrentSentenceIndex(0)
        setSentencesCorrect(0)
        setAttempts([])
        setCurrentMaterial(material)
        setTotalWordsCorrect(0)
        setTotalWordsAttempted(0)
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
   * The one place an attempt is recorded, whether speech or a grown-up produced
   * it. Everything downstream — accuracy stats, XP, pet rewards, Word Rescue
   * capture — must not care which, so neither does this.
   */
  const recordAttempt = useCallback(
    async (params: {
      accuracy: number
      wordResults: SentenceWordResult[]
      spokenText: string | null
      scoredBy: AttemptScoredBy
    }): Promise<SentenceAttemptResult | null> => {
      if (!currentSentence || !sessionId) return null

      const { accuracy, wordResults, spokenText, scoredBy } = params
      const isCorrect = accuracy >= SENTENCE_ACCURACY_THRESHOLD

      const attempt: SentenceAttemptResult = {
        sentence: currentSentence.sentence_text,
        spoken: spokenText,
        accuracy,
        wordResults,
        correct: isCorrect,
        timestamp: new Date(),
        scoredBy,
      }

      setAttempts((prev) => [...prev, attempt])

      if (isCorrect) {
        setSentencesCorrect((prev) => prev + 1)
      }

      // Track word-level stats
      const wordsCorrectInAttempt = wordResults.filter((w) => w.correct).length
      setTotalWordsCorrect((prev) => prev + wordsCorrectInAttempt)
      setTotalWordsAttempted((prev) => prev + wordResults.length)

      // Record attempt via API (fire and forget)
      fetch(`/api/sentence-shenanigans/sessions/${sessionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentenceId: currentSentence.id,
          spokenText,
          accuracy,
          wordResults,
          isCorrect,
          scoredBy,
        }),
      }).catch(console.error)

      // Capture struggling words (incorrect words) for Word Rescue (fire and forget)
      const incorrectWords = wordResults
        .filter((w) => !w.correct && w.word.length > 2)
        .map((w) => ({
          word: w.word,
          sentenceId: currentSentence.id,
        }))

      if (incorrectWords.length > 0) {
        fetch('/api/word-rescue/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId,
            words: incorrectWords,
          }),
        }).catch(console.error)
      }

      // Note: Do NOT advance sentence here - let the caller control when to advance
      // so they can show feedback for the current sentence first

      return attempt
    },
    [currentSentence, sessionId, childId]
  )

  // Check a spoken sentence against the current sentence
  const checkSentence = useCallback(
    async (spokenText: string): Promise<SentenceAttemptResult | null> => {
      if (!currentSentence) return null

      const { accuracy, wordResults } = calculateSentenceAccuracy(
        spokenText,
        currentSentence.sentence_text
      )

      return recordAttempt({
        accuracy,
        wordResults,
        spokenText,
        scoredBy: 'speech',
      })
    },
    [currentSentence, recordAttempt]
  )

  // Score the current sentence from the words a grown-up marked as missed.
  const scoreSentenceByGrownUp = useCallback(
    async (missedPositions: number[]): Promise<SentenceAttemptResult | null> => {
      if (!currentSentence) return null

      const { accuracy, wordResults } = buildGrownUpWordResults(
        currentSentence.sentence_text,
        missedPositions
      )

      return recordAttempt({
        accuracy,
        wordResults,
        spokenText: null,
        scoredBy: 'grownup',
      })
    },
    [currentSentence, recordAttempt]
  )

  // Advance to the next sentence (called by UI after showing feedback)
  const advanceToNextSentence = useCallback(() => {
    setCurrentSentenceIndex((prev) => prev + 1)
  }, [])

  // Skip the current sentence
  const skipSentence = useCallback(() => {
    if (currentSentence) {
      const attempt: SentenceAttemptResult = {
        sentence: currentSentence.sentence_text,
        spoken: null,
        accuracy: 0,
        wordResults: [],
        correct: false,
        timestamp: new Date(),
        scoredBy: 'speech',
      }
      setAttempts((prev) => [...prev, attempt])
    }
    setCurrentSentenceIndex((prev) => prev + 1)
  }, [currentSentence])

  // End the practice session
  const endSession = useCallback(async (): Promise<SentencePracticeSession | null> => {
    if (!sessionId || !sessionStartTime.current) return null

    const duration = Math.round(
      (new Date().getTime() - sessionStartTime.current.getTime()) / 1000
    )

    try {
      const response = await fetch(
        `/api/sentence-shenanigans/sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentencesPracticed: attempts.length,
            sentencesCorrect,
            durationSeconds: duration,
          }),
        }
      )

      if (!response.ok) return null
      return response.json()
    } catch {
      return null
    }
  }, [sessionId, attempts.length, sentencesCorrect])

  return {
    // Material management
    materials,
    isLoadingMaterials,
    materialsError,
    fetchMaterials,
    createMaterial,
    deleteMaterial,

    // Session state
    sentences,
    currentSentenceIndex,
    currentSentence,
    sessionId,
    isLoading,
    error,
    sentencesCorrect,
    totalAttempts: attempts.length,
    isSessionComplete,
    attempts,
    currentMaterial,
    // Word-level stats
    totalWordsCorrect,
    totalWordsAttempted,

    // Actions
    startSession,
    checkSentence,
    scoreSentenceByGrownUp,
    advanceToNextSentence,
    skipSentence,
    endSession,
  }
}
