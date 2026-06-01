'use client'

import { useRouter } from 'next/navigation'
import { useChild } from '../ProtectedLayoutClient'
import { Button, Card } from '@/components/ui'
import { PetCard } from '@/components/word-quest'
import { usePets } from '@/lib/hooks/usePets'
import { useStrugglingWords } from '@/lib/hooks/useStrugglingWords'

interface GameCardProps {
  title: string
  description: string
  icon: string
  href: string
  color: string
  available: boolean
  badge?: number
}

function GameCard({ title, description, icon, href, color, available, badge }: GameCardProps) {
  const router = useRouter()

  return (
    <Card
      className={`
        relative overflow-hidden cursor-pointer transition-all duration-200
        ${available ? 'hover:shadow-lg hover:scale-[1.02]' : 'opacity-60'}
      `}
      onClick={() => available && router.push(href)}
    >
      <div className={`absolute top-0 left-0 right-0 h-2 ${color}`} />
      {badge !== undefined && badge > 0 && (
        <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </div>
      )}
      <div className="pt-6 pb-4 px-4 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        {available ? (
          <Button
            size="sm"
            className={`${color.replace('bg-', 'bg-opacity-90 ')}`}
          >
            Play Now
          </Button>
        ) : (
          <span className="inline-block px-4 py-2 bg-gray-100 text-gray-500 rounded-full text-sm font-medium">
            Coming Soon
          </span>
        )}
      </div>
    </Card>
  )
}

export default function GamesPage() {
  const router = useRouter()
  const { selectedChild, children } = useChild()
  const { pets, favoritePet } = usePets({ childId: selectedChild?.id || '' })
  const { words: strugglingWords } = useStrugglingWords({
    childId: selectedChild?.id || '',
    autoFetch: !!selectedChild,
  })

  // Count words that need practice (not mastered yet)
  const wordsNeedingPractice = strugglingWords.filter(
    (w) => w.current_stage !== 'mastered'
  ).length

  if (!selectedChild) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        {children.length === 0 ? (
          <Card className="py-8">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Create a profile first
            </h2>
            <p className="text-gray-600 mb-6">
              To start playing games, you need to create a child profile.
            </p>
            <Button onClick={() => router.push('/onboarding')}>
              Create Profile
            </Button>
          </Card>
        ) : (
          <Card className="py-8">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Select a child
            </h2>
            <p className="text-gray-600 mb-6">
              Please select a child from the menu to start playing games.
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
          <span className="text-4xl">🎮</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Games</h1>
        <p className="text-gray-600">
          Practice reading and earn rewards, {selectedChild.name}!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <GameCard
          title="Word Quest"
          description="Practice reading sight words out loud and earn pet rewards!"
          icon="🎤"
          href="/games/word-quest"
          color="bg-primary-500"
          available={true}
        />
        <GameCard
          title="Sentence Shenanigans"
          description="Scan worksheets and practice reading full sentences for extra rewards!"
          icon="📖"
          href="/games/sentence-shenanigans"
          color="bg-secondary-500"
          available={true}
        />
        <GameCard
          title="Word Rescue"
          description="Practice tricky words with your pet buddy and earn cash rewards!"
          icon="🆘"
          href="/games/word-rescue"
          color="bg-amber-500"
          available={wordsNeedingPractice > 0}
          badge={wordsNeedingPractice}
        />
        <GameCard
          title="Scavenger Hunt"
          description="Read a clue, find the thing, snap a photo, and earn cash!"
          icon="🔎"
          href="/games/scavenger-hunt"
          color="bg-emerald-500"
          available={true}
        />
      </div>

      {/* My Pets Section */}
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
            Play games to make {favoritePet?.name} happy!
          </p>
        </Card>
      )}

      {/* How Games Work */}
      <Card className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4">How Games Work</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-center p-4">
            <div className="text-3xl mb-2">🎯</div>
            <h4 className="font-semibold text-gray-800 mb-1">Practice</h4>
            <p className="text-sm text-gray-600">
              Read words or sentences out loud using your microphone
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-2">⭐</div>
            <h4 className="font-semibold text-gray-800 mb-1">Score</h4>
            <p className="text-sm text-gray-600">
              Get accuracy scores and track your progress over time
            </p>
          </div>
          <div className="text-center p-4">
            <div className="text-3xl mb-2">🐾</div>
            <h4 className="font-semibold text-gray-800 mb-1">Earn</h4>
            <p className="text-sm text-gray-600">
              Unlock and level up virtual pets as rewards for practicing!
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
            <strong>Tip:</strong> Games work best in Chrome or Edge browsers
            with a microphone. Make sure to allow microphone access when asked!
          </div>
        </div>
      </div>
    </div>
  )
}
