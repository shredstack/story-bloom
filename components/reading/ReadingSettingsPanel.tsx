'use client'

import type { ReactNode } from 'react'
import {
  HIGHLIGHT_PRESETS,
  PAGE_TINT,
  TOUCH_OFFSET_CHOICES,
} from '@/lib/reading/defaults'
import type {
  ColumnWidth,
  HighlightPreset,
  LineHeightStep,
  MaskLines,
  MaskStrength,
  PageTint,
  ParagraphGap,
  PartialReadingPreferences,
  ReadingFontFamily,
  ReadingGuideMode,
  ReadingPreferences,
  SpacingStep,
} from '@/lib/reading/types'
import type { FontSize } from '@/lib/types'
import { ReadingSurface } from './ReadingSurface'

const PREVIEW_TEXT =
  'The little fox ran down the path. She stopped by the old gate and looked back at the ' +
  'quiet house on the hill.\n\nThen she went home for supper.'

interface ReadingSettingsPanelProps {
  value: ReadingPreferences
  onChange: (patch: PartialReadingPreferences) => void
  /** Optional "Start over" affordance; hidden when not provided. */
  onReset?: () => void
  /** Re-run the first-run touch-offset calibration. */
  onRecalibrate?: () => void
  childName?: string
}

// ---------------------------------------------------------------- primitives

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

interface ChoiceRowProps<T extends string | number> {
  options: { value: T; label: string }[]
  value: T
  onSelect: (value: T) => void
}

/** Segmented picker. Discrete steps beat sliders for this whole settings set. */
function ChoiceRow<T extends string | number>({
  options,
  value,
  onSelect,
}: ChoiceRowProps<T>) {
  return (
    <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onSelect(option.value)}
          className={`flex-1 min-w-[5.5rem] px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
            value === option.value
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SwatchRow({
  swatches,
  value,
  onSelect,
}: {
  swatches: { value: string; label: string; colors: string[] }[]
  value: string
  onSelect: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((swatch) => (
        <button
          key={swatch.value}
          type="button"
          onClick={() => onSelect(swatch.value)}
          aria-label={swatch.label}
          aria-pressed={value === swatch.value}
          className={`flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl border-2 transition-colors ${
            value === swatch.value
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="flex rounded-md overflow-hidden border border-gray-200">
            {swatch.colors.map((color) => (
              <span
                key={color}
                className="w-4 h-6 block"
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
          <span className="text-sm font-medium text-gray-700">{swatch.label}</span>
        </button>
      ))}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded border-gray-300"
      />
      <span>
        <span className="block text-sm font-semibold text-gray-700">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-2">
      {children}
    </h3>
  )
}

// ------------------------------------------------------------------- options

const GUIDE_MODE_OPTIONS: { value: ReadingGuideMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'line', label: 'Line' },
  { value: 'line-word', label: 'Line + word' },
  { value: 'word', label: 'Word' },
  { value: 'mask', label: 'Spotlight' },
]

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'A' },
  { value: 'medium', label: 'A+' },
  { value: 'large', label: 'A++' },
  { value: 'extra-large', label: 'A+++' },
]

const SPACING_OPTIONS: { value: SpacingStep; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'roomy', label: 'Roomy' },
  { value: 'extra-roomy', label: 'Extra roomy' },
]

const LINE_HEIGHT_OPTIONS: { value: LineHeightStep; label: string }[] = [
  { value: 1.5, label: 'Tight' },
  { value: 1.8, label: 'Open' },
  { value: 2.1, label: 'Airy' },
]

const COLUMN_OPTIONS: { value: ColumnWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'medium', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
]

