import type { AppSettingsResponse } from '@/lib/types'

/**
 * GET /api/app-settings, with concurrent callers sharing one request.
 *
 * A game page starts two hooks at once that both need settings
 * (`useAnswerCheckMode` for the input mode, `useGrownUpUnlock` for the PIN), and
 * on the tablets this feature exists for, a saved round-trip at game start is
 * worth having.
 *
 * Only the IN-FLIGHT promise is shared, never a settled result: a parent who
 * changes the mode and walks back into a game must see the new value, so every
 * fresh mount still asks.
 */
let inFlight: Promise<AppSettingsResponse | null> | null = null

export function fetchAppSettings(): Promise<AppSettingsResponse | null> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const res = await fetch('/api/app-settings')
      if (!res.ok) return null
      const { settings } = await res.json()
      return (settings ?? null) as AppSettingsResponse | null
    } catch {
      return null
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
