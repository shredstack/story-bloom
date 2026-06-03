'use client'

import { usePlatform } from '@/lib/native/usePlatform'

/**
 * "Kid mode" = the most locked-down, small-hands-friendly defaults, applied
 * automatically inside the native StoryBloom shell without changing the plain
 * browser experience. Components use `kidMode` to opt into bigger touch targets,
 * haptics, no zoom, etc. (§B9).
 *
 * Kept as a tiny hook so the trigger is centralized — if we later want to force
 * kid mode in the browser too (e.g. a query param or a parent setting), this is
 * the one place to change.
 */
export function useKidMode(): { kidMode: boolean } {
  const { isNative } = usePlatform()
  return { kidMode: isNative }
}
