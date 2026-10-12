#!/usr/bin/env bash
# Downloads Kenney "Casino Audio" (CC0, https://kenney.nl/assets/casino-audio) and converts four samples
# to AAC (.m4a — plays in iOS Safari). Run from anywhere; writes apps/app/public/sounds.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$APP/public/sounds"
FALLBACK_URL="https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip"
URL="$(curl -fsSL https://kenney.nl/assets/casino-audio | grep -oE 'https://kenney.nl/media/pages/assets/casino-audio/[^"'"'"' ]+\.zip' | head -1 || true)"
URL="${URL:-$FALLBACK_URL}"
if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg not found — skipping samples; the app will use synthesized sounds." >&2
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$URL" -o "$TMP/kenney.zip"
mkdir "$TMP/x"
unzip -q "$TMP/kenney.zip" -d "$TMP/x"
mkdir -p "$OUT"
convert() { ffmpeg -loglevel error -y -i "$TMP/x/Audio/$1" -ac 1 -c:a aac -b:a 64k "$OUT/$2.m4a"; }
convert card-place-1.ogg card
convert card-shuffle.ogg shuffle
convert card-slide-3.ogg sweep
convert chip-lay-1.ogg turn
cp "$TMP/x/License.txt" "$OUT/LICENSE-kenney-casino-audio.txt"
ls -l "$OUT"
