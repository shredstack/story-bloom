/**
 * Native shell helpers — splash/status-bar handoff, immersive hard-lock, and
 * orientation locking. Every export is a no-op on web (guarded by
 * `Capacitor.isNativePlatform()`), so call sites never need their own guards and
 * `next build` (web) is unaffected.
 *
 * The plugin modules are imported at the top level on purpose: Capacitor plugins
 * ship web shims, so importing is safe — we only *call* their native methods
 * after the `isNativePlatform()` check.
 */
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar } from '@capacitor/status-bar'
import { ScreenOrientation } from '@capacitor/screen-orientation'

/** Orientation a game can request while immersive. 'current' locks whatever the
 * device is already in, so the layout can't reflow mid-play. */
export type GameOrientation = 'current' | 'landscape' | 'portrait'

/**
 * Hide the splash screen and the status bar once the web app has taken over.
 * On a kid kiosk we want every pixel and no OS chrome — Android's nav bar is
 * additionally hard-hidden natively in MainActivity (immersive sticky).
 */
export async function hideNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.hide()
  } catch {
    /* status bar plugin unavailable — ignore */
  }
  try {
    await SplashScreen.hide()
  } catch {
    /* splash already hidden — ignore */
  }
}

/**
 * Lock the screen orientation while a game is active so an accidental tilt can't
 * reflow the layout mid-play. Defaults to locking the *current* orientation.
 * Returns the orientation that was locked (or null on web / failure).
 */
export async function lockOrientation(
  orientation: GameOrientation = 'current'
): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    let target = orientation as string
    if (orientation === 'current') {
      const current = await ScreenOrientation.orientation()
      // current.type is e.g. 'portrait-primary' | 'landscape-primary'
      target = current.type.startsWith('landscape') ? 'landscape' : 'portrait'
    }
    await ScreenOrientation.lock({ orientation: target as 'landscape' | 'portrait' })
    return target
  } catch {
    return null
  }
}

/** Release any orientation lock (back to free rotation) when leaving a game. */
export async function unlockOrientation(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await ScreenOrientation.unlock()
  } catch {
    /* nothing locked — ignore */
  }
}
