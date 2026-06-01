'use client'

import { Card } from '@/components/ui'
import { useFontSize } from '@/lib/hooks/useFontSize'
import { FONT_SIZE_CLASSES, type ScavengerHuntPrompt } from '@/lib/types'

interface PromptCardProps {
  prompt: ScavengerHuntPrompt
}

const LOCATION_BADGE: Record<string, { emoji: string; label: string }> = {
  indoor: { emoji: '🏠', label: 'Inside' },
  outdoor: { emoji: '🌳', label: 'Outside' },
  either: { emoji: '✨', label: 'Anywhere' },
}

// The reading moment: large, high-contrast, dyslexia-friendly. No read-aloud —
// decoding the prompt IS the reading practice.
export function PromptCard({ prompt }: PromptCardProps) {
  const { fontSize } = useFontSize()
  const badge = LOCATION_BADGE[prompt.location] || LOCATION_BADGE.either

  return (
    <Card className="p-8 text-center bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
      <div className="inline-flex items-center gap-1 px-3 py-1 mb-6 rounded-full bg-white/70 text-sm font-medium text-amber-800">
        <span>{badge.emoji}</span>
        <span>{badge.label}</span>
      </div>

      <p
        className={`font-extrabold text-gray-900 tracking-wide leading-snug ${FONT_SIZE_CLASSES[fontSize]}`}
        style={{ fontSize: 'clamp(1.75rem, 7vw, 3rem)' }}
      >
        {prompt.promptText}
      </p>
    </Card>
  )
}
