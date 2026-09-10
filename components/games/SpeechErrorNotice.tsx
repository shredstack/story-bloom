'use client'

interface SpeechErrorNoticeProps {
  /** `speech.error` from `useReadingCheck`. Nothing renders when it's null. */
  message: string | null | undefined
}

/**
 * What went wrong with the last microphone attempt, in the child's own reading
 * level, right where she is looking.
 *
 * `useSpeechRecognition` has always produced these messages — "I didn't hear
 * anything", "Microphone access denied" — and the games have never shown them.
 * A denied permission or a timeout therefore looked exactly like a tap that
 * didn't register, which is the least actionable thing a mic button can do.
 *
 * This is the transient one. `MicTroubleNotice` is its escalation, after the
 * failures stop looking like bad luck.
 */
export function SpeechErrorNotice({ message }: SpeechErrorNoticeProps) {
  if (!message) return null

  return (
    <div
      role="status"
      className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800"
    >
      {message}
    </div>
  )
}
