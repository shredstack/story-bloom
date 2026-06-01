'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  ScavengerHuntPrompt,
  ScavengerLocation,
  ScavengerVerifyResult,
  ScavengerHuntStats,
} from '@/lib/types'

interface UseScavengerHuntOptions {
  childId: string
}

export interface HuntSummary {
  promptsFound: number
  promptsTotal: number
  findCash: number
  completionBonus: number
  totalCash: number
  weeklyCapReached: boolean
}

interface UseScavengerHuntReturn {
  prompts: ScavengerHuntPrompt[]
  currentIndex: number
  currentPrompt: ScavengerHuntPrompt | null
  sessionId: string | null
  stats: ScavengerHuntStats
  isLoading: boolean
  error: string | null
  isSessionComplete: boolean

  startSession: (locationSet: ScavengerLocation) => Promise<boolean>
  submitPhoto: (file: File) => Promise<ScavengerVerifyResult | null>
  skipPrompt: () => Promise<void>
  replacePrompt: () => Promise<boolean>
  advance: () => void
  completeSession: () => Promise<HuntSummary | null>
  reset: () => void
}

const emptyStats: ScavengerHuntStats = {
  promptsFound: 0,
  promptsAttempted: 0,
  promptsSkipped: 0,
  promptsReplaced: 0,
  findCashEarned: 0,
}

export function useScavengerHunt({
  childId,
}: UseScavengerHuntOptions): UseScavengerHuntReturn {
  const [prompts, setPrompts] = useState<ScavengerHuntPrompt[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [stats, setStats] = useState<ScavengerHuntStats>(emptyStats)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track which prompts the current prompt has matched so we don't re-pay / re-count.
  const matchedPromptIds = useRef<Set<string>>(new Set())

  const currentPrompt = prompts[currentIndex] || null
  const isSessionComplete = currentIndex >= prompts.length && prompts.length > 0

  const startSession = useCallback(
    async (locationSet: ScavengerLocation): Promise<boolean> => {
      if (!childId) return false
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/scavenger-hunt/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, locationSet }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to start hunt')
        }
        const { session, prompts: fetched } = await res.json()
        setSessionId(session.id)
        setPrompts(fetched)
        setCurrentIndex(0)
        setStats(emptyStats)
        matchedPromptIds.current = new Set()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start hunt')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [childId]
  )

  const submitPhoto = useCallback(
    async (file: File): Promise<ScavengerVerifyResult | null> => {
      if (!currentPrompt || !sessionId) return null
      try {
        const formData = new FormData()
        formData.append('photo', file)
        formData.append('promptId', currentPrompt.id)

        const res = await fetch(
          `/api/scavenger-hunt/sessions/${sessionId}/verify`,
          { method: 'POST', body: formData }
        )

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          // Surface a soft error so the child can retry/skip without losing the session.
          setError(data.error || 'Could not check that photo')
          return null
        }

        const result: ScavengerVerifyResult = await res.json()
        setError(null)

        const isFirstMatch =
          result.isMatch && !matchedPromptIds.current.has(currentPrompt.id)
        if (result.isMatch) matchedPromptIds.current.add(currentPrompt.id)

        setStats((prev) => ({
          ...prev,
          promptsAttempted: prev.promptsAttempted + 1,
          promptsFound: prev.promptsFound + (isFirstMatch ? 1 : 0),
          findCashEarned: prev.findCashEarned + result.cashEarned,
        }))

        return result
      } catch {
        setError('Could not check that photo')
        return null
      }
    },
    [currentPrompt, sessionId]
  )

  const advance = useCallback(() => {
    setCurrentIndex((prev) => prev + 1)
  }, [])

  const skipPrompt = useCallback(async () => {
    if (!currentPrompt || !sessionId) {
      advance()
      return
    }
    try {
      await fetch(`/api/scavenger-hunt/sessions/${sessionId}/prompt-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: currentPrompt.id, action: 'skip' }),
      })
    } catch {
      // Skipping is best-effort; advance regardless so the child is never stuck.
    }
    setStats((prev) => ({ ...prev, promptsSkipped: prev.promptsSkipped + 1 }))
    advance()
  }, [currentPrompt, sessionId, advance])

  const replacePrompt = useCallback(async (): Promise<boolean> => {
    if (!currentPrompt || !sessionId) return false
    try {
      const res = await fetch(
        `/api/scavenger-hunt/sessions/${sessionId}/prompt-action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptId: currentPrompt.id,
            action: 'replace',
            currentPromptIds: prompts.map((p) => p.id),
          }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No new prompt available')
        return false
      }
      const { nextPrompt } = await res.json()
      if (!nextPrompt) return false

      // Swap the current prompt in place; it doesn't count against the child.
      setPrompts((prev) => {
        const next = [...prev]
        next[currentIndex] = nextPrompt
        return next
      })
      setStats((prev) => ({ ...prev, promptsReplaced: prev.promptsReplaced + 1 }))
      setError(null)
      return true
    } catch {
      setError('No new prompt available')
      return false
    }
  }, [currentPrompt, sessionId, prompts, currentIndex])

  const completeSession = useCallback(async (): Promise<HuntSummary | null> => {
    if (!sessionId) return null
    try {
      const res = await fetch(
        `/api/scavenger-hunt/sessions/${sessionId}/complete`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      )
      if (!res.ok) return null
      return (await res.json()) as HuntSummary
    } catch {
      return null
    }
  }, [sessionId])

  const reset = useCallback(() => {
    setPrompts([])
    setCurrentIndex(0)
    setSessionId(null)
    setStats(emptyStats)
    setError(null)
    matchedPromptIds.current = new Set()
  }, [])

  return {
    prompts,
    currentIndex,
    currentPrompt,
    sessionId,
    stats,
    isLoading,
    error,
    isSessionComplete,
    startSession,
    submitPhoto,
    skipPrompt,
    replacePrompt,
    advance,
    completeSession,
    reset,
  }
}
