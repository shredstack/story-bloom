'use client'

import { useCallback } from 'react'
import { ReadingSurface, ReadingGutterHandle } from '@/components/reading'
import type { ReadingGuideApi } from '@/lib/hooks/useReadingGuide'
import type { Paragraph, ReadingPreferences } from '@/lib/reading/types'
import type { SentenceWordResult } from '@/lib/types'

interface SentenceCardProps {
  sentence: string
  status: 'idle' | 'listening' | 'processing' | 'success' | 'error'
  lastResult: 'correct' | 'incorrect' | null
  wordResults?: SentenceWordResult[]
  accuracy?: number
  /** Per-child typography + highlight colors. */
  preferences: ReadingPreferences
  /** The finger-controlled highlighter. */
  guide: ReadingGuideApi
  surfaceRef: React.RefObject<HTMLDivElement>
  /** Pre-tokenized `sentence`, from useGuidedReading. */
  paragraphs: Paragraph[]
}

export function SentenceCard({
  sentence,
  status,
  lastResult,
  wordResults,
  accuracy,
  preferences,
  guide,
  surfaceRef,
  paragraphs,
}: SentenceCardProps) {
  // Determine card styling based on status and result
  const getCardClasses = () => {
    const base = 'rounded-3xl p-4 md:p-6 transition-all duration-300 shadow-lg'

    if (lastResult === 'correct') {
      return `${base} bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200`
    }
    if (lastResult === 'incorrect') {
      return `${base} bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200`
    }
    if (status === 'listening') {
      return `${base} bg-gradient-to-br from-secondary-50 to-primary-50 border-2 border-secondary-200`
    }
    return `${base} bg-white border-2 border-gray-100`
  }

  /**
   * Result coloring, by word index.
   *
   * Word index and `SentenceWordResult.position` are both a whitespace split
   * of the same sentence, so they line up. COLOR ONLY: the surface measures
   * these spans, and a class that changed their box would leave the guide
   * pointing at stale rects (see ReadingSurface's `wordClassName`).
   */
  const wordClassName = useCallback(
    (index: number) => {
      if (!wordResults || wordResults.length === 0 || !lastResult) return undefined
      const result = wordResults.find((r) => r.position === index)
      // A word with no result is one the aligner never reached — leave it as
      // plain body text rather than claiming she got it right.
      if (!result) return undefined
      return result.correct ? 'text-green-700' : 'text-red-600 font-bold'
    },
    [wordResults, lastResult]
  )

  return (
    <div className={getCardClasses()}>
      {/* Result indicator */}
      {lastResult && (
        <div className="flex items-center justify-center mb-4">
          {lastResult === 'correct' ? (
            <div className="flex items-center gap-2 text-green-600">
              <span className="text-2xl">⭐</span>
              <span className="font-semibold">Great job!</span>
              {accuracy !== undefined && (
                <span className="text-sm">({accuracy}% accurate)</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <span className="text-2xl">🔄</span>
              <span className="font-semibold">Keep trying!</span>
              {accuracy !== undefined && (
                <span className="text-sm">({accuracy}% accurate)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sentence text — same reading surface as the story reader, so her
          typography, highlight color and finger-tracking all carry over. */}
      <ReadingSurface
        surfaceRef={surfaceRef}
        content={sentence}
        paragraphs={paragraphs}
        preferences={preferences}
        guide={guide}
        wordClassName={wordClassName}
        className="rounded-2xl py-4 pr-4"
      >
        {guide.isReady && <ReadingGutterHandle guide={guide} />}
      </ReadingSurface>

      {/* Listening indicator */}
      {status === 'listening' && (
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-2 text-secondary-600">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-secondary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-secondary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-secondary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm font-medium">Listening...</span>
          </div>
        </div>
      )}
    </div>
  )
}
