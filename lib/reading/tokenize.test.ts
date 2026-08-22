import { describe, expect, it } from 'vitest'
import { flattenTokens, isTappable, tokenizeStory } from './tokenize'

const raws = (content: string) =>
  tokenizeStory(content).map((p) => p.tokens.map((t) => t.raw))

describe('tokenizeStory — paragraph splitting', () => {
  it('splits on a blank line', () => {
    expect(raws('One two.\n\nThree four.')).toEqual([
      ['One', 'two.'],
      ['Three', 'four.'],
    ])
  })

  it('treats a single newline inside a paragraph as a space', () => {
    const paragraphs = tokenizeStory('The fox\nran home.')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].tokens.map((t) => t.raw)).toEqual([
      'The',
      'fox',
      'ran',
      'home.',
    ])
  })

  it('collapses runs of three or more newlines into one break', () => {
    expect(raws('One.\n\n\n\nTwo.')).toEqual([['One.'], ['Two.']])
  })

  it('handles \\r\\n line endings', () => {
    expect(raws('One.\r\n\r\nTwo.')).toEqual([['One.'], ['Two.']])
    expect(raws('One\r\ntwo.')).toEqual([['One', 'two.']])
  })

  it('ignores leading and trailing whitespace', () => {
    expect(raws('\n\n  Hello there.  \n\n')).toEqual([['Hello', 'there.']])
  })

  it('returns an empty array for empty or whitespace-only content', () => {
    expect(tokenizeStory('')).toEqual([])
    expect(tokenizeStory('   \n\n  \n ')).toEqual([])
  })

  it('numbers paragraphs sequentially with no gaps from dropped blanks', () => {
    const paragraphs = tokenizeStory('A.\n\n\n\n \n\nB.\n\nC.')
    expect(paragraphs.map((p) => p.index)).toEqual([0, 1, 2])
  })
})

describe('tokenizeStory — word tokens', () => {
  it('keeps punctuation attached to its word', () => {
    expect(raws('the dog, and cat.')).toEqual([['the', 'dog,', 'and', 'cat.']])
  })

  it('does not split on apostrophes or hyphens', () => {
    const tokens = tokenizeStory("don't well-known").flatMap((p) => p.tokens)
    expect(tokens.map((t) => t.raw)).toEqual(["don't", 'well-known'])
  })

  it('normalizes using the shared normalizeWord', () => {
    const tokens = tokenizeStory('The Dog, "Ran"!').flatMap((p) => p.tokens)
    expect(tokens.map((t) => t.normalized)).toEqual(['the', 'dog', 'ran'])
  })

  it("keeps the apostrophe in a contraction's normalized form", () => {
    const [token] = tokenizeStory("don't").flatMap((p) => p.tokens)
    expect(token.normalized).toBe("don't")
  })

  it('numbers words globally and sequentially across paragraphs', () => {
    const tokens = flattenTokens(tokenizeStory('a b c\n\nd e\n\nf'))
    expect(tokens.map((t) => t.index)).toEqual([0, 1, 2, 3, 4, 5])
    expect(tokens.map((t) => t.raw)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('gives a punctuation-only token an empty normalized form, but a real index', () => {
    const tokens = flattenTokens(tokenizeStory('She paused — then ran.'))
    const dash = tokens.find((t) => t.raw === '—')
    expect(dash).toBeDefined()
    expect(dash!.normalized).toBe('')
    expect(isTappable(dash!)).toBe(false)
    // It still occupies an index: the words after it are not renumbered.
    expect(tokens.map((t) => t.index)).toEqual([0, 1, 2, 3, 4])
    expect(tokens[4].raw).toBe('ran.')
  })

  it('marks ordinary words as tappable', () => {
    const [token] = flattenTokens(tokenizeStory('hello'))
    expect(isTappable(token)).toBe(true)
  })
})
