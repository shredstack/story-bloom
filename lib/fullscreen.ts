/**
 * SSR-safe, vendor-prefixed Fullscreen API helpers.
 *
 * Used to lock kids into a focused game on a tablet/desktop browser. Both calls
 * no-op and swallow errors when fullscreen is unsupported (e.g. iPhone Safari,
 * which only allows fullscreen on <video>), so callers never need to guard —
 * the immersive chrome-hiding still applies even when real fullscreen can't.
 *
 * NOTE: `enterFullscreen()` must be called synchronously inside a user gesture
 * (e.g. a tap handler) or the browser will reject it. It survives subsequent
 * client-side navigation because it targets the persistent <html> element.
 */

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  webkitRequestFullScreen?: () => Promise<void> | void
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
}

function swallow(result: Promise<void> | void) {
  if (result && typeof (result as Promise<void>).catch === 'function') {
    ;(result as Promise<void>).catch(() => {})
  }
}

export function enterFullscreen() {
  if (typeof document === 'undefined') return
  const el = document.documentElement as FullscreenElement
  const request =
    el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen
  if (!request) return
  try {
    swallow(request.call(el))
  } catch {
    /* unsupported — fall back to in-app immersive mode */
  }
}

export function exitFullscreen() {
  if (typeof document === 'undefined') return
  const doc = document as FullscreenDocument
  if (!doc.fullscreenElement && !doc.webkitFullscreenElement) return
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen
  if (!exit) return
  try {
    swallow(exit.call(doc))
  } catch {
    /* ignore */
  }
}
