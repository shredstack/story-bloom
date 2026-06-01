'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui'
import type { ScavengerHuntFind } from '@/lib/types'

interface MyFindsGalleryProps {
  childId: string
}

// Kid-facing scrapbook: a grid of the verified, safe photos the child has found.
export function MyFindsGallery({ childId }: MyFindsGalleryProps) {
  const [finds, setFinds] = useState<ScavengerHuntFind[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/scavenger-hunt/finds?childId=${childId}&matchedOnly=true&view=kid`
        )
        if (res.ok) {
          const { finds: data } = await res.json()
          if (!cancelled) setFinds(data || [])
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
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
      </div>
    )
  }

  if (finds.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-5xl mb-3">📷</div>
        <h3 className="text-xl font-semibold mb-2">No finds yet!</h3>
        <p className="text-gray-600">
          Go on a hunt and snap photos of what you find. They&apos;ll show up here!
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {finds.map((find) => (
        <div
          key={find.id}
          className="rounded-2xl overflow-hidden bg-white shadow-md border border-gray-100"
        >
          <div className="aspect-square bg-gray-100 overflow-hidden">
            {find.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={find.photo_url}
                alt={find.prompt_text}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                🖼️
              </div>
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-medium text-gray-700 line-clamp-2">
              {find.prompt_text}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
