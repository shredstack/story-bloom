'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useChild, useImmersiveMode } from '../../../ProtectedLayoutClient'
import { QuitGameDialog } from '@/components/games/QuitGameDialog'
import { HoldToQuitButton } from '@/components/games/HoldToQuitButton'
import { KidButton } from '@/components/games/KidButton'
import { useQuitGuard } from '@/lib/hooks/useQuitGuard'
import { successHaptic, warningHaptic } from '@/lib/native/haptics'
import { useWordQuest } from '@/lib/hooks/useWordQuest'
import { useReadingCheck } from '@/lib/hooks/useReadingCheck'
import { usePets } from '@/lib/hooks/usePets'
import { Button, Card } from '@/components/ui'
import { GrownUpCheckBar } from '@/components/games/GrownUpCheckBar'
import { GrownUpVerdictButtons } from '@/components/games/GrownUpVerdictButtons'
import { MicTroubleNotice } from '@/components/games/MicTroubleNotice'
import {
  WordCard,
  SpeechButton,
  ProgressBar,
  SuccessAnimation,
  PetRewardModal,
  PostSessionPetReaction,
} from '@/components/word-quest'
import type { Pet, PetType, PetCustomization } from '@/lib/types'
import { PET_MAPPINGS, PET_REWARD_SCORE_THRESHOLD } from '@/lib/types'

