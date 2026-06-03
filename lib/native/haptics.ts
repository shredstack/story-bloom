/**
 * Tactile feedback helpers for game actions. No-op on web (the Haptics plugin
 * ships a web shim, and we additionally guard on `isNativePlatform`), so call
 * sites can fire these unconditionally.
 *
 * Kids tap harder / re-tap when nothing "happens", which causes double-actions —
 * a light tap on press and a success buzz on a correct answer make a registered
 * tap unmistakable (pairs with the debounce in KidButton).
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** Light bump on a meaningful tap. */
export function tapHaptic(): void {
  if (!Capacitor.isNativePlatform()) return
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

/** Medium bump for a more substantial action (e.g. taking a photo). */
export function mediumHaptic(): void {
  if (!Capacitor.isNativePlatform()) return
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
}

/** Celebratory buzz when the kid gets something right. */
export function successHaptic(): void {
  if (!Capacitor.isNativePlatform()) return
  void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
}

/** Gentle warning buzz (e.g. an incorrect attempt — kept soft so it isn't punishing). */
export function warningHaptic(): void {
  if (!Capacitor.isNativePlatform()) return
  void Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
}
