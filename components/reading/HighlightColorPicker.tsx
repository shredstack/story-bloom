'use client'

import { HIGHLIGHT_PRESETS } from '@/lib/reading/defaults'
import type { HighlightPreset } from '@/lib/reading/types'

const PRESET_LABELS: Record<HighlightPreset, string> = {
  butter: 'Butter',
  mint: 'Mint',
  peach: 'Peach',
  sky: 'Sky',
  lavender: 'Lavender',
}

interface HighlightColorPickerProps {
  value: HighlightPreset
  onChange: (preset: HighlightPreset) => void
  /** Names the child in the label, e.g. "Ellie's highlighter color". */
  childName?: string
  /** Hide the label + hint when the surrounding form supplies its own. */
  bare?: boolean
  className?: string
}

/**
 * Per-child highlighter color. Shared by the child's profile form and
 * `ReadingSettingsPanel` (CLAUDE.md: one component, controlled by the parent)
 * so the two can never drift apart.
 *
 * Each swatch shows BOTH colors of the preset — the soft line band on the left
 * and the stronger word highlight on the right — because those are what she
 * actually sees, and picking from a single averaged chip is a guess.
 *
 * Copy note (spec §2.2): this is a preference, never a reading aid. The
 * evidence for colored overlays does not support a claim that any of these
 * helps her read better, so the hint says "favorite" and nothing more.
 */
export function HighlightColorPicker({
  value,
  onChange,
  childName,
  bare = false,
  className = '',
}: HighlightColorPickerProps) {
  const presets = Object.keys(HIGHLIGHT_PRESETS) as HighlightPreset[]

  return (
    <div className={className}>
      {!bare && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {childName ? `${childName}'s highlighter color` : 'Highlighter color'}
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const colors = HIGHLIGHT_PRESETS[preset]
          const selected = value === preset

          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-label={PRESET_LABELS[preset]}
              aria-pressed={selected}
              className={`flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl border-2 transition-colors ${
                selected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="flex rounded-md overflow-hidden border border-gray-200">
                <span
                  className="w-4 h-6 block"
                  style={{ backgroundColor: colors.band }}
                />
                <span
                  className="w-4 h-6 block"
                  style={{ backgroundColor: colors.word }}
                />
              </span>
              <span className="text-sm font-medium text-gray-700">
                {PRESET_LABELS[preset]}
              </span>
            </button>
          )
        })}
      </div>

      {!bare && (
        <p className="mt-1.5 text-xs text-gray-500">
          Pick a favorite. This can also be changed from the ⚙ in the reader
          while reading, and that choice is saved back here.
        </p>
      )}
    </div>
  )
}
