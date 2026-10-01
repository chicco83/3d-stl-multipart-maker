#!/usr/bin/env bash
# =============================================================================
# 3D STL Multipart Maker — build.sh
# Versione: 0.6.0-beta — 2026-10-01 11:03
# -----------------------------------------------------------------------------
# Compila l'intero progetto (da Linux, macOS o WSL; serve Node >= 18 e Go >= 1.22):
#   1. bundle del frontend (web/) con esbuild -> web/dist
#   2. copia di dist nel launcher Go (incorporato con go:embed)
#   3. cross-compilazione dell'eseguibile Windows portable (senza console)
# Uso:  ./build.sh 0.6.0-beta
# =============================================================================
set -euo pipefail
VER="${1:-0.6.0-beta}"
STAMP="$(date +%Y%m%d-%H%M)"
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT/web"
[ -d node_modules ] || npm install
BUILD_STAMP="$VER $STAMP" node build.mjs

rm -rf "$ROOT/launcher/dist" && cp -r "$ROOT/web/dist" "$ROOT/launcher/dist"
cd "$ROOT/launcher"
# icona dell'eseguibile (richiede: go install github.com/akavel/rsrc@latest)
# [2026-09-28 v0.1.0] if command -v rsrc >/dev/null 2>&1; then rsrc -ico "$ROOT/icon.ico" -arch amd64 -o rsrc_windows_amd64.syso; fi
# v0.2.0: manifest (id 1: DPI per-monitor, controlli v6) + icona (gruppo id 2, usato dalla finestra nativa)
if command -v rsrc >/dev/null 2>&1; then rsrc -manifest app.manifest -ico "$ROOT/icon.ico" -arch amd64 -o rsrc_windows_amd64.syso; fi
mkdir -p "$ROOT/release"
# [2026-09-28 v0.2.0] ... -o "$ROOT/release/ModelSplitterEvo_v${VER}_${STAMP}.exe" .
# v0.3.0: nuovo nome del programma
EXE="3D-STL-Multipart-Maker_v${VER}_${STAMP}.exe"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H windowsgui -s -w" -o "$ROOT/release/$EXE" .
echo "Creato: release/$EXE"
