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
 * Shown after the microphone has failed a couple of times — the case that
 * actually happens on cheap tablets, where recognition is present so nothing
 * *looks* broken, it just mishears or times out until the child is stuck.
 *
 * It no longer has to rescue the session (the grown-up controls are already on
 * screen, right below). Its job now is to name what went wrong and offer to put
 * the useless mic button away, which is the part a parent can't infer.
 */
export function MicTroubleNotice({
  onSwitch,
  onDismiss,
  automatic = false,
}: MicTroubleNoticeProps) {
  if (automatic) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        This device can&apos;t use the microphone. Use{' '}
        <strong>Grown-up check</strong> below to mark answers.
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm text-amber-800 mb-3">
        The microphone is having trouble. Use <strong>Grown-up check</strong>{' '}
        below to mark answers — and you can put the mic away.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSwitch?.(false)}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          Hide the mic for now
        </button>
        <button
          type="button"
          onClick={() => onSwitch?.(true)}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          Hide it &amp; remember
        </button>
        <button
          type="button"
          onClick={() => onDismiss?.()}
          className="rounded-xl px-3 py-2 text-sm text-amber-700 underline underline-offset-2 hover:text-amber-900"
        >
          Keep the mic
        </button>
      </div>
    </div>
  )
}
