'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'

export interface ReadingWordTap {
  id: string
  normalized_word: string
  tap_count: number
  distinct_days: number
  last_tapped_on: string
}

interface ReadingTapReviewQueueProps {
  childId: string
  childName: string
  /** The existing struggling-words pipeline. Confirming calls straight into it. */
  onAddWord: (word: string) => Promise<{ success: boolean; alreadyExisted?: boolean }>
}

/**
 * Words the child asked to hear repeatedly while reading (spec §5.4).
 *
 * This is a REVIEW QUEUE, not an automatic feed: reaching 3 taps across 2
 * distinct days puts a word in front of the parent, and only the parent's
 * confirmation sends it into Word Rescue. A child mashing the speaker button
 * must not be able to fill her own practice list with words she knows.
 */
export function ReadingTapReviewQueue({
  childId,
  childName,
  onAddWord,
}: ReadingTapReviewQueueProps) {
  const [words, setWords] = useState<ReadingWordTap[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    if (!childId) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/reading-word-taps?childId=${childId}`)
      if (!res.ok) return
      const { words: fetched } = await res.json()
      setWords(fetched ?? [])
    } catch {
      // A queue that fails to load is a non-event; the words stay queued.
    } finally {
      setIsLoading(false)
    }
  }, [childId])

  useEffect(() => {
    void fetchQueue()
  }, [fetchQueue])

  const resolve = useCallback(
    async (word: ReadingWordTap, action: 'promote' | 'dismiss') => {
      setBusyId(word.id)
      try {
        if (action === 'promote') {
          const result = await onAddWord(word.normalized_word)
          if (!result.success) return
        }
        await fetch('/api/reading-word-taps', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, id: word.id, action }),
        })
        setWords((prev) => prev.filter((w) => w.id !== word.id))
      } finally {
        setBusyId(null)
      }
    },
    [childId, onAddWord]
  )

  // Nothing queued is the normal state. Don't take up room saying so.
  if (!isLoading && words.length === 0) return null

  return (
    <Card className="p-6 mb-6 border-2 border-secondary-200">
      <h2 className="text-lg font-semibold mb-1">Words {childName} asked to hear</h2>
      <p className="text-gray-600 mb-4 text-sm">
        {childName} tapped these while reading a story, on more than one day. Add
        the ones you think are worth practicing — the rest disappear.
      </p>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <ul className="divide-y">
        {words.map((word) => (
          <li
            key={word.id}
            className="py-3 flex items-center justify-between gap-4 flex-wrap"
          >
            <div>
              <span className="font-semibold text-gray-900">
                {word.normalized_word}
              </span>
              <span className="ml-3 text-sm text-gray-500">
                {word.tap_count} taps over {word.distinct_days} days
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => resolve(word, 'promote')}
                disabled={busyId === word.id}
              >
                Add to practice
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resolve(word, 'dismiss')}
                disabled={busyId === word.id}
              >
                Not this one
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