export default function PracticePage() {
  const router = useRouter()
  const { selectedChild } = useChild()
  const [lastResult, setLastResult] = useState<'correct' | 'incorrect' | null>(
    null
  )
  const [showSuccess, setShowSuccess] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showPetReward, setShowPetReward] = useState(false)
  const [showPetReaction, setShowPetReaction] = useState(false)
  const [newPet, setNewPet] = useState<Pet | null>(null)
  const [isFirstPet, setIsFirstPet] = useState(false)
  const [earnedPetReward, setEarnedPetReward] = useState(false)
  const [rewardPetType, setRewardPetType] = useState<PetType>('cat')

  const {
    words,
    currentWordIndex,
    currentWord,
    isLoading,
    error,
    wordsCorrect,
    isSessionComplete,
    startSession,
    checkAnswer,
    markAnswer,
    skipWord,
    endSession,
  } = useWordQuest({
    childId: selectedChild?.id || '',
    readingLevel: selectedChild?.reading_level || 'Kindergarten',
    wordsPerSession: 10,
  })

  const { pets, favoritePet, createPetWithCustomization, pollImageStatus } = usePets({ childId: selectedChild?.id || '' })

  // Determine pet type from child's favorite things
  const selectPetTypeFromFavorites = useCallback((favoriteThings: string[]): PetType => {
    for (const thing of favoriteThings) {
      const normalized = thing.toLowerCase().trim()
      const words = normalized.split(/\s+/)
      for (const word of words) {
        if (PET_MAPPINGS[word]) {
          return PET_MAPPINGS[word]
        }
      }
    }
    return 'cat'
  }, [])

  // Shared by both routes to a verdict, so the celebration, the haptic and the
  // pacing are identical whether the mic or a grown-up decided.
  const showResult = useCallback((isCorrect: boolean) => {
    if (isCorrect) successHaptic()
    else warningHaptic()
    setLastResult(isCorrect ? 'correct' : 'incorrect')
    setIsAdvancing(true)

    // Advance to next word after showing result
    const delay = isCorrect ? 1500 : 2000
    setTimeout(() => {
      setLastResult(null)
      setIsAdvancing(false)
    }, delay)
  }, [])

  const handleSpeechResult = useCallback(
    async (text: string) => {
      if (!currentWord || isAdvancing) return
      showResult(await checkAnswer(text))
    },
    [currentWord, checkAnswer, isAdvancing, showResult]
  )

  const { speech, check, unlock } = useReadingCheck({
    onResult: handleSpeechResult,
  })
  const {
    status,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
  } = speech

  const handleGrownUpVerdict = useCallback(
    async (correct: boolean) => {
      if (!currentWord || isAdvancing) return
      showResult(await markAnswer(correct))
    },
    [currentWord, markAnswer, isAdvancing, showResult]
  )

  // Start session on mount
  useEffect(() => {
    if (selectedChild) {
      startSession()
    }
  }, [selectedChild, startSession])

  // Handle session complete
  useEffect(() => {
    async function handleSessionComplete() {
      if (isSessionComplete && !showSuccess) {
        setShowSuccess(true)
        await endSession()

        const percentage = words.length > 0 ? Math.round((wordsCorrect / words.length) * 100) : 0

        if (pets.length === 0 && selectedChild) {
          // First pet - awarded regardless of score
          const petType = selectPetTypeFromFavorites(selectedChild.favorite_things || [])
          setRewardPetType(petType)
          setIsFirstPet(true)
          setEarnedPetReward(true)
        } else if (percentage >= PET_REWARD_SCORE_THRESHOLD && selectedChild) {
          // High score reward - new pet!
          const petType = selectPetTypeFromFavorites(selectedChild.favorite_things || [])
          setRewardPetType(petType)
          setIsFirstPet(false)
          setEarnedPetReward(true)
        }
      }
    }
    handleSessionComplete()
  }, [isSessionComplete, showSuccess, endSession, pets.length, selectedChild, selectPetTypeFromFavorites, words.length, wordsCorrect])

  // Handle pet creation from the reward modal
  const handleCreatePet = useCallback(
    async (customization: PetCustomization, name: string): Promise<Pet | null> => {
      const pet = await createPetWithCustomization(rewardPetType, name, customization)
      if (pet) {
        setNewPet(pet)
      }
      return pet
    },
    [createPetWithCustomization, rewardPetType]
  )

  // Handle pet type change from reward modal
  const handlePetTypeChange = useCallback((newPetType: PetType) => {
    setRewardPetType(newPetType)
  }, [])

  // Reset transcript when advancing
  useEffect(() => {
    if (lastResult === null) {
      resetTranscript()
    }
  }, [lastResult, resetTranscript])

  // Advance word index when result is cleared
  useEffect(() => {
    if (lastResult === null && isAdvancing === false && currentWord) {
      // Word already advanced via checkAnswer in useWordQuest
    }
  }, [lastResult, isAdvancing, currentWord])

  const handleSkip = () => {
    skipWord()
    resetTranscript()
    setLastResult(null)
  }

  const handleEndSession = async () => {
    await endSession()
    router.push('/games/word-quest')
  }

  const handleConfirmQuit = () => {
    keepPlaying()
    handleEndSession()
  }

  // Lock into a focused experience while actively playing so stray taps on the
  // nav bar can't navigate away mid-session. Chrome returns on loading/error
  // screens and once the session is complete (the reward overlays cover the page).
  const isPlaying =
    !isLoading && !error && !!selectedChild && !isSessionComplete
  useImmersiveMode(isPlaying)

  // Quit confirm state + native back-button "request-quit" listener (only while playing).
  const { showConfirm, requestQuit, keepPlaying } = useQuitGuard(isPlaying)

  if (!selectedChild) {
    router.push('/games/word-quest')
    return null
  }

  // No "Speech Recognition Not Available" dead end any more: a device without a
  // microphone falls back to a grown-up marking answers (see useAnswerCheckMode).

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
        <p className="text-gray-600">Getting words ready...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Card className="py-8">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => startSession()}>Try Again</Button>
            <Button variant="outline" onClick={() => router.push('/games/word-quest')}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      {/* Header: hold-to-quit lives in the corner, quiet and hard to trigger by
          accident (§B2). */}
      <div className="flex items-center justify-between mb-6">
        <HoldToQuitButton onHoldComplete={requestQuit} />
        <div className="text-sm text-gray-500">{selectedChild.name}</div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <ProgressBar
          current={currentWordIndex}
          total={words.length}
          correct={wordsCorrect}
        />
      </div>

      {/* Word Card */}
      {currentWord && (
        <div className="mb-8">
          <WordCard
            word={currentWord.word}
            status={status}
            lastResult={lastResult}
          />
        </div>
      )}

      {/* Speech feedback */}
      <div className="h-8 text-center mb-4">
        {check.micEnabled && transcript && (
          <span className="text-lg text-gray-500">
            I heard: &quot;
            <span className="font-medium text-gray-700">{transcript}</span>
            &quot;
          </span>
        )}
        {check.micEnabled && speechError && (
          <span className="text-red-500">{speechError}</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-6">
        {check.micEnabled && !check.isLoading && (
          <SpeechButton
            status={status}
            onStart={startListening}
            onStop={stopListening}
            disabled={!currentWord || lastResult !== null || isAdvancing}
          />
        )}

        <p className="text-gray-500 text-sm text-center">
          {status === 'listening'
            ? 'Listening... Say the word!'
            : lastResult === 'correct'
              ? 'Great job! ⭐'
              : lastResult === 'incorrect'
                ? 'Try again! You can do it!'
                : check.micEnabled
                  ? 'Tap the microphone and read the word'
                  : 'Read the word out loud to your grown-up'}
        </p>

        {/* The microphone keeps failing — offer the way out rather than making
            a parent hunt through settings mid-game. */}
        {check.micTrouble && (
          <MicTroubleNotice
            onSwitch={check.switchToGrownUp}
            onDismiss={check.dismissMicTrouble}
          />
        )}
        {check.autoFellBack && <MicTroubleNotice automatic />}

        {check.grownUpEnabled && !check.isLoading && (
          <GrownUpCheckBar unlock={unlock} hint={`Did they read "${currentWord?.word ?? ''}"?`}>
            <GrownUpVerdictButtons
              onVerdict={handleGrownUpVerdict}
              disabled={!currentWord || lastResult !== null || isAdvancing}
            />
          </GrownUpCheckBar>
        )}

        {/* Big, obvious escape hatch so a kid reaches for "Skip" instead of
            fishing for the OS back gesture (§B5). */}
        <div className="flex items-center gap-4">
          <KidButton
            variant="secondary"
            size="lg"
            onPress={handleSkip}
            disabled={lastResult !== null || isAdvancing}
            aria-label="Skip this word"
          >
            Skip Word →
          </KidButton>
          <KidButton variant="quiet" size="md" onPress={requestQuit} haptic={false}>
            End Session
          </KidButton>
        </div>
      </div>

      {/* Success Animation */}
      <SuccessAnimation
        show={showSuccess && !showPetReward && !showPetReaction}
        wordsCorrect={wordsCorrect}
        totalWords={words.length}
        onComplete={() => {
          setShowSuccess(false)
          if (earnedPetReward) {
            // New pet flow for first-time users or high score reward
            setShowPetReward(true)
          } else if (favoritePet) {
            // Show pet reaction for existing pet owners
            setShowPetReaction(true)
          } else {
            router.push('/games/word-quest')
          }
        }}
      />

      {/* Pet Reaction for existing pets */}
      {favoritePet && selectedChild && (
        <PostSessionPetReaction
          pet={favoritePet}
          childId={selectedChild.id}
          sessionData={{
            wordsPracticed: words.length,
            wordsCorrect: wordsCorrect,
          }}
          show={showPetReaction}
          onComplete={() => {
            setShowPetReaction(false)
            router.push('/games/word-quest')
          }}
        />
      )}

      {/* Pet Reward Modal for first pet */}
      <PetRewardModal
        show={showPetReward}
        pet={newPet}
        petType={rewardPetType}
        isFirstPet={isFirstPet}
        onClose={() => router.push('/games/word-quest')}
        onVisitPet={() => {
          if (newPet) {
            router.push(`/games/pets/${newPet.id}`)
          }
        }}
        onCreatePet={handleCreatePet}
        pollImageStatus={pollImageStatus}
        onPetTypeChange={handlePetTypeChange}
      />

      {/* Quit confirmation — prevents an accidental tap from ending the session. */}
      <QuitGameDialog
        open={showConfirm}
        onKeepPlaying={keepPlaying}
        onQuit={handleConfirmQuit}
        title="Quit Word Quest?"
      />
    </div>
  )
}
