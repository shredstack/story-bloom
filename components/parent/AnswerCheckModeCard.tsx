'use client'

import { Card } from '@/components/ui'
import { useAppSettings } from '@/lib/hooks/useAppSettings'
import {
  ANSWER_CHECK_MODES,
  ANSWER_CHECK_MODE_INFO,
  DEFAULT_APP_SETTINGS,
  type AnswerCheckMode,
} from '@/lib/types'

/**
 * Parent control for how the read-aloud games judge an attempt.
 *
 * Lives on the parent dashboard rather than inside one game's settings because
 * it applies to Word Quest, Word Rescue and Sentence Shenanigans alike — and
 * because the reason to change it is usually the device, not the game.
 */
export function AnswerCheckModeCard() {
  const { settings, updateSettings, isLoading } = useAppSettings()

  const current: AnswerCheckMode =
    settings?.answer_check_mode ?? DEFAULT_APP_SETTINGS.answer_check_mode

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-2xl">
          🎤
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-800 mb-1">
            How Reading Is Checked
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            Speech recognition doesn&apos;t work on every device — Amazon Fire
            tablets in particular. If the microphone keeps mishearing, have a
            grown-up mark answers instead.
          </p>

          {isLoading && !settings ? (
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="space-y-2">
              {ANSWER_CHECK_MODES.map((mode) => {
                const info = ANSWER_CHECK_MODE_INFO[mode]
                const selected = current === mode
                return (
                  <label
                    key={mode}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${
                      selected
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="answer-check-mode"
                      value={mode}
                      checked={selected}
                      onChange={() => updateSettings({ answer_check_mode: mode })}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium text-gray-800">
                        {info.emoji} {info.label}
                      </span>
                      <span className="block text-sm text-gray-600">
                        {info.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            Grown-up marking is protected by your Parent PIN — unlock it once per
            session inside the game.
          </p>
        </div>
      </div>
    </Card>
  )
}
