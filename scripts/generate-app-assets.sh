#!/usr/bin/env bash
#
# generate-app-assets.sh — build iOS + Android app icons and splash screens
# for the StoryBloom Capacitor apps from the brand logo.
#
# What it does:
#   1. Prepares opaque source assets in ./assets/ from public/storybloom_logo.png
#      (iOS rejects icons with transparency, so the icon is flattened onto a
#      solid background).
#   2. Runs @capacitor/assets, which generates every icon/splash size into the
#      native ios/ and android/ projects (including Android adaptive icons).
#
# Prereqs:
#   - ImageMagick: `brew install imagemagick`  (provides `magick`)
#   - The native projects must already exist: `npx cap add ios && npx cap add android`
#   - Run from the repo root:  ./scripts/generate-app-assets.sh
#
# After running:  npx cap sync   (then rebuild in Xcode / Android Studio)

set -euo pipefail

# ---- Config -----------------------------------------------------------------
LOGO_SRC="public/storybloom_logo.png"   # 1024x1024 brand logo (has transparency)
ASSETS_DIR="assets"

# Light theme to match the app (near-white). Swap to brand fuchsia for a
# colorful splash:  ICON_BG="#d946ef"  SPLASH_BG="#d946ef"
ICON_BG="#ffffff"          # opaque background behind the logo on the icon
ICON_BG_DARK="#701a75"     # primary-900 — dark-mode icon background
SPLASH_BG="#ffffff"        # splash background (light mode)
SPLASH_BG_DARK="#701a75"   # splash background (dark mode)

# How big the logo sits inside the 2732x2732 splash canvas.
SPLASH_LOGO_SIZE=1000
# -----------------------------------------------------------------------------

# ---- Sanity checks ----------------------------------------------------------
if ! command -v magick >/dev/null 2>&1; then
  echo "ERROR: ImageMagick not found. Install with: brew install imagemagick" >&2
  exit 1
fi

if [ ! -f "$LOGO_SRC" ]; then
  echo "ERROR: $LOGO_SRC not found. Run this from the repo root." >&2
  exit 1
fi

if [ ! -d "ios" ] && [ ! -d "android" ]; then
  echo "ERROR: no ios/ or android/ project found." >&2
  echo "       Run 'npx cap add ios' and/or 'npx cap add android' first." >&2
  exit 1
fi

mkdir -p "$ASSETS_DIR"

# ---- 1. Icon (1024x1024, opaque — iOS-safe) ---------------------------------
# Flatten the transparent logo onto a solid background so iOS accepts it.
echo "→ Building $ASSETS_DIR/icon.png (opaque, ${ICON_BG})"
magick "$LOGO_SRC" -resize 1024x1024 \
  -background "$ICON_BG" -gravity center -extent 1024x1024 \
  -flatten -alpha remove -alpha off \
  "$ASSETS_DIR/icon.png"

# Optional: separate foreground/background for nicer Android adaptive icons.
# The foreground keeps transparency; @capacitor/assets composites it over the
# background color and applies the system mask.
echo "→ Building $ASSETS_DIR/icon-foreground.png + icon-background.png"
# Pad the logo to ~66% so it isn't clipped by the circular/rounded mask.
magick "$LOGO_SRC" -resize 700x700 \
  -background none -gravity center -extent 1024x1024 \
  "$ASSETS_DIR/icon-foreground.png"
magick -size 1024x1024 "xc:${ICON_BG}" "$ASSETS_DIR/icon-background.png"

# ---- 2. Splash (2732x2732, logo centered) -----------------------------------
echo "→ Building $ASSETS_DIR/splash.png (${SPLASH_BG})"
magick -size 2732x2732 "xc:${SPLASH_BG}" \
  \( "$LOGO_SRC" -resize ${SPLASH_LOGO_SIZE}x${SPLASH_LOGO_SIZE} \) \
  -gravity center -composite \
  "$ASSETS_DIR/splash.png"

echo "→ Building $ASSETS_DIR/splash-dark.png (${SPLASH_BG_DARK})"
magick -size 2732x2732 "xc:${SPLASH_BG_DARK}" \
  \( "$LOGO_SRC" -resize ${SPLASH_LOGO_SIZE}x${SPLASH_LOGO_SIZE} \) \
  -gravity center -composite \
  "$ASSETS_DIR/splash-dark.png"

# ---- 3. Generate all native sizes -------------------------------------------
echo "→ Running @capacitor/assets generate"
npx @capacitor/assets generate \
  --assetPath "$ASSETS_DIR" \
  --iconBackgroundColor "$ICON_BG" \
  --iconBackgroundColorDark "$ICON_BG_DARK" \
  --splashBackgroundColor "$SPLASH_BG" \
  --splashBackgroundColorDark "$SPLASH_BG_DARK"

echo ""
echo "✅ Done. Icons + splash generated into ios/ and android/."
echo "   Next:  npx cap sync   then rebuild in Xcode / Android Studio."
