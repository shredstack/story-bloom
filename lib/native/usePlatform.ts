'use client'

import { Capacitor } from '@capacitor/core'

/**
 * Thin wrapper around Capacitor's platform detection so the rest of the app can
 * branch on "are we inside the native StoryBloom shell?" without importing
 * Capacitor everywhere.
 *
 * Safe on web: `@capacitor/core` resolves to a web shim during `next build`, and
 * `isNativePlatform()` returns false. Native plugin APIs must still be guarded by
 * `isNative` before they're *called* (importing them is fine — they no-op on web).
 */
export function usePlatform() {
  const isNative = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
  return {
    isNative,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
    platform,
  }
}

/** Non-hook variant for use outside React (modules, event handlers). */
export function getPlatformInfo() {
  const isNative = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform()
  return {
    isNative,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
    platform,
  }
}
