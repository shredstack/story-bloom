/**
 * Android hardware/gesture back-button guard (no-op on web and iOS).
 *
 * The back button is the single biggest "accidental exit" vector on Android. We
 * intercept it so that:
 *   - inside a game: it NEVER navigates away; it fires `storybloom:request-quit`,
 *     which the in-game QuitGameDialog listens for (reusing the existing quit UX).
 *   - elsewhere: it walks in-app history, but refuses to close the app from a
 *     top-level screen (a determined toddler can't back out into the OS).
 */
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { Capacitor } from '@capacitor/core'

/** Event the QuitGameDialog listens for to open its confirm. */
export const REQUEST_QUIT_EVENT = 'storybloom:request-quit'

/**
 * Install the back-button guard. `isInGame()` should read the live immersive/game
 * state (e.g. a ref). Returns a cleanup function that removes the listener.
 */
export function installBackButtonGuard(isInGame: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  let handle: PluginListenerHandle | undefined
  App.addListener('backButton', ({ canGoBack }) => {
    if (isInGame()) {
      // In a game: do NOT navigate. Ask the game to confirm a quit instead.
      window.dispatchEvent(new CustomEvent(REQUEST_QUIT_EVENT))
      return
    }
    if (canGoBack) {
      window.history.back()
    }
    // else: ignore — don't let the back button close the app from a home screen.
  }).then((h) => {
    handle = h
  })

  return () => {
    handle?.remove()
  }
}
