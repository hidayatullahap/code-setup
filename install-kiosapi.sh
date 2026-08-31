#!/usr/bin/env bash
set -euo pipefail
# install-kiosapi.sh — install kiosapi pi extension
# Copies F:/dev/etc/setup/extensions/kiosapi into ~/.pi/agent/extensions/kiosapi
# Usage:
#   ./install-kiosapi.sh
#   ./install-kiosapi.sh --source DIR --dest DIR

SRC_DIR=""
DEST_DIR="${HOME}/.pi/agent/extensions/kiosapi"

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SRC_DIR="$2"; shift 2 ;;
    --dest) DEST_DIR="$2"; shift 2 ;;
    -h|--help) echo "Usage: $0 [--source DIR] [--dest DIR]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$SRC_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  SRC_DIR="$SCRIPT_DIR/extensions/kiosapi"
  # fallback when run from repo root
  if [ ! -d "$SRC_DIR" ] && [ -d "$SCRIPT_DIR/../extensions/kiosapi" ]; then
    SRC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/extensions/kiosapi"
  fi
  if [ ! -d "$SRC_DIR" ] && [ -d "$(pwd)/extensions/kiosapi" ]; then
    SRC_DIR="$(pwd)/extensions/kiosapi"
  fi
fi

echo "==> Installing kiosapi extension"
echo "    Source: $SRC_DIR"
echo "    Dest:   $DEST_DIR"

if [ ! -f "$SRC_DIR/index.ts" ]; then
  echo "Error: $SRC_DIR/index.ts not found" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
cp "$SRC_DIR/index.ts" "$DEST_DIR/index.ts"
if [ -f "$SRC_DIR/README.md" ]; then
  cp "$SRC_DIR/README.md" "$DEST_DIR/README.md"
fi

echo "    Installed -> $DEST_DIR/index.ts"
echo "==> Verify: pi --list-models | grep kiosapi"
echo "==> Login:  pi then /login kiosapi  or  export KIOS_API_KEY=sk-..."
echo "==> Use:    pi --model kiosapi/Qwen/Qwen3-8B -p \"Hello!\""
