#!/usr/bin/env bash
# Builds the SPA for the sandbox preview (base /portal/ + emulator wiring)
# and copies it into the Next.js workspace static folder.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[preview-build] building SPA with base=/portal/ (mode: preview)…"
npx vite build --mode preview --base=/portal/ --outDir dist-portal --emptyOutDir

DEST="${1:-/home/z/my-project/public/portal}"
echo "[preview-build] copying to $DEST …"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r dist-portal/* "$DEST/"
echo "[preview-build] done."
