'use client'

import type { ReadingMaterial } from '@/lib/types'
import { Card, Button } from '@/components/ui'
import { KidButton } from '@/components/games/KidButton'

interface MaterialCardProps {
  material: ReadingMaterial & {
    last_practiced_at?: string | null
    total_sessions?: number
  }
  onPractice: () => void
  onEdit: () => void
}

export function MaterialCard({ material, onPractice, onEdit }: MaterialCardProps) {
  const lastPracticedDate = material.last_practiced_at
    ? new Date(material.last_practiced_at)
    : null

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {/* Icon/Image */}
        <div className="w-16 h-16 rounded-xl bg-secondary-100 flex items-center justify-center flex-shrink-0">
          {material.image_url ? (
            <img
              src={material.image_url}
              alt={material.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <span className="text-2xl">📄</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-800 truncate">{material.name}</h4>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{material.sentence_count} sentences</span>
            {lastPracticedDate && (
              <>
                <span className="text-gray-300">•</span>
                <span>Last practiced: {formatDate(lastPracticedDate)}</span>
              </>
            )}
          </div>
          {material.description && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {material.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Button>
          <KidButton size="md" variant="secondary" onPress={onPractice} aria-label="Practice this material">
            Practice
          </KidButton>
        </div>
      </div>
    </Card>
  )
}
