'use client'

import { useState } from 'react'

interface GrownUpVerdictButtonsProps {
  onVerdict: (correct: boolean) => void | Promise<void>
  disabled?: boolean
  /** Wording for the "wrong" side — "Not yet" for a retryable word. */
  incorrectLabel?: string
  correctLabel?: string
}

/**
 * The single-word verdict: right or wrong, from the adult sitting alongside.
 *
 * Ordinary-sized buttons on purpose. These are not `KidButton`s — a 96pt
 * fuchsia target next to the game's own would read as part of the game, and the
 * whole point is that it isn't.
 */
export function GrownUpVerdictButtons({
  onVerdict,
  disabled = false,
  incorrectLabel = 'Not yet',
  correctLabel = 'Got it',
}: GrownUpVerdictButtonsProps) {
  // Recording an attempt is a round-trip; without this a second tap in that
  // window would record the word twice and skew mastery counts.
  const [pending, setPending] = useState(false)
  const busy = disabled || pending

  const submit = async (correct: boolean) => {
    if (busy) return
    setPending(true)
    try {
      await onVerdict(correct)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => submit(false)}
        disabled={busy}
        className="flex-1 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ✗ {incorrectLabel}
      </button>
      <button
        type="button"
        onClick={() => submit(true)}
        disabled={busy}
        className="flex-1 rounded-xl border border-green-300 bg-white px-4 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ✓ {correctLabel}
      </button>
    </div>
  )
}
