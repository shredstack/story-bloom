'use client'

import { useEffect, useMemo, useState } from 'react'
import { toScorableWords } from '@/lib/games/grownupScoring'

interface GrownUpSentenceScorerProps {
  /** The sentence the child just read. */
  sentence: string
  /** Receives the positions the grown-up marked as missed. */
  onSubmit: (missedPositions: number[]) => void | Promise<void>
  disabled?: boolean
}

/**
 * Word-by-word scoring for Sentence Shenanigans, done by the adult instead of
 * the transcript.
 *
 * Tap only the words that went wrong: a clean read is one tap on Done, which
 * matters when this runs for every sentence of a worksheet. The positions it
 * emits are the same `SentenceWordResult.position` indices speech scoring
 * produces, so accuracy, XP, pet rewards and the Word Rescue capture of missed
 * words all behave identically — and in fact more accurately, since a parent
 * knows what was actually said.
 */
export function GrownUpSentenceScorer({
  sentence,
  onSubmit,
  disabled = false,
}: GrownUpSentenceScorerProps) {
  const words = useMemo(() => toScorableWords(sentence), [sentence])
  const [missed, setMissed] = useState<number[]>([])
  // Recording an attempt is a round-trip; a second Done tap in that window
  // would record the sentence twice.
  const [pending, setPending] = useState(false)

  // A new sentence starts from a clean slate.
  useEffect(() => {
    setMissed([])
    setPending(false)
  }, [sentence])

  const submit = async () => {
    if (disabled || pending || words.length === 0) return
    setPending(true)
    try {
      await onSubmit(missed)
    } finally {
      setPending(false)
    }
  }

  const toggle = (position: number) => {
    setMissed((prev) =>
      prev.includes(position)
        ? prev.filter((p) => p !== position)
        : [...prev, position]
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {words.map(({ display, position }) => {
          const isMissed = missed.includes(position)
          return (
            <button
              key={position}
              type="button"
              onClick={() => toggle(position)}
              disabled={disabled || pending}
              aria-pressed={isMissed}
              aria-label={`${display} — ${isMissed ? 'missed' : 'read correctly'}`}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isMissed
                  ? 'border-red-400 bg-red-50 text-red-700 line-through'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {display}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {missed.length === 0
            ? 'Tap any words they missed'
            : `${missed.length} word${missed.length === 1 ? '' : 's'} missed`}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || pending || words.length === 0}
          className="rounded-xl border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✓ Done
        </button>
      </div>
    </div>
  )
}
