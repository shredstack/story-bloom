import { describe, it, expect } from 'vitest'
import {
  splitTargetWords,
  toScorableWords,
  buildGrownUpWordResults,
} from './grownupScoring'

describe('splitTargetWords', () => {
  it('strips punctuation and lowercases', () => {
    expect(splitTargetWords('The dog ran, fast!')).toEqual([
      'the',
      'dog',
      'ran',
      'fast',
    ])
  })

  it('keeps contractions whole', () => {
    expect(splitTargetWords("I can't go")).toEqual(['i', "can't", 'go'])
  })

  it('returns an empty list for an empty sentence', () => {
    expect(splitTargetWords('   ')).toEqual([])
  })
})

describe('toScorableWords', () => {
  it('shows the words as written, with scoring positions', () => {
    expect(toScorableWords('The dog ran, fast!')).toEqual([
      { display: 'The', position: 0 },
      { display: 'dog', position: 1 },
      { display: 'ran,', position: 2 },
      { display: 'fast!', position: 3 },
    ])
  })

  it('falls back to normalized words when the two splits disagree', () => {
    // The lone em-dash normalizes away, so the display split is longer.
    expect(toScorableWords('the dog — ran')).toEqual([
      { display: 'the', position: 0 },
      { display: 'dog', position: 1 },
      { display: 'ran', position: 2 },
    ])
  })
})

describe('buildGrownUpWordResults', () => {
  it('counts everything correct when nothing is marked', () => {
    const { accuracy, wordResults } = buildGrownUpWordResults('The dog ran', [])
    expect(accuracy).toBe(100)
    expect(wordResults.every((r) => r.correct)).toBe(true)
    expect(wordResults.map((r) => r.position)).toEqual([0, 1, 2])
  })

  it('marks only the flagged positions wrong', () => {
    const { accuracy, wordResults } = buildGrownUpWordResults('The dog ran', [1])
    expect(accuracy).toBe(67)
    expect(wordResults.map((r) => r.correct)).toEqual([true, false, true])
    expect(wordResults[1].word).toBe('dog')
  })

  it('never reports a transcript it does not have', () => {
    const { wordResults } = buildGrownUpWordResults('The dog ran', [0])
    expect(wordResults.every((r) => r.spoken === null)).toBe(true)
  })

  it('scores an all-missed sentence at zero', () => {
    const { accuracy } = buildGrownUpWordResults('The dog ran', [0, 1, 2])
    expect(accuracy).toBe(0)
  })

  it('is safe on an empty sentence', () => {
    expect(buildGrownUpWordResults('', [0])).toEqual({
      accuracy: 0,
      wordResults: [],
    })
  })
})
