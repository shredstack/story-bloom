'use client'

interface MicTroubleNoticeProps {
  /** Hand scoring to a grown-up. `persist` also saves it as the default. */
  onSwitch?: (persist: boolean) => void
  onDismiss?: () => void
  /**
   * True when the device has no speech recognition at all. There is nothing to
   * decide in that case, so it renders as a statement with no buttons.
   */
  automatic?: boolean
}

/**
 * The escape hatch for the failure that actually happens on cheap tablets:
 * speech recognition is present, so nothing looks broken, but it mishears or
 * times out over and over and the child can't get past a word.
 *
 * Shown after a couple of failures — or stated as a fact when the device has no
 * recognition at all — so nobody has to go hunting through parent settings
 * mid-session to rescue a game.
 */
export function MicTroubleNotice({
  onSwitch,
  onDismiss,
  automatic = false,
}: MicTroubleNoticeProps) {
  if (automatic) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        This device can&apos;t use the microphone, so a grown-up can check the
        answers instead.
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-800 mb-3">
        Having trouble hearing? A grown-up can mark answers instead.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSwitch?.(false)}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          Switch for now
        </button>
        <button
          type="button"
          onClick={() => onSwitch?.(true)}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          Switch &amp; remember
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.()}
          className="rounded-xl px-3 py-2 text-sm text-amber-700 underline underline-offset-2 hover:text-amber-900"
        >
          Keep using the mic
        </button>
      </div>
    </div>
  )
}
