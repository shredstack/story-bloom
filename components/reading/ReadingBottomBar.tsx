'use client'

import type { ReactNode } from 'react'
import { KidButton } from '@/components/games/KidButton'

interface ReadingBottomBarProps {
  onBack: () => void
  onNext: () => void
  disabled?: boolean
  /** Extra controls (Say it, settings) added in later phases. */
  children?: ReactNode
}

/**
 * The primary line control (spec §5.7).
 *
 * This exists for the child who finds any dragging hard: two enormous targets
 * that never fight the scroller and need no gesture knowledge at all. Reuses
 * KidButton for the 80pt target, hit-slop, tap debounce and haptics.
 */
export function ReadingBottomBar({
  onBack,
  onNext,
  disabled = false,
  children,
}: ReadingBottomBarProps) {
  return (
    <div
      className="no-print sticky bottom-0 z-30 mt-6 -mx-4 px-4 pt-3
                 bg-white/95 backdrop-blur border-t border-gray-100"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <KidButton
          size="lg"
          variant="quiet"
          onPress={onBack}
          disabled={disabled}
          aria-label="Back a line"
        >
          <span aria-hidden>←</span>
          <span>Back</span>
        </KidButton>

        {children}

        <KidButton
          size="lg"
          onPress={onNext}
          disabled={disabled}
          aria-label="Next line"
        >
          <span>Next line</span>
          <span aria-hidden>→</span>
        </KidButton>
      </div>
    </div>
  )
}
