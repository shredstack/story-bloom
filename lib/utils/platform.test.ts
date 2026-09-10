import { describe, expect, it } from 'vitest'
import { isFireOS } from './platform'

describe('isFireOS', () => {
  const FIRE_UAS = [
    // Fire HD 10, Silk browser
    'Mozilla/5.0 (Linux; Android 9; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/109.4.4 like Chrome/109.0.5414.118 Safari/537.36',
    // Fire HD 8, Fire OS WebView (reports as Chrome — only the model gives it away)
    'Mozilla/5.0 (Linux; Android 9; KFONWI Build/PS7326; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/106.0.5249.126 Safari/537.36',
    // Older Kindle Fire, with the Silk-Accelerated token
    'Mozilla/5.0 (Linux; U; Android 4.0.3; en-us; KFTT Build/IML74K) AppleWebKit/535.19 Silk-Accelerated=true',
    // Fire OS 5 (Chromium ~59) — the generation whose WebView can't parse a
    // regex lookbehind, which is why FIRE_MODEL uses a consuming group.
    'Mozilla/5.0 (Linux; U; Android 5.1.1; en-us; KFAUWI Build/LVY48F) AppleWebKit/537.36 (KHTML, like Gecko) Silk/59.3.1 like Chrome/59.0.3071.125 Safari/537.36',
    // Model code at the very start of the string — the `^` half of the leading
    // group, which has no other coverage.
    'KFTRWI Build/PS7326 AppleWebKit/537.36',
  ]

  const OTHER_UAS = [
    // Desktop Chrome
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // iPad Safari
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    // A normal Android tablet — has Google services, Web Speech works
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Safari/537.36',
    // Near miss: a hyphenated model that merely ends in a Fire-shaped token.
    // A hyphen is a word boundary, so this is exactly what \b alone gets wrong.
    'Mozilla/5.0 (Linux; Android 13; SM-KFOO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Safari/537.36',
    // Near miss: the letters appear mid-token, not as a model code.
    'Mozilla/5.0 (Linux; Android 13; ABCKFTT) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Near miss: "KF" with too few following letters to be a model code.
    'Mozilla/5.0 (Linux; Android 13; KFX) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Near miss: lowercase silk in a path, not the Silk browser token.
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 silk/tester Chrome/120.0.0.0',
  ]

  it.each(FIRE_UAS)('detects Fire OS: %s', (ua) => {
    expect(isFireOS(ua)).toBe(true)
  })

  it.each(OTHER_UAS)('leaves other devices alone: %s', (ua) => {
    expect(isFireOS(ua)).toBe(false)
  })
})
