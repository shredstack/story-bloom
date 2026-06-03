'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useChild } from '../../ProtectedLayoutClient'
import { Button, Card } from '@/components/ui'
import { KidButton } from '@/components/games/KidButton'
import { CashTracker } from '../word-rescue/components/CashTracker'
import { enterFullscreen } from '@/lib/fullscreen'
import type { ScavengerLocation } from '@/lib/types'

const LOCATION_OPTIONS: {
  value: ScavengerLocation
  label: string
  emoji: string
  blurb: string
}[] = [
  { value: 'indoor', label: 'Inside', emoji: '🏠', blurb: 'Hunt around the house' },
  { value: 'outdoor', label: 'Outside', emoji: '🌳', blurb: 'Hunt in the yard' },
  { value: 'either', label: 'Anywhere', emoji: '✨', blurb: 'Inside or outside' },
]

export default function ScavengerHuntPage() {
  const router = useRouter()
  const { selectedChild } = useChild()
  const [location, setLocation] = useState<ScavengerLocation>('either')

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

  const startHunt = () => {
    // Request fullscreen from this tap (gesture-gated) so the hunt fills the
    // tablet screen; the immersive hook drops out of fullscreen when it ends.
    enterFullscreen()
    router.push(`/games/scavenger-hunt/practice?location=${location}`)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🔎</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scavenger Hunt</h1>
        <p className="text-gray-600">
          Read the clue, find the thing, snap a photo — and earn cash!
        </p>
      </div>

      <div className="mb-6">
        <CashTracker childId={selectedChild.id} />
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-center">
          Where are you hunting?
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {LOCATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLocation(opt.value)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                location === opt.value
                  ? 'border-purple-500 bg-purple-50 scale-[1.03]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-1">{opt.emoji}</div>
              <div className="font-semibold text-gray-800">{opt.label}</div>
              <div className="text-xs text-gray-500">{opt.blurb}</div>
            </button>
          ))}
        </div>
      </Card>

      <KidButton size="xl" fullWidth className="mb-4" onPress={startHunt} aria-label="Start the hunt">
        Start the Hunt! 🚀
      </KidButton>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/games/scavenger-hunt/finds">
          <Button variant="outline" className="w-full sm:w-auto">
            📷 My Finds
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
