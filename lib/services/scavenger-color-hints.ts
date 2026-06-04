/**
 * Color-swatch hints for Pre-K scavenger-hunt clues.
 *
 * A clue like "Find something pink" is an *attribute* clue — any object will do, as
 * long as it's that color. An AI-generated picture is the wrong cue for these: it
 * draws one specific object (and often gets the color wrong), so a non-reader reads
 * "go find a strawberry" instead of "find anything pink". Instead we show the color
 * itself as a plain swatch — accurate, unambiguous, and free (no generation/storage).
 *
 * This module is the single source of truth for (a) which clues get a swatch in the
 * UI and (b) which clues the image generator should therefore skip.
 */

// CSS hex per color we hint. White/light tones rely on the PromptCard's border to
// stay visible against the card.
export const HINT_COLORS: Record<string, string> = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#FACC15',
  green: '#22C55E',
  blue: '#3B82F6',
  purple: '#A855F7',
  pink: '#EC4899',
  brown: '#92400E',
  black: '#1F2937',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  grey: '#9CA3AF',
}

/**
 * Return the swatch hex for a single-color clue, or null. Only fires for `color`
 * category clues that mention exactly one known color — multi-color clues
 * ("two colors", "favorite color") return null and stay text-only.
 */
export function extractHintColor(
  promptText: string,
  category: string | null
): string | null {
  if (category !== 'color') return null
  const words = promptText.toLowerCase().match(/[a-z]+/g) || []
  const found = [...new Set(words.filter((w) => w in HINT_COLORS))]
  if (found.length !== 1) return null
  return HINT_COLORS[found[0]]
}
