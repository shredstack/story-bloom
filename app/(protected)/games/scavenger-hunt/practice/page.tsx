'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useChild } from '../../../ProtectedLayoutClient'
import { useScavengerHunt } from '@/lib/hooks/useScavengerHunt'
import { Button, Card } from '@/components/ui'
import { SCAVENGER_HUNT_DEFAULTS, type ScavengerLocation, type ScavengerVerifyResult } from '@/lib/types'
import { PromptCard } from '../components/PromptCard'
import { CameraCapture } from '../components/CameraCapture'
import { VerifyingAnimation } from '../components/VerifyingAnimation'
import { FindResultCard } from '../components/FindResultCard'
import { HuntSummary } from '../components/HuntSummary'
import type { HuntSummary as HuntSummaryData } from '@/lib/hooks/useScavengerHunt'

type Phase = 'loading' | 'playing' | 'verifying' | 'result' | 'complete'

function PracticeInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedChild } = useChild()

  const locationParam = (searchParams.get('location') || 'either') as ScavengerLocation

  const {
    prompts,
    currentIndex,
    currentPrompt,
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
  } = useScavengerHunt({ childId: selectedChild?.id || '' })

  const [phase, setPhase] = useState<Phase>('loading')
  const [result, setResult] = useState<ScavengerVerifyResult | null>(null)
  const [summary, setSummary] = useState<HuntSummaryData | null>(null)
  const startedRef = useRef(false)

  // Start the hunt once on mount.
  useEffect(() => {
    if (startedRef.current || !selectedChild) return
    startedRef.current = true
    startSession(locationParam).then((ok) => {
      setPhase(ok ? 'playing' : 'loading')
    })
  }, [selectedChild, locationParam, startSession])

  // When all prompts are done, finalize and show the summary.
  useEffect(() => {
    if (isSessionComplete && phase === 'playing') {
      setPhase('complete')
      completeSession().then(setSummary)
    }
  }, [isSessionComplete, phase, completeSession])

  const handleCapture = async (file: File) => {
    setPhase('verifying')
    const r = await submitPhoto(file)
    if (!r) {
      // Soft error (network/AI/rate-limit). Let them try again.
      setPhase('playing')
      return
    }
    setResult(r)
    setPhase('result')
  }

  const handleNext = () => {
    setResult(null)
    setPhase('playing')
    advance()
  }

  const handleTryAgain = () => {
    setResult(null)
    setPhase('playing')
  }

  const handleSkip = async () => {
    setResult(null)
    setPhase('playing')
    await skipPrompt()
  }

  const handleNewOne = async () => {
    setResult(null)
    setPhase('playing')
    await replacePrompt()
  }

  const handlePlayAgain = () => {
    reset()
    router.push('/games/scavenger-hunt')
  }

  const handleExit = () => {
    router.push('/games/scavenger-hunt')
  }

  if (!selectedChild) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Please select a child first.</p>
        <Button className="mt-4" onClick={() => router.push('/profile')}>
          Go to Profile
        </Button>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="container mx-auto px-4 py-8">
        <HuntSummary
          summary={summary}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
        />
      </div>
    )
  }

  if (isLoading && phase === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">Getting your hunt ready…</p>
      </div>
    )
  }

  // Hard error (couldn't start the session at all).
  if (error && prompts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Card className="p-6 max-w-md mx-auto">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/games/scavenger-hunt')}>Go Back</Button>
        </Card>
      </div>
    )
  }

  const replacementsLeft =
    SCAVENGER_HUNT_DEFAULTS.maxReplacementsPerSession - stats.promptsReplaced

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      {/* Header: progress + running cash + exit */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-sm text-gray-500">Clue</span>
          <div className="font-semibold">
            {Math.min(currentIndex + 1, prompts.length)} / {prompts.length}
          </div>
        </div>
        <div className="text-center">
          <span className="text-sm text-gray-500">Found</span>
          <div className="font-semibold text-green-600">{stats.promptsFound}</div>
        </div>
        {stats.findCashEarned > 0 && (
          <div className="text-center">
            <span className="text-sm text-gray-500">Earned</span>
            <div className="font-semibold text-green-600">
              ${stats.findCashEarned.toFixed(2)}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPhase('complete')
            completeSession().then(setSummary)
          }}
        >
          Exit
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-purple-500 transition-all duration-300"
          style={{ width: `${(currentIndex / prompts.length) * 100}%` }}
        />
      </div>

      {/* Prompt to read */}
      {currentPrompt && (
        <div className="mb-6">
          <PromptCard prompt={currentPrompt} />
        </div>
      )}

      {/* Soft error (e.g. AI nap / rate limit) */}
      {error && prompts.length > 0 && (
        <p className="text-center text-sm text-amber-600 mb-3">{error}</p>
      )}

      {/* Camera + escape hatches */}
      <div className="space-y-3">
        <CameraCapture onCapture={handleCapture} disabled={phase === 'verifying'} />
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSkip}
            disabled={phase === 'verifying'}
          >
            Can&apos;t find it
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleNewOne}
            disabled={phase === 'verifying' || replacementsLeft <= 0}
          >
            Give me a new one
            {replacementsLeft > 0 && replacementsLeft <= 3 && (
              <span className="ml-1 text-xs text-gray-400">({replacementsLeft})</span>
            )}
          </Button>
        </div>
      </div>

      {phase === 'verifying' && <VerifyingAnimation />}

      {phase === 'result' && result && (
        <FindResultCard
          result={result}
          onNext={handleNext}
          onTryAgain={handleTryAgain}
          onSkip={handleSkip}
          onNewOne={handleNewOne}
          canReplace={replacementsLeft > 0}
        />
      )}
    </div>
  )
}

export default function ScavengerHuntPracticePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
        </div>
      }
    >
      <PracticeInner />
    </Suspense>
  )
}
