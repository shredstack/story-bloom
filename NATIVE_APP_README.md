# StoryBloom Native Apps — Build, Install & Lock-Down Guide

StoryBloom ships as **iOS + Android tablet apps** that are a thin
[Capacitor](https://capacitorjs.com/) wrapper around the live web app at
**https://story-bloom.shredstack.net**. The app is just a full-screen WebView
pointed at that URL, with a native layer added for kid-proof lock-down (hidden
system bars, guarded back button, locked orientation, haptics).

> **The most important thing to understand:** there is **no separate mobile
> codebase**. Normal feature/game work is plain web work — you deploy it to
> `story-bloom.shredstack.net` and the installed apps pick it up on the next
> launch. You only rebuild/reinstall the native app when **native config or
> plugins** change (see [Updating](#updating-the-app)).

The full technical design is in
[`claude_instruction_docs/capacitor_native_app_spec.md`](claude_instruction_docs/capacitor_native_app_spec.md).

---

## Prerequisites (one-time)

| Platform | You need |
|----------|----------|
| **Both** | This repo cloned, `npm install` run, Node 18+. |
| **Android** | [Android Studio](https://developer.android.com/studio). On the tablet: Settings → About → tap **Build number** 7× to unlock **Developer options**, then turn on **USB debugging**. |
| **iOS** | **Xcode** + an Apple ID. A **free** Apple ID works for direct-to-device install (the app expires after 7 days). A paid **Apple Developer** account ($99/yr) adds **TestFlight** and 1-year installs. |

There's nothing to configure for the URL — the app points at
`https://story-bloom.shredstack.net` by default.

---

## Before you build: make sure production is current

The native shell loads whatever is deployed at the production URL. So before
installing on a tablet:

1. Make sure the branch you want is **merged to `main` and deployed** to
   `story-bloom.shredstack.net` (the kid-UX components and the iOS speech route
   live in the web app, not the shell).
2. Confirm **`OPENAI_API_KEY`** is set in the hosted (Vercel) environment — the
   iPad read-aloud games (Word Quest, Sentence Shenanigans) transcribe speech via
   the `/api/speech/transcribe` route, which needs it. (iOS WKWebView has no Web
   Speech API, so this server fallback is what makes the mic games work on iPad.)

---

## Build the native projects

From the repo root:

```bash
npm run build:mobile     # writes the offline-fallback page + runs `cap sync`
```

Then open the platform you want:

```bash
npm run cap:open:android  # opens Android Studio
npm run cap:open:ios      # opens Xcode
```

---

## Install on the Android tablet

### First, put the tablet into developer mode (one-time, on the tablet itself)

Trusting the device on your **laptop** is not enough — Android needs developer
mode + USB debugging enabled **on the tablet**, or it never appears in Android
Studio's device dropdown and no prompt shows up.

1. On the tablet: **Settings → About tablet** (Samsung: **About tablet → Software
   information**). Tap **Build number** **7 times** until it says "Developer mode
   has been turned on" (enter your PIN if asked).
   - **⚠️ Amazon Fire tablets are different:** there's no "Build number." Go to
     **Settings → Device Options → About Fire Tablet** and tap **Serial Number**
     **7 times**. **Developer options** then appears back under **Device Options**.
2. Back in **Settings → Developer options** (usually under **System**; on Fire it's
   under **Device Options**), turn on **USB debugging** and confirm.
3. Plug the tablet into the laptop with USB debugging now on. **Watch the
   tablet's screen** — an **"Allow USB debugging?"** dialog showing the laptop's
   RSA fingerprint appears *on the tablet*. Check **"Always allow from this
   computer"** and tap **Allow**.
   - No prompt? Pull down the notification shade, tap the USB notification, and
     switch USB mode from **"Charging only"** to **"File transfer (MTP)"** — that
     triggers the debugging prompt.
4. Verify the host sees it:
   ```bash
   adb devices    # or ~/Library/Android/sdk/platform-tools/adb devices
   ```
   You want a line like `R52NB0XXXXX   device`. If it says **`unauthorized`**, you
   haven't tapped **Allow** yet (step 3). If the list is **empty**, the tablet
   isn't in debug mode, or it's a charge-only cable/port — try another cable and
   set USB mode to **File transfer (MTP)**.

### Easiest — run straight from Android Studio (USB):
1. `npm run cap:open:android`.
2. Plug in the tablet, accept the "Allow USB debugging?" prompt (see above).
3. Pick the tablet in the device dropdown (top bar) → click **▶ Run**.
   The app installs and launches. (If the dropdown is empty, the device isn't
   authorized yet — fix it with the developer-mode steps above.)

**Sharable APK — install without a cable:**
1. Android Studio → **Build → Build APK(s)** (debug) or **Build → Generate Signed
   Bundle / APK → APK** (release; create a keystore when prompted).
2. The debug APK lands at
   `android/app/build/outputs/apk/debug/app-debug.apk` (Android Studio shows a
   "locate" link).
3. Transfer it to the tablet (email / Google Drive / USB), tap it, allow
   **"Install unknown apps"** for that source, and install.

No Google account or Play Store review is needed for a family beta.

---

## Install on the iPad

1. `npm run cap:open:ios` to open Xcode.
2. Plug in the iPad and select it as the run destination (top bar).
3. Left panel → **App** target → **Signing & Capabilities** → check
   **Automatically manage signing** → choose your **Team**. (Add your Apple ID via
   **Xcode → Settings → Accounts** if it isn't listed.)
4. Click **▶ Run**.
5. First launch shows an "Untrusted Developer" error. On the iPad go
   **Settings → General → VPN & Device Management → [your Apple ID] → Trust**, then
   tap the app again.

**TestFlight (paid Developer account, nicer for ongoing updates):**
`npm run cap:open:ios` → **Product → Archive** → upload → add the kids' Apple IDs
under **Internal Testing** → they install via the TestFlight app.

---

## Lock it down so the kids can't escape

The app already hides the system bars and guards the back button, but enable the
**OS-level kiosk lock** on each tablet as the hard backstop:

- **iPad — Guided Access:** Settings → Accessibility → **Guided Access** → On, and
  set a passcode. In StoryBloom, **triple-click** the side/top button to lock to
  the app; triple-click + passcode to exit.
- **Android — Screen Pinning:** Settings → Security → **App pinning** → On. Open
  StoryBloom → open Recents → tap the app's icon → **Pin**. Unpin by holding
  Back + Home (or Back + Recents).

---

## Updating the app

| What changed | What to do |
|--------------|------------|
| Web app / games / styling / API routes | **Nothing on the device.** Deploy to `story-bloom.shredstack.net`; the apps load it on next launch. |
| Capacitor config, native plugins, app icon/splash, permissions | Rebuild & reinstall: `npm run build:mobile` → `cap:open:*` → Run/Archive again. |

To regenerate app icons & splash screens from the brand logo
(`public/storybloom_logo.png`):

```bash
brew install imagemagick        # one-time
./scripts/generate-app-assets.sh
npm run cap:sync
```

---

## Troubleshooting

- **Blank screen / "needs the internet":** the app requires connectivity (it loads
  the hosted site). Check Wi-Fi. The offline page has a **Try Again** button.
- **Mic games do nothing on iPad:** confirm `OPENAI_API_KEY` is set in the
  production environment (the iOS speech fallback POSTs to `/api/speech/transcribe`).
- **Camera/mic permission denied:** a parent should do first-run setup and allow
  the prompts. Usage strings are in `ios/App/App/Info.plist` and the Android
  manifest.
- **Have to log in every launch:** the Supabase session cookie should persist
  across cold starts. Use email/password for the beta (avoids OAuth-in-WebView).
- **Debugging the WebView:** Safari → Develop → [your iPad] (iOS), or
  `chrome://inspect` (Android), while the app is open.

---

## (Optional) Pointing at a local dev server

For native-shell development you can point the app at your laptop instead of
production:

```bash
npm run dev -- -H 0.0.0.0    # serve on your LAN, e.g. http://<your-ip>:3000
CAPACITOR_SERVER_URL=http://<your-ip>:3000 npm run cap:sync:android
```

Android allows plain `http` over the LAN in dev. iOS (WKWebView) blocks plain
`http`, so for on-device iOS dev use an HTTPS tunnel (e.g. `ngrok http 3000`) and
pass that `https://…` URL as `CAPACITOR_SERVER_URL`. For most testing, just use the
production URL (the default) — no extra setup.
