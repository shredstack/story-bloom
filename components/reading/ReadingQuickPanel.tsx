'use client'

import { KidButton } from '@/components/games/KidButton'
import { HIGHLIGHT_PRESETS } from '@/lib/reading/defaults'
import type {
  HighlightPreset,
  PartialReadingPreferences,
  ReadingGuideMode,
  ReadingPreferences,
} from '@/lib/reading/types'
import type { FontSize } from '@/lib/types'

interface ReadingQuickPanelProps {
  value: ReadingPreferences
  onChange: (patch: PartialReadingPreferences) => void
  onClose: () => void
}

/** Emoji-forward so it reads without decoding a label. */
const MODE_CHOICES: { value: ReadingGuideMode; label: string; emoji: string }[] = [
  { value: 'line', label: 'Line', emoji: '▭' },
  { value: 'line-word', label: 'Line + word', emoji: '▬' },
  { value: 'word', label: 'Word', emoji: '▪' },
  { value: 'mask', label: 'Spotlight', emoji: '🔦' },
]

const SIZE_CHOICES: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'A' },
  { value: 'medium', label: 'A+' },
  { value: 'large', label: 'A++' },
  { value: 'extra-large', label: 'A+++' },
]

/**
 * The kid-safe panel behind the ⚙ in the bottom bar (spec §5.7).
 *
 * FOUR controls, big targets, no paragraphs of text. Everything with a real
 * consequence — typography, touch offset, calibration — stays behind the
 * parent PIN.
 */
export function ReadingQuickPanel({
  value,
  onChange,
  onClose,
}: ReadingQuickPanelProps) {
  const guideOn = value.guideMode !== 'off'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Guide on/off */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-extrabold text-gray-800">Reading helper</span>
          <KidButton
            size="md"
            variant={guideOn ? 'success' : 'quiet'}
            onPress={() =>
              onChange({ guideMode: guideOn ? 'off' : 'line-word' })
            }
            aria-label={guideOn ? 'Turn the reading helper off' : 'Turn the reading helper on'}
          >
            {guideOn ? 'On' : 'Off'}
          </KidButton>
        </div>

        {guideOn && (
          <>
            {/* 2. Mode */}
            <div>
              <p className="text-sm font-bold text-gray-500 mb-2">Highlight</p>
              <div className="grid grid-cols-4 gap-2">
                {MODE_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => onChange({ guideMode: choice.value })}
                    aria-label={choice.label}
                    aria-pressed={value.guideMode === choice.value}
                    className={`min-h-[64px] rounded-2xl text-2xl border-4 transition-colors ${
                      value.guideMode === choice.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span aria-hidden>{choice.emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Color — a favorite, nothing more. */}
            <div>
              <p className="text-sm font-bold text-gray-500 mb-2">Color</p>
              <div className="flex gap-2">
                {(Object.keys(HIGHLIGHT_PRESETS) as HighlightPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onChange({ highlightPreset: preset })}
                    aria-label={preset}
                    aria-pressed={value.highlightPreset === preset}
                    className={`flex-1 min-h-[64px] rounded-2xl border-4 transition-colors ${
                      value.highlightPreset === preset
                        ? 'border-primary-500'
                        : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: HIGHLIGHT_PRESETS[preset].word }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* 4. Text size */}
        <div>
          <p className="text-sm font-bold text-gray-500 mb-2">Text size</p>
          <div className="grid grid-cols-4 gap-2">
            {SIZE_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                onClick={() => onChange({ fontSize: choice.value })}
                aria-label={`Text size ${choice.label}`}
                aria-pressed={value.fontSize === choice.value}
                className={`min-h-[64px] rounded-2xl font-extrabold border-4 transition-colors ${
                  value.fontSize === choice.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <KidButton size="lg" fullWidth onPress={onClose}>
          Done
        </KidButton>
      </div>
    </div>
  )
}
