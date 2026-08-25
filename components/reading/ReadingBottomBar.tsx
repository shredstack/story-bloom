'use client'

import { KidButton } from '@/components/games/KidButton'

interface ReadingBottomBarProps {
  /** With the guide off, only the settings gear shows. */
  guideOn: boolean
  onBack: () => void
  onNext: () => void
  onSay: () => void
  onOpenSettings: () => void
  /** Line controls are dead until the line model is measured. */
  disabled?: boolean
  /** No word placed yet, or the guide is on a punctuation-only token. */
  canSay?: boolean
  speaking?: boolean
  /**
   * Shown above the buttons when a word could not be spoken. Silence here is
   * indistinguishable from a broken button, which is exactly how the Fire
   * tablet bug went unnoticed.
   */
  message?: string | null
}

/**
 * The kid-facing control surface (spec §5.7).
 *
 *   [ ← Back ]   [ 🔊 Say it ]   [ Next line → ]   [⚙]
 *
 * "Say it" is the PRIMARY path to hearing a word — double-tap is the shortcut
 * for a child who has found it. A button needs no gesture knowledge at all,
 * which is the whole reason it is here.
 *
 * Reuses KidButton for hit-slop, tap debounce and haptics. Deliberately `md`
 * (64pt) rather than the `lg` (80pt) the spec called for: at `lg` the labels
 * render at 1.25rem, which is the same size as the story text at the default
 * "large" setting — the controls competed with the reading for visual weight.
 * 64pt is still far above the 44pt minimum, and hit-slop extends the real
 * target past the visible button.
 */
export function ReadingBottomBar({
  guideOn,
  onBack,
  onNext,
  onSay,
  onOpenSettings,
  disabled = false,
  canSay = false,
  speaking = false,
  message = null,
}: ReadingBottomBarProps) {
  return (
    <div
      className="no-print sticky bottom-0 z-30 mt-6 -mx-4 px-4 pt-2
                 bg-white/95 backdrop-blur border-t border-gray-100"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      {message && (
        <p
          role="status"
          className="mb-2 text-center text-sm font-semibold text-amber-700"
        >
          {message}
        </p>
      )}

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {guideOn && (
          <KidButton
            size="md"
            variant="quiet"
            onPress={onBack}
            disabled={disabled}
            aria-label="Back a line"
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </KidButton>
        )}

        {guideOn && (
          <KidButton
            size="md"
            variant="secondary"
            onPress={onSay}
            disabled={disabled || !canSay}
            aria-label="Say the highlighted word"
            className={speaking ? 'animate-trick-pulse' : ''}
          >
            <span aria-hidden>🔊</span>
            <span>Say it</span>
          </KidButton>
        )}

        {guideOn && (
          <KidButton
            size="md"
            onPress={onNext}
            disabled={disabled}
            aria-label="Next line"
          >
            <span>Next line</span>
            <span aria-hidden>→</span>
          </KidButton>
        )}

        <KidButton
          size="md"
          variant="quiet"
          onPress={onOpenSettings}
          aria-label="Reading settings"
        >
          <span aria-hidden>⚙</span>
        </KidButton>
      </div>
    </div>
  )
}
