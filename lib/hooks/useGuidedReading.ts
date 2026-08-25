'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useLineModel } from '@/lib/hooks/useLineModel'
import { useReadingGuide, type ReadingGuideApi } from '@/lib/hooks/useReadingGuide'
import { useReadingPreferences } from '@/lib/hooks/useReadingPreferences'
import { useWordSpeech } from '@/lib/hooks/useWordSpeech'
import { flattenTokens, tokenizeStory } from '@/lib/reading/tokenize'
import type {
  Paragraph,
  PartialReadingPreferences,
  ReadingPreferences,
  WordToken,
} from '@/lib/reading/types'
import type { FontSize } from '@/lib/types'

interface UseGuidedReadingOptions {
  childId: string | undefined
  readingLevel?: string | null
  /** `children.default_text_size`, so profiles predating the panel keep theirs. */
  fallbackFontSize?: FontSize | null
  /** The passage to render, measure and guide. */
  content: string
  /**
   * Namespaces the resume position and resets the guide when it changes — a
   * story id in the reader, a sentence id in a game.
   */
  contentId: string
  /**
   * Tap-to-hear on top of the child's own `tapToHearEnabled` preference.
   * Sentence Shenanigans passes false while the mic is live, because speaking
   * a word out loud would be transcribed as the child reading it.
   */
  speechEnabled?: boolean
  /** See useReadingGuide: false for game cards, which never resume. */
  persistPosition?: boolean
  /** See useReadingGuide: false inside a fixed game layout. */
  autoScroll?: boolean
}

interface UseGuidedReadingReturn {
  /** Spread onto ReadingSurface's `surfaceRef`. */
  surfaceRef: React.RefObject<HTMLDivElement>
  preferences: ReadingPreferences
  setPreference: <K extends keyof ReadingPreferences>(
    key: K,
    value: ReadingPreferences[K]
  ) => void
  setPreferences: (patch: PartialReadingPreferences) => void
  guideOn: boolean
  guide: ReadingGuideApi
  paragraphs: Paragraph[]
  tokens: WordToken[]
  /** The token the guide sits on, or undefined before it is placed. */
  activeToken: WordToken | undefined
  /** Speaks the highlighted word. Backs the bottom bar's "Say it". */
  sayActiveWord: () => void
  speakingWordIndex: number
  /** Kid-facing message when a word could not be spoken at all. */
  speechError: string | null
  /** Whether "Say it" can do anything right now. */
  canSay: boolean
}

/**
 * Everything a screen needs to render text with the reading guide: per-child
 * typography, the measured line model, the finger-controlled guide and
 * tap-to-hear, composed once.
 *
 * Exists because the story reader and Sentence Shenanigans wire up the same
 * four hooks in the same order, and a divergence between them would be a
 * silent behavioural difference rather than a compile error. The guide's own
 * story-agnostic pieces (ReadingSurface, useReadingGuide) stay as they were —
 * this is only the assembly.
 */
export function useGuidedReading({
  childId,
  readingLevel,
  fallbackFontSize,
  content,
  contentId,
  speechEnabled = true,
  persistPosition = true,
  autoScroll = true,
}: UseGuidedReadingOptions): UseGuidedReadingReturn {
  const surfaceRef = useRef<HTMLDivElement>(null)

  const { preferences, setPreference, setPreferences } = useReadingPreferences({
    childId,
    readingLevel,
    fallbackFontSize,
  })

  const guideOn = preferences.guideMode !== 'off'
  const paragraphs = useMemo(() => tokenizeStory(content), [content])
  const tokens = useMemo(() => flattenTokens(paragraphs), [paragraphs])

  const { model, isReady } = useLineModel({
    containerRef: surfaceRef,
    enabled: guideOn && content.length > 0,
    content,
    preferences,
  })

  const { speakingWordIndex, sayWord, error: speechError } = useWordSpeech({
    childId,
    enabled: preferences.tapToHearEnabled && speechEnabled,
  })

  const guide = useReadingGuide({
    containerRef: surfaceRef,
    model,
    isReady,
    preferences,
    tokens,
    storyId: contentId,
    persistPosition,
    autoScroll,
    onTurnOffGuide: () => setPreference('guideMode', 'off'),
    onWordDoubleTap: (wordIndex) => sayWord(tokens[wordIndex]),
  })

  const activeToken = guide.wordIndex >= 0 ? tokens[guide.wordIndex] : undefined

  // Pulse the highlighted word while it is being spoken. Toggled on the
  // overlay element rather than the span, so speaking never re-renders text.
  const wordOverlayRef = guide.wordRef
  useEffect(() => {
    wordOverlayRef.current?.classList.toggle(
      'is-speaking',
      speakingWordIndex >= 0 && speakingWordIndex === guide.wordIndex
    )
  }, [speakingWordIndex, guide.wordIndex, wordOverlayRef])

  return {
    surfaceRef,
    preferences,
    setPreference,
    setPreferences,
    guideOn,
    guide,
    paragraphs,
    tokens,
    activeToken,
    sayActiveWord: () => sayWord(activeToken),
    speakingWordIndex,
    speechError,
    canSay:
      preferences.tapToHearEnabled &&
      speechEnabled &&
      !!activeToken?.normalized,
  }
}
