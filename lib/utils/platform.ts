/**
 * Device quirks that change which speech implementation a game can use.
 *
 * Kept as pure functions over a user-agent string so they can be tested without
 * a browser, and so a caller can decide when to read `navigator`.
 */

/** Amazon Fire tablet model codes: "KF" + uppercase letters (KFOT … KFTRWI). */
const FIRE_MODEL = /\bKF[A-Z]{2,}\b/

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
