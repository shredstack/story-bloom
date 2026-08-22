'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  PREFS_SAVE_DEBOUNCE_MS,
  resolveReadingPreferences,
  sanitizeReadingPreferences,
} from '@/lib/reading/defaults'
import type {
  PartialReadingPreferences,
  ReadingPreferences,
} from '@/lib/reading/types'
import type { FontSize } from '@/lib/types'

const STORAGE_PREFIX = 'storybloom-reading-prefs:'

/** useLayoutEffect warns during SSR; this keeps the pre-paint timing on client. */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

function storageKey(childId: string) {
  return `${STORAGE_PREFIX}${childId}`
}

function readLocal(childId: string): PartialReadingPreferences {
  try {
    const raw = localStorage.getItem(storageKey(childId))
    return raw ? sanitizeReadingPreferences(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

function writeLocal(childId: string, stored: PartialReadingPreferences) {
  try {
    localStorage.setItem(storageKey(childId), JSON.stringify(stored))
  } catch {
    // Private mode / quota — Supabase is still authoritative.
  }
}

interface UseReadingPreferencesOptions {
  childId: string | undefined
  /** Used to pick level-appropriate defaults before the parent customises. */
  readingLevel?: string | null
  /** `children.default_text_size`, so existing profiles keep their font size. */
  fallbackFontSize?: FontSize | null
}

interface UseReadingPreferencesReturn {
  preferences: ReadingPreferences
  /** True once localStorage has been consulted (not once the network settles). */
  isLoaded: boolean
  setPreference: <K extends keyof ReadingPreferences>(
    key: K,
    value: ReadingPreferences[K]
  ) => void
  setPreferences: (patch: PartialReadingPreferences) => void
  resetToDefaults: () => void
}

/**
 * localStorage-first, Supabase-authoritative per-child preferences (spec §6.7).
 *
 * Order matters: the local value is applied in a layout effect (before paint,
 * after hydration) so a child never watches her page reflow from defaults to
 * her settings; the network fetch then reconciles in the background. Writes go
 * to localStorage immediately and PATCH on an 800ms debounce.
 */
export function useReadingPreferences({
  childId,
  readingLevel,
  fallbackFontSize,
}: UseReadingPreferencesOptions): UseReadingPreferencesReturn {
  // The sparse "what the parent changed" map. Resolved against defaults below.
  const [stored, setStored] = useState<PartialReadingPreferences>({})
  const [isLoaded, setIsLoaded] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<PartialReadingPreferences | null>(null)

  // 1. Synchronous-ish local read before first paint.
  useIsomorphicLayoutEffect(() => {
    if (!childId) {
      setStored({})
      setIsLoaded(false)
      return
    }
    setStored(readLocal(childId))
    setIsLoaded(true)
  }, [childId])

  // 2. Background fetch; adopt the server copy and rewrite localStorage.
  useEffect(() => {
    if (!childId) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`/api/reading-preferences?childId=${childId}`)
        if (!res.ok || cancelled) return
        const { preferences } = await res.json()
        const remote = sanitizeReadingPreferences(preferences)
        if (cancelled) return
        setStored((current) => {
          // A local edit made while the fetch was in flight wins — it is
          // already queued for PATCH and is what the parent just chose.
          if (pendingSaveRef.current) return current
          if (JSON.stringify(current) === JSON.stringify(remote)) return current
          writeLocal(childId, remote)
          return remote
        })
      } catch {
        // Offline / cold start: localStorage already gave us something usable.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [childId])

  const flushSave = useCallback(() => {
    const patch = pendingSaveRef.current
    pendingSaveRef.current = null
    saveTimerRef.current = null
    if (!childId || !patch) return

    void fetch('/api/reading-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, preferences: patch }),
    }).catch(() => {
      // Preferences are a comfort setting, not data loss — localStorage holds
      // the value and the next change retries.
    })
  }, [childId])

  const setPreferences = useCallback(
    (patch: PartialReadingPreferences) => {
      if (!childId) return
      const clean = sanitizeReadingPreferences(patch)
      if (Object.keys(clean).length === 0) return

      setStored((current) => {
        const next = { ...current, ...clean }
        writeLocal(childId, next)
        return next
      })

      pendingSaveRef.current = { ...(pendingSaveRef.current ?? {}), ...clean }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(flushSave, PREFS_SAVE_DEBOUNCE_MS)
    },
    [childId, flushSave]
  )

  const setPreference = useCallback(
    <K extends keyof ReadingPreferences>(key: K, value: ReadingPreferences[K]) => {
      setPreferences({ [key]: value } as PartialReadingPreferences)
    },
    [setPreferences]
  )

  const resetToDefaults = useCallback(() => {
    if (!childId) return
    setStored({})
    writeLocal(childId, {})
    // Cancel any queued partial write, then clear the column outright.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    pendingSaveRef.current = null
    void fetch('/api/reading-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, preferences: {}, replace: true }),
    }).catch(() => {})
  }, [childId])

  // Don't lose a debounced write when the reader unmounts.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        flushSave()
      }
    }
  }, [flushSave])

  const preferences = resolveReadingPreferences(stored, {
    readingLevel,
    fallbackFontSize,
  })

  return { preferences, isLoaded, setPreference, setPreferences, resetToDefaults }
}
