'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChild } from '../../ProtectedLayoutClient'
import { Button, Card } from '@/components/ui'
import { KidButton } from '@/components/games/KidButton'
import { PetCard } from '@/components/word-quest'
import { usePets } from '@/lib/hooks/usePets'
import { createClient } from '@/lib/supabase/client'
import { enterFullscreen } from '@/lib/fullscreen'

interface ProgressStats {
  totalWordsPracticed: number
  wordsLearned: number
  recentSessions: number
}

export default function WordQuestPage() {
  const router = useRouter()
  const { selectedChild, children } = useChild()
  const [stats, setStats] = useState<ProgressStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { pets, favoritePet } = usePets({ childId: selectedChild?.id || '' })

  useEffect(() => {
    async function fetchStats() {
      if (!selectedChild) {
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Fetch word progress stats
      const { data: progress } = await supabase
        .from('word_progress')
        .select('mastery_level')
        .eq('child_id', selectedChild.id)

      const { data: sessions } = await supabase
        .from('practice_sessions')
        .select('words_practiced, words_correct')
        .eq('child_id', selectedChild.id)
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(7)

      const wordsLearned =
        progress?.filter((p) => p.mastery_level >= 4).length || 0
      const totalPracticed =
        sessions?.reduce((sum, s) => sum + s.words_practiced, 0) || 0

      setStats({
        totalWordsPracticed: totalPracticed,
        wordsLearned,
        recentSessions: sessions?.length || 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [selectedChild])

  if (!selectedChild) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        {children.length === 0 ? (
          <Card className="py-8">
            <div className="text-6xl mb-4">👋</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Create a profile first
            </h2>
            <p className="text-gray-600 mb-6">
              To start practicing words, you need to create a child profile.
            </p>
            <Button onClick={() => router.push('/onboarding')}>
              Create Profile
            </Button>
          </Card>
        ) : (
          <Card className="py-8">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Select a child
            </h2>
            <p className="text-gray-600 mb-6">
              Please select a child from the menu to start practicing words.
            </p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-lg">
          <span className="text-4xl">📚</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Word Quest</h1>
        <p className="text-gray-600">Practice reading words out loud!</p>
      </div>

      {/* Start Practice Card */}
      <Card className="mb-8 bg-gradient-to-br from-primary-50 to-secondary-50 border-2 border-primary-100">
        <div className="text-center py-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Ready to practice, {selectedChild.name}?
          </h2>
          <p className="text-gray-600 mb-2">
            Level:{' '}
            <span className="font-semibold text-primary-600">
              {selectedChild.reading_level}
            </span>
          </p>
          <p className="text-gray-500 text-sm mb-6">10 words per session</p>
          <div className="flex justify-center">
            <KidButton
              size="xl"
              onPress={() => {
                enterFullscreen()
                router.push('/games/word-quest/practice')
              }}
              aria-label="Start practice"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Start Practice
            </KidButton>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      {!loading && stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="text-center py-4">
            <div className="text-2xl md:text-3xl font-bold text-primary-600">
              {stats.totalWordsPracticed}
            </div>
            <div className="text-xs md:text-sm text-gray-600">
              Words Practiced
            </div>
          </Card>
          <Card className="text-center py-4">
            <div className="text-2xl md:text-3xl font-bold text-green-600">
              {stats.wordsLearned}
            </div>
            <div className="text-xs md:text-sm text-gray-600">Words Learned</div>
          </Card>
          <Card className="text-center py-4">
            <div className="text-2xl md:text-3xl font-bold text-secondary-600">
              {stats.recentSessions}
            </div>
            <div className="text-xs md:text-sm text-gray-600">Sessions</div>
          </Card>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin" />
          <p className="text-gray-500">Loading your progress...</p>
        </div>
      )}

      {/* Pet Section */}
      {pets.length > 0 && (
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">My Pets</h3>
            <button
              onClick={() => router.push('/games/pets')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              View All ({pets.length})
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {favoritePet && (
            <div className="max-w-[200px] mx-auto">
              <PetCard
                pet={favoritePet}
                onClick={() => router.push(`/games/pets/${favoritePet.id}`)}
              />
            </div>
          )}
          <p className="text-center text-sm text-gray-500 mt-4">
            Practice words to make {favoritePet?.name} happy!
          </p>
        </Card>
      )}

      {/* No pets yet - encourage practicing */}
      {pets.length === 0 && !loading && (
        <Card className="mb-8 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-100">
          <div className="text-center py-4">
            <div className="text-5xl mb-3">🐾</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Earn Your First Pet!</h3>
            <p className="text-gray-600 text-sm">
              Complete a practice session to unlock a special pet friend!
            </p>
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">How it works</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold">1</span>
            </div>
            <p className="text-gray-600">
              You&apos;ll see a word on the screen
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold">2</span>
            </div>
            <p className="text-gray-600">
              Tap the microphone button and read the word out loud
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold">3</span>
            </div>
            <p className="text-gray-600">
              If you say it correctly, you&apos;ll earn a star!
            </p>
          </div>
        </div>
      </Card>

      {/* Browser compatibility notice */}
      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <strong>Tip:</strong> Word Quest works best in Chrome or Edge
            browsers with a microphone — allow microphone access when asked. No
            working microphone? Use the <strong>Grown-up check</strong> panel
            below the word to mark each one yourself.
          </div>
        </div>
      </div>
    </div>
  )
}
