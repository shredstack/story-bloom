'use client'

import { useState, useCallback, useEffect } from 'react'
import type { StrugglingWord, WordMasteryStage } from '@/lib/types'

interface UseStrugglingWordsOptions {
  childId: string
  autoFetch?: boolean
}

interface StrugglingWordsStats {
  total: number
  seedling: number
  growing: number
  blooming: number
  mastered: number
  /** How many words the parent has starred for upcoming sessions. */
  focused: number
}

const EMPTY_STATS: StrugglingWordsStats = {
  total: 0,
  seedling: 0,
  growing: 0,
  blooming: 0,
  mastered: 0,
  focused: 0,
}

/** Same counts the API returns, recomputed locally after an in-place edit. */
function computeStats(words: StrugglingWord[]): StrugglingWordsStats {
  return {
    total: words.length,
    seedling: words.filter((w) => w.current_stage === 'seedling').length,
    growing: words.filter((w) => w.current_stage === 'growing').length,
    blooming: words.filter((w) => w.current_stage === 'blooming').length,
    mastered: words.filter((w) => w.current_stage === 'mastered').length,
    focused: words.filter((w) => (w.focus_repeats || 0) > 0).length,
  }
}

interface UseStrugglingWordsReturn {
  words: StrugglingWord[]
  stats: StrugglingWordsStats
  isLoading: boolean
  error: string | null
  fetchWords: (stage?: WordMasteryStage) => Promise<void>
  addWord: (word: string) => Promise<{ success: boolean; alreadyExisted?: boolean }>
  addWords: (words: string[]) => Promise<{ added: number; existing: number; skipped: number }>
  deleteWord: (wordId: string) => Promise<boolean>
  /** Star a word for the next `repeats` sessions, or 0 to clear the star. */
  setWordFocus: (wordId: string, repeats: number) => Promise<boolean>
  refetch: () => Promise<void>
}

export function useStrugglingWords(
  options: UseStrugglingWordsOptions
): UseStrugglingWordsReturn {
  const { childId, autoFetch = true } = options

  const [words, setWords] = useState<StrugglingWord[]>([])
  const [stats, setStats] = useState<StrugglingWordsStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWords = useCallback(
    async (stage?: WordMasteryStage) => {
      if (!childId) return

      setIsLoading(true)
      setError(null)

      try {
        let url = `/api/struggling-words?childId=${childId}`
        if (stage) {
          url += `&stage=${stage}`
        }

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch words')
        }

        const { words: fetchedWords, stats: fetchedStats } = await response.json()
        setWords(fetchedWords || [])
        setStats(fetchedStats || EMPTY_STATS)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load words')
      } finally {
        setIsLoading(false)
      }
    },
    [childId]
  )

  const addWord = useCallback(
    async (word: string): Promise<{ success: boolean; alreadyExisted?: boolean }> => {
      if (!childId) return { success: false }

      try {
        const response = await fetch('/api/struggling-words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, word }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to add word')
        }

        const result = await response.json()

        // Refetch to get updated list
        await fetchWords()

        return { success: true, alreadyExisted: result.alreadyExisted }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add word')
        return { success: false }
      }
    },
    [childId, fetchWords]
  )

  const addWords = useCallback(
    async (
      wordsToAdd: string[]
    ): Promise<{ added: number; existing: number; skipped: number }> => {
      if (!childId) return { added: 0, existing: 0, skipped: 0 }

      try {
        const response = await fetch('/api/struggling-words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, words: wordsToAdd }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to add words')
        }

        const result = await response.json()

        // Refetch to get updated list
        await fetchWords()

        return {
          added: result.added || 0,
          existing: result.existing || 0,
          skipped: result.skipped || 0,
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add words')
        return { added: 0, existing: 0, skipped: 0 }
      }
    },
    [childId, fetchWords]
  )

  const deleteWord = useCallback(
    async (wordId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/struggling-words?id=${wordId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete word')
        }

        // Update local state
        setWords((prev) => prev.filter((w) => w.id !== wordId))
        setStats((prev) => {
          const deletedWord = words.find((w) => w.id === wordId)
          if (!deletedWord) return prev
          return {
            ...prev,
            total: prev.total - 1,
            [deletedWord.current_stage]: prev[deletedWord.current_stage] - 1,
          }
        })

        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete word')
        return false
      }
    },
    [words]
  )

  const setWordFocus = useCallback(
    async (wordId: string, repeats: number): Promise<boolean> => {
      try {
        const response = await fetch('/api/struggling-words', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordId, focusRepeats: repeats }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to update word')
        }

        // Take the server's row: starring a mastered word also moves its stage,
        // so guessing the new state locally would drift.
        const { word: updated } = await response.json()

        setWords((prev) => {
          const next = prev.map((w) => (w.id === wordId ? updated : w))
          setStats(computeStats(next))
          return next
        })

        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update word')
        return false
      }
    },
    []
  )

  const refetch = useCallback(() => fetchWords(), [fetchWords])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && childId) {
      fetchWords()
    }
  }, [autoFetch, childId, fetchWords])

  return {
    words,
    stats,
    isLoading,
    error,
    fetchWords,
    addWord,
    addWords,
    deleteWord,
    setWordFocus,
    refetch,
  }
}
