'use client'

import { useEffect, useState } from 'react'
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
// decoding the prompt IS the reading practice. For Pre-K (non-readers), a hint leads
// above the text so they know what the word says; the text stays below (print
// exposure still matters). For single-color clues ("Find something pink") the hint is
// a plain color swatch — the color itself, not a (misleading) picture of one object.
// Otherwise it's the AI picture hint. Both are null for everyone but Pre-K.
export function PromptCard({ prompt }: PromptCardProps) {
  const { fontSize } = useFontSize()
  const badge = LOCATION_BADGE[prompt.location] || LOCATION_BADGE.either

  // A broken/missing image must never block play — fall back to text-only.
  const [imageOk, setImageOk] = useState(true)
  useEffect(() => {
    setImageOk(true) // reset when the clue changes
  }, [prompt.imageUrl])

  // A color swatch supersedes the picture hint for color clues.
  const showSwatch = !!prompt.hintColor
  const showImage = !showSwatch && !!prompt.imageUrl && imageOk

  return (
    <Card className="p-8 text-center bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
      <div className="inline-flex items-center gap-1 px-3 py-1 mb-6 rounded-full bg-white/70 text-sm font-medium text-amber-800">
        <span>{badge.emoji}</span>
        <span>{badge.label}</span>
      </div>

      {showSwatch && (
        <div className="mb-6 flex justify-center">
          <div
            aria-hidden
            style={{ backgroundColor: prompt.hintColor as string }}
            className="w-48 h-48 sm:w-56 sm:h-56 rounded-3xl shadow-md border-2 border-amber-200"
          />
        </div>
      )}

      {showImage && (
        <div className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={prompt.imageUrl as string}
            alt=""
            aria-hidden
            onError={() => setImageOk(false)}
            className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-3xl bg-white shadow-md border-2 border-amber-200"
          />
        </div>
      )}

      <p
        className={`font-extrabold text-gray-900 tracking-wide leading-snug ${FONT_SIZE_CLASSES[fontSize]}`}
        style={{ fontSize: 'clamp(1.75rem, 7vw, 3rem)' }}
      >
        {prompt.promptText}
      </p>
    </Card>
  )
}
