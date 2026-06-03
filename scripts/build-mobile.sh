#!/usr/bin/env bash
#
# build-mobile.sh — prepare the minimal offline-fallback page and sync Capacitor.
#
# StoryBloom is a REMOTE-server (WebView) Capacitor app: the native shell loads
# the live site from https://story-bloom.shredstack.net. We are NOT doing a real
# Next.js static export — `out/` only holds a tiny "you're offline" page that the
# WebView falls back to when the hosted site is unreachable.
#
# Usage:
#   ./scripts/build-mobile.sh          # sync all platforms
#   ./scripts/build-mobile.sh ios      # sync iOS only
#   ./scripts/build-mobile.sh android  # sync Android only
set -euo pipefail

PLATFORM="${1:-}"   # "", "ios", or "android"

mkdir -p out
cat > out/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>StoryBloom</title>
  <style>
    html,body{height:100%;margin:0;background:#ffffff;color:#701a75;
      font-family:'Nunito',system-ui,-apple-system,sans-serif;display:flex;align-items:center;
      justify-content:center;text-align:center;padding:2rem}
    .wrap{max-width:28rem}
    h1{font-size:1.75rem;margin:0 0 .75rem}
    p{color:#6b7280;font-size:1.1rem}
    button{margin-top:1.5rem;font-size:1.25rem;padding:0.9rem 1.6rem;border:none;
      border-radius:1rem;background:#d946ef;color:#fff;font-weight:800;cursor:pointer}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>StoryBloom needs the internet 🌱</h1>
    <p>Make sure the tablet is connected to Wi-Fi, then try again.</p>
    <button onclick="location.href='https://story-bloom.shredstack.net'">Try Again</button>
  </div>
</body>
</html>
HTML

echo "Created offline-fallback out/index.html"

if [ -n "$PLATFORM" ]; then
  npx cap sync "$PLATFORM"
else
  npx cap sync
fi
