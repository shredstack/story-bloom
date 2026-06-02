'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useChild, useImmersiveMode } from '../../../ProtectedLayoutClient'
import { QuitGameDialog } from '@/components/games/QuitGameDialog'
import { enterFullscreen } from '@/lib/fullscreen'
import { useWordRescue } from '@/lib/hooks/useWordRescue'
import { useSpeechRecognition } from '@/lib/hooks/useSpeechRecognition'
import { BuddySelector } from '../components/BuddySelector'
import { BuddyEncouragement } from '../components/BuddyEncouragement'
import { RescueCard } from '../components/RescueCard'
import { WordCoach } from '../components/WordCoach'
import { RewardCelebration } from '../components/RewardCelebration'
import { SessionSummary } from '../components/SessionSummary'
import { Button, Card } from '@/components/ui'
import type { Pet, CelebrationData, WordCheckResult } from '@/lib/types'

type GamePhase = 'buddy-select' | 'playing' | 'complete'

export default function WordRescuePracticePage() {
  const router = useRouter()
  const { selectedChild } = useChild()

  const [phase, setPhase] = useState<GamePhase>('buddy-select')
  const [showWordCoach, setShowWordCoach] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null)
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | 'mastered' | 'stageUp' | null>(null)
  const [usedCoachForCurrentWord, setUsedCoachForCurrentWord] = useState(false)
  const [lastAttemptCorrect, setLastAttemptCorrect] = useState<boolean | null>(null)
  const [needsReset, setNeedsReset] = useState(false)
  const [checkError, setCheckError] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  // Lock into a focused experience while playing so stray taps on the nav bar
  // can't navigate away and lose progress. Chrome returns on the summary screen.
  useImmersiveMode(phase === 'playing')

  const {
    words,
    currentWordIndex,
    currentWord,
    buddyPet,
    stats,
    isLoading,
    error,
    isSessionComplete,
    startSession,
    checkWord,
    skipWord,
    endSession,
    reset,
  } = useWordRescue({ childId: selectedChild?.id || '' })

  const handleSpeechResult = useCallback(
    async (spoken: string) => {
      if (!currentWord) return

      setCheckError(false)
      const result = await checkWord(spoken, usedCoachForCurrentWord)

      if (!result) {
        // Network error - let the child try again without killing the session
        setCheckError(true)
        setNeedsReset(true)
        return
      }

      if (result) {
        setLastAttemptCorrect(result.correct)

        if (result.correct) {
          // Set result type for buddy encouragement
          if (result.isMastered) {
            setLastResult('mastered')
          } else if (result.stageAdvanced) {
            setLastResult('stageUp')
          } else {
            setLastResult('correct')
          }

          // Show celebration
          setCelebrationData({
            word: currentWord.word,
            coinsEarned: result.coinsEarned,
            isMastered: result.isMastered,
            cashEarned: result.cashEarned,
            newStage: result.stageAdvanced ? result.newStage : undefined,
          })
          setShowCelebration(true)
        } else {
          setLastResult('incorrect')
          // Signal that we need to reset speech recognition so they can try again
          setNeedsReset(true)
          // Don't auto-show word coach - let them click "Need help?"
        }
      }
    },
    [currentWord, checkWord, usedCoachForCurrentWord]
  )

  const {
    status,
    startListening,
    stopListening,
    transcript,
    resetTranscript,
    isSupported,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
  })

  // Handle phase transitions
  useEffect(() => {
    if (isSessionComplete && phase === 'playing') {
      setPhase('complete')
      endSession()
    }
  }, [isSessionComplete, phase, endSession])

  // Reset state when moving to new word
  useEffect(() => {
    setUsedCoachForCurrentWord(false)
    setLastAttemptCorrect(null)
    setLastResult(null)
    setNeedsReset(false)
    setCheckError(false)
    resetTranscript()
  }, [currentWordIndex, resetTranscript])

  // Reset speech recognition after incorrect answer so child can try again
  useEffect(() => {
    if (needsReset) {
      resetTranscript()
      setNeedsReset(false)
    }
  }, [needsReset, resetTranscript])

  const handleBuddySelect = async (pet: Pet) => {
    // Request fullscreen from this tap (gesture-gated) so the game fills the
    // tablet screen; the immersive hook drops out of fullscreen when it ends.
    enterFullscreen()
    await startSession(pet.id)
    setPhase('playing')
  }

  const handleMicClick = () => {
    if (status === 'listening') {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  const handleNeedHelp = () => {
    setShowWordCoach(true)
    setUsedCoachForCurrentWord(true)
  }

  const handleWordCoachComplete = () => {
    setShowWordCoach(false)
    // They can now try again
    setLastAttemptCorrect(null)
  }

  const handleWordCoachSkip = () => {
    setShowWordCoach(false)
    skipWord()
  }

  const handleCelebrationComplete = () => {
    setShowCelebration(false)
    setCelebrationData(null)
    // Auto-advance after correct answer
    skipWord()
  }

  const handleSkip = () => {
    skipWord()
  }

  const handlePlayAgain = () => {
    reset()
    setPhase('buddy-select')
    setShowWordCoach(false)
    setShowCelebration(false)
  }

  const handleExit = () => {
    router.push('/games/word-rescue')
  }

  // End the session deliberately (gated by confirmation): finalize so progress is
  // saved, then show the summary.
  const handleConfirmQuit = () => {
    setShowQuitConfirm(false)
    endSession()
    setPhase('complete')
  }

  // No child selected
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

  // Check browser support
  if (!isSupported) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Card className="p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold mb-4">Browser Not Supported</h2>
          <p className="text-gray-600 mb-4">
            Word Rescue requires speech recognition which is not supported in your browser.
            Please use Chrome or Edge for the best experience.
          </p>
          <Button onClick={() => router.push('/games')}>Back to Games</Button>
        </Card>
      </div>
    )
  }

  // Buddy selection phase
  if (phase === 'buddy-select') {
    return (
      <div className="container mx-auto px-4 py-8">
        <BuddySelector
          childId={selectedChild.id}
          onSelect={handleBuddySelect}
          onBack={() => router.push('/games/word-rescue')}
        />
      </div>
    )
  }

  // Session complete phase
  if (phase === 'complete' && buddyPet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <SessionSummary
          stats={stats}
          buddyPet={buddyPet}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
        />
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading words...</p>
      </div>
    )
  }

  // Error state (session-level errors like failed to start)
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Card className="p-6 max-w-md mx-auto">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/games')}>Go Back</Button>
        </Card>
      </div>
    )
  }

  // Playing phase
  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      {/* Header with progress */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-sm text-gray-500">Progress</span>
          <div className="font-semibold">
            {currentWordIndex + 1} / {words.length}
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">Rescued</span>
          <div className="font-semibold text-green-600">{stats.wordsRescued}</div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowQuitConfirm(true)}
        >
          Quit
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-purple-500 transition-all duration-300"
          style={{ width: `${((currentWordIndex) / words.length) * 100}%` }}
        />
      </div>

      {/* Buddy encouragement */}
      {buddyPet && (
        <div className="mb-6">
          <BuddyEncouragement
            pet={buddyPet}
            status={status}
            lastResult={lastResult}
          />
        </div>
      )}

      {/* Word card */}
      {currentWord && (
        <RescueCard
          word={currentWord}
          status={status}
          onMicClick={handleMicClick}
          onNeedHelp={handleNeedHelp}
          onSkip={handleSkip}
          lastAttemptCorrect={lastAttemptCorrect}
          checkError={checkError}
        />
      )}

      {/* Rewards bar */}
      <div className="flex justify-center items-center gap-6 mt-6 text-sm">
        <span className="flex items-center gap-1">
          <span className="text-xl">🪙</span>
          <span className="font-semibold">{stats.totalCoins}</span>
        </span>
        {stats.totalGems > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-xl">💎</span>
            <span className="font-semibold">{stats.totalGems}</span>
          </span>
        )}
        {stats.cashEarned > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <span className="text-xl">💵</span>
            <span className="font-semibold">${stats.cashEarned.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* Word Coach overlay */}
      {showWordCoach && currentWord && (
        <WordCoach
          word={currentWord}
          buddyPet={buddyPet || undefined}
          onComplete={handleWordCoachComplete}
          onSkip={handleWordCoachSkip}
        />
      )}

      {/* Celebration overlay */}
      {showCelebration && celebrationData && (
        <RewardCelebration data={celebrationData} onComplete={handleCelebrationComplete} />
      )}

      {/* Quit confirmation — prevents an accidental tap from ending the session. */}
      <QuitGameDialog
        open={showQuitConfirm}
        onKeepPlaying={() => setShowQuitConfirm(false)}
        onQuit={handleConfirmQuit}
      />
    </div>
  )
}
