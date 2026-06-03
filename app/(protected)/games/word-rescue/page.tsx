'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useChild } from '../../ProtectedLayoutClient'
import { useStrugglingWords } from '@/lib/hooks/useStrugglingWords'
import { Button, Card } from '@/components/ui'
import { KidButton } from '@/components/games/KidButton'
import { MASTERY_STAGE_INFO } from '@/lib/types'

export default function WordRescuePage() {
  const router = useRouter()
  const { selectedChild } = useChild()
  const { words, stats, isLoading, fetchWords } = useStrugglingWords({
    childId: selectedChild?.id || '',
    autoFetch: false,
  })

  useEffect(() => {
    if (selectedChild) {
      fetchWords()
    }
  }, [selectedChild, fetchWords])

  // Words available for practice (not mastered)
  const wordsToRescue = words.filter((w) => w.current_stage !== 'mastered')

  if (!selectedChild) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">No Child Selected</h2>
          <p className="text-gray-600 mb-4">
            Please select a child from the dropdown in the header.
          </p>
          <Link href="/profile">
            <Button>Go to Profile</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Word Rescue</h1>
        <p className="text-gray-600">
          Practice tricky words with your pet buddy and earn rewards!
        </p>
      </div>

      {/* Word Garden Summary */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-center">
          {selectedChild.name}&apos;s Word Garden
        </h2>

        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <div className="grid grid-cols-4 gap-4 text-center">
            {(['seedling', 'growing', 'blooming', 'mastered'] as const).map((stage) => (
              <div key={stage}>
                <div className={`text-3xl ${MASTERY_STAGE_INFO[stage].color}`}>
                  {MASTERY_STAGE_INFO[stage].emoji}
                </div>
                <div className="text-xl font-bold">{stats[stage]}</div>
                <div className="text-xs text-gray-500">
                  {MASTERY_STAGE_INFO[stage].label}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Practice Button */}
      {wordsToRescue.length > 0 ? (
        <Card className="p-6 mb-6 text-center bg-gradient-to-br from-purple-50 to-pink-50">
          <h3 className="text-xl font-semibold text-purple-900 mb-2">
            {wordsToRescue.length} words need rescuing!
          </h3>
          <p className="text-purple-700 mb-4">
            Practice with your pet buddy to help your words grow
          </p>
          <div className="flex justify-center">
            <KidButton
              size="xl"
              onPress={() => router.push('/games/word-rescue/practice')}
              aria-label="Start practicing"
            >
              Start Practicing!
            </KidButton>
          </div>
        </Card>
      ) : (
        <Card className="p-6 mb-6 text-center">
          {stats.total === 0 ? (
            <>
              <div className="text-4xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2">No Words Yet!</h3>
              <p className="text-gray-600 mb-4">
                Words will be added automatically when {selectedChild.name} practices
                Sentence Shenanigans, or you can add them manually.
              </p>
              <Link href="/parent/struggling-words">
                <Button variant="outline">Add Words Manually</Button>
              </Link>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="text-xl font-semibold mb-2">All Words Mastered!</h3>
              <p className="text-gray-600 mb-4">
                Great job! {selectedChild.name} has mastered all their words.
              </p>
              <Link href="/games/sentence-shenanigans">
                <Button variant="outline">Practice Reading to Find More</Button>
              </Link>
            </>
          )}
        </Card>
      )}

      {/* Links */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link href="/parent/struggling-words">
          <Button variant="outline" className="w-full sm:w-auto">
            Manage Word List
          </Button>
        </Link>
        <Link href="/games">
          <Button variant="ghost" className="w-full sm:w-auto">
            Back to Games
          </Button>
        </Link>
      </div>
    </div>
  )
}
