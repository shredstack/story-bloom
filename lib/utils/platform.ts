/**
 * Device quirks that change which speech implementation a game can use.
 *
 * Kept as pure functions over a user-agent string so they can be tested without
 * a browser, and so a caller can decide when to read `navigator`.
 */

/**
 * Amazon Fire tablet model codes: "KF" + uppercase letters (KFOT … KFTRWI).
 *
 * The leading group matters twice over.
 *
 * A plain `\b` treats a hyphen as a boundary, so a model like `SM-KFOO` would
 * read as a Fire tablet and cost that whole session paid server transcription
 * for nothing. Fire codes appear either standalone (`; KFTRPWI;`) or after the
 * Build slash (`Build/KFTRWI`), never glued to a preceding word.
 *
 * And it has to be a consuming group rather than a lookbehind, which is
 * Chromium 62+ / Safari 16.4+. Fire OS 5 WebViews are Chromium ~59 and iOS 15
 * caps out below 16.4 — a regex *literal* can't be transpiled, so on exactly
 * the hand-me-down tablets this detection exists for, the module would fail to
 * parse and take every game page down with it.
 */
const FIRE_MODEL = /(?:^|[^A-Za-z-])KF[A-Z]{2,}\b/

/** Amazon's Chromium fork. Appears as "Silk/109.4.4" or "Silk-Accelerated=true". */
const SILK = /\bSilk[/-]/

/**
 * True for Amazon Fire tablets, in Silk or in the Fire OS WebView.
 *
 * Why any of this matters: Fire OS ships no Google services, but Silk is
 * Chromium, so the Google-backed web APIs are still *defined* — they simply
 * never do anything. `speechSynthesis.getVoices()` returns `[]` (see
 * `useWordSpeech`), and `webkitSpeechRecognition` constructs and starts without
 * ever producing a result. Feature detection cannot see either failure, so the
 * device has to be recognised by name.
 */
export function isFireOS(userAgent: string): boolean {
  return SILK.test(userAgent) || FIRE_MODEL.test(userAgent)
}

/** Browser-side convenience wrapper; false during SSR. */
export function isFireOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return isFireOS(navigator.userAgent)
}
