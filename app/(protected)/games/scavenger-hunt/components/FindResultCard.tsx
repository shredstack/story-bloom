'use client'

import { Button, Card } from '@/components/ui'
import type { ScavengerVerifyResult } from '@/lib/types'

interface FindResultCardProps {
  result: ScavengerVerifyResult
  onNext: () => void // advance to the next prompt (after a match)
  onTryAgain: () => void // re-open the camera for the same prompt
  onSkip: () => void
  onNewOne: () => void
  canReplace: boolean
}

export function FindResultCard({
  result,
  onNext,
  onTryAgain,
  onSkip,
  onNewOne,
  canReplace,
}: FindResultCardProps) {
  const matched = result.isMatch

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card
        className={`max-w-sm w-full p-6 text-center ${
          matched
            ? 'bg-gradient-to-br from-green-50 to-emerald-50'
            : 'bg-gradient-to-br from-blue-50 to-indigo-50'
        }`}
      >
        <div className="text-6xl mb-3">{matched ? '🎉' : '🤔'}</div>

        <h2
          className={`text-2xl font-extrabold mb-2 ${
            matched ? 'text-green-700' : 'text-indigo-700'
          }`}
        >
          {matched ? 'You found it!' : 'Hmm…'}
        </h2>

        <p className="text-gray-700 mb-4">{result.kidMessage}</p>

        {matched && result.cashEarned > 0 && (
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-green-100 text-green-700 font-bold">
            <span className="text-xl">💵</span>+ ${result.cashEarned.toFixed(2)}
          </div>
        )}

        {matched && result.cashEarned === 0 && result.weeklyCapReached && (
          <p className="text-sm text-gray-500 mb-4">
            You hit this week&apos;s reward cap — still a great find!
          </p>
        )}

        {matched ? (
          <Button className="w-full py-3 text-lg" onClick={onNext}>
            Next →
          </Button>
        ) : (
          <div className="space-y-2">
            <Button className="w-full py-3 text-lg" onClick={onTryAgain}>
              📸 Try Again
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onSkip}>
                Can&apos;t find it
              </Button>
              {canReplace && (
                <Button variant="outline" className="flex-1" onClick={onNewOne}>
                  Give me a new one
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