const PARAGRAPH_GAP_OPTIONS: { value: ParagraphGap; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const FONT_FAMILY_OPTIONS: { value: ReadingFontFamily; label: string }[] = [
  { value: 'nunito', label: 'Nunito' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'opendyslexic', label: 'OpenDyslexic' },
]

const MASK_LINE_OPTIONS: { value: MaskLines; label: string }[] = [
  { value: 1, label: '1 line' },
  { value: 3, label: '3 lines' },
  { value: 5, label: '5 lines' },
]

const MASK_STRENGTH_OPTIONS: { value: MaskStrength; label: string }[] = [
  { value: 'soft', label: 'A little' },
  { value: 'strong', label: 'A lot' },
]

const TINT_LABELS: Record<PageTint, string> = {
  white: 'White',
  cream: 'Cream',
  mint: 'Mint',
  sky: 'Sky',
  peach: 'Peach',
}

const PRESET_LABELS: Record<HighlightPreset, string> = {
  butter: 'Butter',
  mint: 'Mint',
  peach: 'Peach',
  sky: 'Sky',
  lavender: 'Lavender',
}

// --------------------------------------------------------------------- panel

/**
 * Full parent-facing reading settings, per child. Controlled component: the
 * parent page owns the value and receives a sparse patch (CLAUDE.md).
 *
 * Copy note (spec §2.2): the page tint is described as glare comfort and the
 * highlight colors as preference. Neither may be described as improving
 * reading ability — the evidence for coloured overlays does not support that
 * claim, and over-claiming here would be actively misleading to a parent.
 */
export function ReadingSettingsPanel({
  value,
  onChange,
  onReset,
  onRecalibrate,
  childName,
}: ReadingSettingsPanelProps) {
  const guideOn = value.guideMode !== 'off'

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ live preview ---- */}
      <div>
        <SectionHeading>Preview</SectionHeading>
        <p className="text-xs text-gray-500 mt-2 mb-3">
          This updates as you change the settings below.
        </p>
        <div className="rounded-2xl border-2 border-gray-100 overflow-hidden">
          <ReadingSurface
            content={PREVIEW_TEXT}
            preferences={value}
            className="p-5"
          />
        </div>
      </div>

      {/* -------------------------------------------------- the guide ---- */}
      <div className="space-y-4">
        <SectionHeading>Reading guide</SectionHeading>

        <Field
          label="Guide style"
          hint="A highlight that follows along so it's easy to keep your place. Turn it off for a plain page."
        >
          <ChoiceRow
            options={GUIDE_MODE_OPTIONS}
            value={value.guideMode}
            onSelect={(guideMode) => onChange({ guideMode })}
          />
        </Field>

        {value.guideMode === 'mask' && (
          <>
            <Field
              label="How many lines to show"
              hint="Everything else is dimmed."
            >
              <ChoiceRow
                options={MASK_LINE_OPTIONS}
                value={value.maskLines}
                onSelect={(maskLines) => onChange({ maskLines })}
              />
            </Field>
            <Field label="How much to dim the rest">
              <ChoiceRow
                options={MASK_STRENGTH_OPTIONS}
                value={value.maskStrength}
                onSelect={(maskStrength) => onChange({ maskStrength })}
              />
            </Field>
          </>
        )}

        <Field label="Highlight color" hint="Pick a favorite.">
          <SwatchRow
            swatches={(Object.keys(HIGHLIGHT_PRESETS) as HighlightPreset[]).map(
              (preset) => ({
                value: preset,
                label: PRESET_LABELS[preset],
                colors: [
                  HIGHLIGHT_PRESETS[preset].band,
                  HIGHLIGHT_PRESETS[preset].word,
                ],
              })
            )}
            value={value.highlightPreset}
            onSelect={(preset) =>
              onChange({ highlightPreset: preset as HighlightPreset })
            }
          />
        </Field>

        {guideOn && (
          <Field
            label="Where the highlight sits"
            hint={`A fingertip covers what it touches, so the highlight normally sits just above it — like resting a bookmark under the line. Change this if ${childName ? `${childName}'s` : 'her'} finger keeps landing on the wrong line.`}
          >
            <ChoiceRow
              options={TOUCH_OFFSET_CHOICES.map((choice) => ({
                value: choice.value,
                label: choice.label,
              }))}
              value={
                TOUCH_OFFSET_CHOICES.reduce((closest, choice) =>
                  Math.abs(choice.value - value.touchOffsetLines) <
                  Math.abs(closest.value - value.touchOffsetLines)
                    ? choice
                    : closest
                ).value
              }
              onSelect={(touchOffsetLines) => onChange({ touchOffsetLines })}
            />
          </Field>
        )}

        {guideOn && (
          <div className="space-y-3">
            <Toggle
              label="Always keep the line centered"
              hint="Otherwise the page only scrolls when the line nears the top or bottom."
              checked={value.keepLineCentered}
              onChange={(keepLineCentered) => onChange({ keepLineCentered })}
            />
            <Toggle
              label="Little buzz when the line changes"
              hint="Tablet and phone only."
              checked={value.hapticOnLineChange}
              onChange={(hapticOnLineChange) => onChange({ hapticOnLineChange })}
            />
            <Toggle
              label="Tap a word to hear it"
              hint="Double-tap a word, or use the Say it button. Nothing is ever read aloud on its own."
              checked={value.tapToHearEnabled}
              onChange={(tapToHearEnabled) => onChange({ tapToHearEnabled })}
            />
          </div>
        )}

        {guideOn && onRecalibrate && (
          <button
            type="button"
            onClick={onRecalibrate}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 underline"
          >
            Run the finger check again
          </button>
        )}
      </div>

      {/* ------------------------------------------------- typography ---- */}
      <div className="space-y-4">
        <SectionHeading>Text</SectionHeading>

        <Field label="Text size">
          <ChoiceRow
            options={FONT_SIZE_OPTIONS}
            value={value.fontSize}
            onSelect={(fontSize) => onChange({ fontSize })}
          />
        </Field>

        <Field
          label="Line length"
          hint="Shorter lines make it easier to find the start of the next one."
        >
          <ChoiceRow
            options={COLUMN_OPTIONS}
            value={value.columnWidth}
            onSelect={(columnWidth) => onChange({ columnWidth })}
          />
        </Field>

        <Field
          label="Space between letters"
          hint="Extra space between letters is the best-supported change for readers who find letters crowd together."
        >
          <ChoiceRow
            options={SPACING_OPTIONS}
            value={value.letterSpacing}
            onSelect={(letterSpacing) => onChange({ letterSpacing })}
          />
        </Field>

        <Field label="Space between words">
          <ChoiceRow
            options={SPACING_OPTIONS}
            value={value.wordSpacing}
            onSelect={(wordSpacing) => onChange({ wordSpacing })}
          />
        </Field>

        <Field label="Space between lines">
          <ChoiceRow
            options={LINE_HEIGHT_OPTIONS}
            value={value.lineHeight}
            onSelect={(lineHeight) => onChange({ lineHeight })}
          />
        </Field>

        <Field label="Space between paragraphs">
          <ChoiceRow
            options={PARAGRAPH_GAP_OPTIONS}
            value={value.paragraphGap}
            onSelect={(paragraphGap) => onChange({ paragraphGap })}
          />
        </Field>

        <Field
          label="Font"
          hint="Nunito is the default. Some readers prefer Atkinson or OpenDyslexic — studies have not found either one faster to read, so this is down to what feels comfortable."
        >
          <ChoiceRow
            options={FONT_FAMILY_OPTIONS}
            value={value.fontFamily}
            onSelect={(fontFamily) => onChange({ fontFamily })}
          />
        </Field>

        <Field
          label="Page color"
          hint="A soft off-white is easier on the eyes than bright white."
        >
          <SwatchRow
            swatches={(Object.keys(PAGE_TINT) as PageTint[]).map((tint) => ({
              value: tint,
              label: TINT_LABELS[tint],
              colors: [PAGE_TINT[tint]],
            }))}
            value={value.pageTint}
            onSelect={(tint) => onChange({ pageTint: tint as PageTint })}
          />
        </Field>
      </div>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 underline"
        >
          Reset to the recommended settings
        </button>
      )}
    </div>
  )
}
