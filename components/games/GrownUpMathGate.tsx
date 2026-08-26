'use client'

import { useCallback, useRef, useState } from 'react'
import { Card, Button } from '@/components/ui'

interface GrownUpMathGateProps {
  onSuccess: () => void
  onCancel: () => void
}

/** Both factors ≥ 3 so the answer is never reachable by counting on fingers. */
function newQuestion(): { a: number; b: number } {
  const a = 3 + Math.floor(Math.random() * 7) // 3..9
  const b = 6 + Math.floor(Math.random() * 7) // 6..12
  return { a, b }
}

/**
 * The fallback grown-up gate for accounts with no Parent PIN.
 *
 * The grown-up controls are on screen in every game now, so "no PIN means no
 * gate" would have left a tap-to-win button under every word. A multiplication
 * challenge is the standard parental gate for exactly this reason: nothing to
 * set up, nothing to remember, and comfortably past an early reader — while a
 * parent clears it in three seconds.
 *
 * It is a speed bump, not a lock. A child who can do 7 × 11 can also read the
 * word. Families who want the real thing get pointed at the Parent PIN.
 */
export function GrownUpMathGate({ onSuccess, onCancel }: GrownUpMathGateProps) {
  const [question, setQuestion] = useState(newQuestion)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (Number(answer) === question.a * question.b) {
        onSuccess()
        return
      }
      // A new question on every miss, so guessing can't converge.
      setQuestion(newQuestion())
      setAnswer('')
      setError(true)
      inputRef.current?.focus()
    },
    [answer, question, onSuccess]
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="max-w-sm w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-3xl">
            🧑‍🏫
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Grown-ups only</h2>
          <p className="text-gray-600 text-sm">
            Answer this to mark your child&apos;s reading.
          </p>
        </div>

        <form onSubmit={submit}>
          <p className="text-center text-3xl font-bold text-gray-800 mb-4">
            {question.a} × {question.b} = ?
          </p>

          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoFocus
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value.replace(/\D/g, ''))
              setError(false)
            }}
            aria-label={`What is ${question.a} times ${question.b}?`}
            className={`w-full text-center text-2xl font-bold border-2 rounded-xl py-3 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 ${
              error ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />

          {error && (
            <p className="text-red-500 text-sm text-center mt-3">
              Not quite — here&apos;s a new one.
            </p>
          )}

          <div className="mt-6 space-y-3">
            <Button type="submit" className="w-full" disabled={answer === ''}>
              Unlock
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </form>

        <p className="mt-4 text-xs text-center text-gray-500">
          Set a Parent PIN in the Parent Dashboard to use that instead.
        </p>
      </Card>
    </div>
  )
}
