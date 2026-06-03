'use client'

import { useEffect, useRef } from 'react'
import { usePlatform } from '@/lib/native/usePlatform'
import {
  hideNativeChrome,
  lockOrientation,
  unlockOrientation,
} from '@/lib/native/nativeShell'
import { installBackButtonGuard } from '@/lib/native/backButtonGuard'

interface NativeShellProviderProps {
  /** Live immersive/in-game state from ProtectedLayoutClient. */
  immersive: boolean
}

/**
 * Drives the native lock-down from inside the React tree, reusing the existing
 * `immersive` state (the same flag that hides the app header) as the single
 * source of truth for "is the kid in a game right now."
 *
 * On native it:
 *   - hides the splash + status bar and tags `<html data-native>` so kid-mode CSS
 *     (no zoom / no callout / no overscroll, bigger targets) applies app-wide;
 *   - installs the Android back-button guard wired to the live immersive ref;
 *   - locks orientation while immersive so a game can't reflow mid-play, and
 *     unlocks when the game ends.
 *
 * Renders nothing. Entirely inert on web (`isNative` is false), so `next build`
 * and the browser experience are unaffected.
 */
export function NativeShellProvider({ immersive }: NativeShellProviderProps) {
  const { isNative } = usePlatform()
  const immersiveRef = useRef(immersive)
  immersiveRef.current = immersive

  // One-time native setup.
  useEffect(() => {
    if (!isNative) return
    document.documentElement.setAttribute('data-native', 'true')
    void hideNativeChrome()
    const uninstall = installBackButtonGuard(() => immersiveRef.current)
    return () => {
      uninstall()
      document.documentElement.removeAttribute('data-native')
    }
  }, [isNative])

  // Hard-lock orientation while in a game; free rotation otherwise.
  useEffect(() => {
    if (!isNative) return
    if (immersive) {
      void lockOrientation('current')
    } else {
      void unlockOrientation()
    }
  }, [isNative, immersive])

  return null
}
