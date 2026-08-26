'use client'

import { Button } from '@/components/ui'
import { MASTERY_STAGE_INFO, type StrugglingWord, type SpeechRecognitionStatus } from '@/lib/types'

interface RescueCardProps {
  word: StrugglingWord
  status: SpeechRecognitionStatus
  /** False when a grown-up is marking answers instead of the microphone. */
  micEnabled?: boolean
  onMicClick: () => void
  onNeedHelp: () => void
  onSkip: () => void
  lastAttemptCorrect?: boolean | null
  checkError?: boolean
}

export function RescueCard({
  word,
  status,
  micEnabled = true,
  onMicClick,
  onNeedHelp,
  onSkip,
  lastAttemptCorrect,
  checkError,
}: RescueCardProps) {
  const stageInfo = MASTERY_STAGE_INFO[word.current_stage]

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
      {/* Stage indicator */}
      <div className="flex justify-between items-center mb-4">
        <span className={`text-sm font-medium ${stageInfo.color}`}>
          {stageInfo.emoji} {stageInfo.label}
        </span>
        <span className="text-sm text-gray-500">
          {word.times_correct}/{word.times_practiced} correct
        </span>
      </div>

      {/* Word display */}
      <div className="text-center mb-6">
        <h2
          className={`text-4xl font-bold mb-2 transition-colors ${
            lastAttemptCorrect === true
              ? 'text-green-600'
              : lastAttemptCorrect === false
              ? 'text-orange-500'
              : 'text-gray-900'
          }`}
        >
          {word.word}
        </h2>

        {/* Feedback message */}
        {lastAttemptCorrect === true && (
          <p className="text-green-600 font-medium animate-bounce">Great job!</p>
        )}
        {lastAttemptCorrect === false && (
          <p className="text-orange-500 font-medium">Let&apos;s try again!</p>
        )}
        {checkError && (
          <p className="text-red-500 font-medium text-sm">
            Oops, something went wrong. Try again!
          </p>
        )}
      </div>

      {/* Mic button — absent entirely when a grown-up is doing the checking, so
          the child isn't invited to tap something that decides nothing. */}
      {micEnabled && (
        <div className="flex justify-center mb-6">
          <button
            onClick={onMicClick}
            disabled={status === 'processing'}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all ${
              status === 'listening'
                ? 'bg-red-500 text-white animate-pulse scale-110'
                : status === 'processing'
                ? 'bg-gray-200 text-gray-400'
                : 'bg-purple-500 text-white hover:bg-purple-600 hover:scale-105'
            }`}
          >
            {status === 'listening' ? '🎤' : status === 'processing' ? '⏳' : '🎤'}
          </button>
        </div>
      )}

      {/* Instructions */}
      <p className="text-center text-gray-600 mb-4 text-sm">
        {!micEnabled
          ? 'Say the word out loud to your grown-up'
          : status === 'listening'
          ? 'Listening... Say the word!'
          : status === 'processing'
          ? 'Checking...'
          : 'Tap the mic and say the word'}
      </p>

      {/* Action buttons */}
      <div className="flex justify-center gap-3">
        <Button variant="ghost" size="sm" onClick={onNeedHelp}>
          Need help?
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip} className="text-gray-500">
          Skip
        </Button>
      </div>
    </div>
  )
}
