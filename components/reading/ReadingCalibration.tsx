'use client'

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { KidButton } from '@/components/games/KidButton'
import { cssVars } from '@/lib/reading/cssVars'
import {
  MAX_TOUCH_OFFSET_LINES,
  MIN_TOUCH_OFFSET_LINES,
  TOUCH_OFFSET_CHOICES,
} from '@/lib/reading/defaults'
import type { ReadingPreferences } from '@/lib/reading/types'

interface ReadingCalibrationProps {
  preferences: ReadingPreferences
  /** Called with the measured offset, in lines. */
  onDone: (touchOffsetLines: number) => void
  onSkip: () => void
}

const SAMPLE_LINES = [
  'The cat sat on the mat.',
  'Put your finger here.',
  'The dog ran to the park.',
]
const MIDDLE = 1

/** Snap to the same three values the parent picker exposes. */
function snapToChoice(value: number): number {
  return TOUCH_OFFSET_CHOICES.reduce((closest, choice) =>
    Math.abs(choice.value - value) < Math.abs(closest.value - value) ? choice : closest
  ).value
}

function labelFor(value: number): string {
  return (
    TOUCH_OFFSET_CHOICES.find((choice) => choice.value === value)?.label ??
    'Just above my finger'
  )
}

/**
 * First-run touch-offset calibration (spec §5.3).
 *
 * A child who rests her finger UNDER the line she is reading needs the guide
 * to sit above her fingertip; a child who points directly at a word does not.
 * This measures which one she is by asking her to touch a line we already know
 * the position of, and taking the vertical distance she lands below it.
 *
 * Small amount of work, but it is the difference between "magic" and "broken"
 * for a specific pair of hands. Skippable and re-runnable from settings.
 */
export function ReadingCalibration({
  preferences,
  onDone,
  onSkip,
}: ReadingCalibrationProps) {
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const [measured, setMeasured] = useState<number | null>(null)
  const [usedMouse, setUsedMouse] = useState(false)

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()

    // Mouse and trackpad occlude nothing, so their offset is always 0. Say so
    // rather than recording a meaningless measurement.
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') {
      setUsedMouse(true)
      setMeasured(0)
      return
    }

    const target = lineRefs.current[MIDDLE]
    if (!target) return
    const rect = target.getBoundingClientRect()
    const lineHeight = rect.height || 1
    const middleCenter = rect.top + rect.height / 2

    // How far BELOW the target line she landed, in lines. Landing on it or
    // above it means she points at what she means — offset 0.
    const delta = (e.clientY - middleCenter) / lineHeight
    const clamped = Math.min(
      MAX_TOUCH_OFFSET_LINES,
      Math.max(MIN_TOUCH_OFFSET_LINES, delta)
    )
    setUsedMouse(false)
    setMeasured(snapToChoice(clamped))
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Quick finger check</h2>
        <p className="text-gray-600 mb-5">
          Put your finger on the <strong>middle line</strong>.
        </p>

        <div
          onPointerDown={handlePointerDown}
          className="rounded-2xl border-2 border-dashed border-primary-200 overflow-hidden
                     select-none touch-none cursor-pointer"
        >
          {/* The vars must sit on the .reading-surface element itself: the
              class declares its own fallback values, which would otherwise
              override anything inherited from an ancestor. */}
          <div
            className="reading-surface p-5"
            style={cssVars(preferences) as React.CSSProperties}
          >
            {SAMPLE_LINES.map((line, i) => (
              <p
                key={line}
                ref={(el) => {
                  lineRefs.current[i] = el
                }}
                className={`reading-paragraph ${
                  measured !== null && i === MIDDLE ? 'rounded-md' : ''
                }`}
                style={
                  measured !== null && i === MIDDLE
                    ? { background: 'var(--rg-band-color)' }
                    : undefined
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {measured !== null && (
          <p className="mt-4 text-sm text-gray-600">
            {usedMouse
              ? 'Looks like you used a mouse — the highlight will sit right on the word. Try this on the tablet to set it up for her finger.'
              : `Got it. The highlight will sit: ${labelFor(measured).toLowerCase()}.`}
          </p>
        )}

        <div className="flex gap-3 mt-6 justify-end flex-wrap">
          <KidButton size="md" variant="quiet" onPress={onSkip}>
            Skip
          </KidButton>
          {measured !== null && (
            <>
              <KidButton size="md" variant="quiet" onPress={() => setMeasured(null)}>
                Try again
              </KidButton>
              <KidButton size="md" onPress={() => onDone(measured)}>
                All set
              </KidButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
