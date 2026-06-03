'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useChild } from '../../../ProtectedLayoutClient'
import { Button, Card } from '@/components/ui'
import { MyFindsGallery } from '../components/MyFindsGallery'
import { MasteredList } from '../components/MasteredList'

type Tab = 'finds' | 'mastered'

export default function MyFindsPage() {
  const { selectedChild } = useChild()
  const [tab, setTab] = useState<Tab>('finds')

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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {tab === 'finds' ? 'My Finds 📷' : 'Words I Mastered ⭐'}
          </h1>
          <p className="text-gray-600">
            {tab === 'finds'
              ? `Everything ${selectedChild.name} has found on hunts!`
              : `Clues ${selectedChild.name} mastered and graduated!`}
          </p>
        </div>
        <Link href="/games/scavenger-hunt">
          <Button variant="outline">New Hunt</Button>
        </Link>
      </div>

      {/* Tabs: scrapbook of photos vs. trophy shelf of mastered clues. */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('finds')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
            tab === 'finds'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          My Finds 📷
        </button>
        <button
          type="button"
          onClick={() => setTab('mastered')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
            tab === 'mastered'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Mastered ⭐
        </button>
      </div>

      {tab === 'finds' ? (
        <MyFindsGallery childId={selectedChild.id} />
      ) : (
        <MasteredList childId={selectedChild.id} />
      )}
    </div>
  )
}
