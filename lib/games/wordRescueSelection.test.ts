import { describe, it, expect } from 'vitest'
import type { WordMasteryStage } from '@/lib/types'
import {
  maxFocusWordsPerSession,
  selectWordRescueWords,
} from './wordRescueSelection'

interface TestWord {
  word: string
  current_stage: WordMasteryStage
  focus_repeats: number | null
  last_practiced_at: string | null
}

function word(
  name: string,
  overrides: Partial<Omit<TestWord, 'word'>> = {}
): TestWord {
  return {
    word: name,
    current_stage: 'seedling',
    focus_repeats: 0,
    last_practiced_at: null,
    ...overrides,
  }
}

const names = (words: TestWord[]) => words.map((w) => w.word)

describe('maxFocusWordsPerSession', () => {
  it('is half a session, rounded up', () => {
    expect(maxFocusWordsPerSession(10)).toBe(5)
    expect(maxFocusWordsPerSession(7)).toBe(4)
  })

  it('always leaves room for at least one starred word', () => {
    expect(maxFocusWordsPerSession(1)).toBe(1)
  })
})

describe('selectWordRescueWords', () => {
  it('serves starred words first', () => {
    const words = [
      word('apple'),
      word('because', { focus_repeats: 5 }),
      word('cat'),
    ]

    expect(names(selectWordRescueWords(words, 3))[0]).toBe('because')
  })

  it('caps starred words at half the session so the rest of the list plays', () => {
    const starred = ['a', 'b', 'c', 'd', 'e', 'f'].map((w) =>
      word(w, { focus_repeats: 5 })
    )
    const plain = ['g', 'h', 'i', 'j'].map((w) => word(w))

    const selected = names(selectWordRescueWords([...starred, ...plain], 6))

    expect(selected).toHaveLength(6)
    expect(selected.filter((w) => 'abcdef'.includes(w))).toHaveLength(3)
  })

  it('fills the session with starred words when there is nothing else', () => {
    const starred = ['a', 'b', 'c', 'd'].map((w) => word(w, { focus_repeats: 5 }))

    expect(selectWordRescueWords(starred, 4)).toHaveLength(4)
  })

  it('orders unstarred words newest-struggle first, not alphabetically by stage', () => {
    const words = [
      word('blooms', { current_stage: 'blooming' }),
      word('grows', { current_stage: 'growing' }),
      word('sprouts', { current_stage: 'seedling' }),
    ]

    expect(names(selectWordRescueWords(words, 3))).toEqual([
      'sprouts',
      'grows',
      'blooms',
    ])
  })

  it('breaks stage ties by least recently practiced, never-practiced first', () => {
    const words = [
      word('recent', { last_practiced_at: '2026-08-25T00:00:00Z' }),
      word('stale', { last_practiced_at: '2026-01-01T00:00:00Z' }),
      word('fresh'),
    ]

    expect(names(selectWordRescueWords(words, 3))).toEqual([
      'fresh',
      'stale',
      'recent',
    ])
  })

  it('rotates starred words by recency so the same three do not repeat forever', () => {
    const words = [
      word('done', { focus_repeats: 3, last_practiced_at: '2026-08-26T00:00:00Z' }),
      word('waiting', { focus_repeats: 3, last_practiced_at: '2026-08-01T00:00:00Z' }),
    ]

    expect(names(selectWordRescueWords(words, 1))).toEqual(['waiting'])
  })

  it('excludes mastered words even if they are still starred', () => {
    const words = [
      word('learned', { current_stage: 'mastered', focus_repeats: 5 }),
      word('tricky'),
    ]

    expect(names(selectWordRescueWords(words, 5))).toEqual(['tricky'])
  })

  it('treats a null focus count as unstarred', () => {
    const words = [word('plain', { focus_repeats: null })]

    expect(names(selectWordRescueWords(words, 5))).toEqual(['plain'])
  })

  it('returns nothing for an empty list or an empty session', () => {
    expect(selectWordRescueWords([], 10)).toEqual([])
    expect(selectWordRescueWords([word('a')], 0)).toEqual([])
  })
})
