'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'

interface MasteredPrompt {
  promptId: string
  promptText: string
  imageUrl: string | null
  masteredAt: string | null
}

interface MasteredListProps {
  childId: string
}

// Kid-facing trophy shelf: clues the child has mastered (found 3x, never flagged
// tricky) and that are now retired from rotation. Celebratory, not utilitarian.
export function MasteredList({ childId }: MasteredListProps) {
  const [mastered, setMastered] = useState<MasteredPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/scavenger-hunt/mastered?childId=${childId}`)
        if (res.ok) {
          const { mastered: data } = await res.json()
          if (!cancelled) setMastered(data || [])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    if (childId) load()
    return () => {
      cancelled = true
    }
  }, [childId])

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
      </div>
    )
  }

  if (mastered.length === 0) {
    return (
      <Card className="p-6 text-center bg-amber-50 border-amber-200">
        <div className="text-4xl mb-2">⭐</div>
        <p className="text-gray-600">
          Find a clue 3 times to add it to your trophy shelf!
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {mastered.map((m) => (
        <div
          key={m.promptId}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md border-2 border-amber-200 p-3 text-center"
        >
          <div className="absolute top-1 right-1 text-lg" aria-hidden>
            ⭐
          </div>
          {m.imageUrl && (
            <div className="flex justify-center mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.imageUrl}
                alt=""
                aria-hidden
                className="w-20 h-20 object-contain rounded-xl bg-white"
                loading="lazy"
              />
            </div>
          )}
          <p className="text-sm font-semibold text-amber-900 line-clamp-3">
            {m.promptText}
          </p>
        </div>
      ))}
    </div>
  )
}
