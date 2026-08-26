'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ParentPinModal } from '@/components/parent/ParentPinModal'
import type { UseGrownUpUnlockReturn } from '@/lib/hooks/useGrownUpUnlock'

interface GrownUpCheckBarProps {
  /** The whole lock API, from `useGrownUpUnlock` (via `useReadingCheck`). */
  unlock: UseGrownUpUnlockReturn
  /** What the grown-up is being asked, e.g. "Did they read it?" */
  hint?: string
  /** The scoring controls — verdict buttons, a word scorer, whatever fits. */
  children: ReactNode
  className?: string
}

/**
 * The frame around every grown-up scoring control.
 *
 * Two jobs, both about keeping the adult's controls and the child's game apart:
 *
 *  1. It looks nothing like the game. Slate, small type, no bounce — a child
 *     scanning for the next big colorful button skips straight past it, and an
 *     adult can tell at a glance which half of the screen is theirs.
 *  2. It stays locked until a grown-up proves it with the parent PIN, then
 *     stays unlocked for the session (nobody wants to type a PIN per word) with
 *     a one-tap re-lock for stepping away.
 */
export function GrownUpCheckBar({
  unlock,
  hint,
  children,
  className = '',
}: GrownUpCheckBarProps) {
  return (
    <section
      aria-label="Grown-up check"
      className={`w-full max-w-md rounded-2xl border border-slate-300 bg-slate-100/80 px-4 py-3 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Grown-up
        </span>
        {unlock.isUnlocked && unlock.hasPin && (
          <button
            type="button"
            onClick={unlock.lock}
            className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
          >
            Lock
          </button>
        )}
      </div>

      {unlock.isUnlocked ? (
        <>
          {hint && <p className="text-sm text-slate-600 mb-3">{hint}</p>}
          {children}
          {!unlock.hasPin && !unlock.isLoading && (
            <p className="mt-3 text-xs text-slate-500">
              Tip:{' '}
              <Link href="/parent" className="underline underline-offset-2">
                set a Parent PIN
              </Link>{' '}
              so only you can mark answers.
            </p>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={unlock.requestUnlock}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          🔒 Unlock to check answers
        </button>
      )}

      {unlock.isPrompting && (
        <ParentPinModal
          mode="verify"
          onSuccess={unlock.confirmUnlock}
          onCancel={unlock.cancelUnlock}
        />
      )}
    </section>
  )
}
