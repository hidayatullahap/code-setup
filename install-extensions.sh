#!/usr/bin/env bash
set -euo pipefail
#
# install-extensions.sh — install chat-only and generate-design pi extensions
#
# Copies extension files from the repo (or from a cloned copy) into
# $HOME/.pi/agent/extensions/ so pi can discover them.
#
# Usage:
#   ./install-extensions.sh                          # from repo root (local dev)
#   ./install-extensions.sh --from-clone DIR         # from setup.sh after git clone
#   ./install-extensions.sh --source DIR --dest DIR  # custom paths
#   curl -fsSL .../install-extensions.sh | bash      # standalone (uses local extensions/ if present)
#
# Idempotent — safe to run multiple times; existing files are overwritten.

SRC_DIR=""
DEST_DIR="${HOME}/.pi/agent/extensions"

while [ $# -gt 0 ]; do
  case "$1" in
    --from-clone) SRC_DIR="${2:-}"; shift 2 ;;
    --source) SRC_DIR="${2:-}"; shift 2 ;;
    --dest) DEST_DIR="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; echo "Usage: $0 [--from-clone DIR] [--source DIR] [--dest DIR]" >&2; exit 1 ;;
  esac
done

# Resolve source dir — explicit --from-clone/--source wins, else script dir, else cwd
if [ -z "$SRC_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # Script lives at repo root; extensions/ is sibling
  if [ -d "$SCRIPT_DIR/extensions" ]; then
    SRC_DIR="$SCRIPT_DIR"
  elif [ -d "$SCRIPT_DIR/../extensions" ]; then
    SRC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  else
    SRC_DIR="$(pwd)"
  fi
fi

echo "==> Installing pi extensions from: $SRC_DIR"
echo "    Destination: $DEST_DIR"

mkdir -p "$DEST_DIR"

# ---- chat-only ----
echo "==> Installing chat-only extension..."
CHAT_SRC="$SRC_DIR/extensions/chat-only/chat-only.js"
CHAT_DEST="$DEST_DIR/chat-only/chat-only.js"
mkdir -p "$(dirname "$CHAT_DEST")"
if [ -s "$CHAT_SRC" ]; then
  cp "$CHAT_SRC" "$CHAT_DEST"
  echo "    Installed chat-only -> $CHAT_DEST (from $CHAT_SRC)"
else
  echo "Warning: extensions/chat-only/chat-only.js not found in source ($SRC_DIR), skipping" >&2
  echo "         Looked at: $CHAT_SRC" >&2
fi

# ---- generate-design ----
echo "==> Installing generate-design extension..."
GD_SRC="$SRC_DIR/extensions/generate-design"
GD_DEST="$DEST_DIR/generate-design"
if [ -d "$GD_SRC" ]; then
  mkdir -p "$GD_DEST"
  # Copy everything (including skills/) — use /. to preserve structure, handling empty glob safely
  # Prefer cp -a if available; fall back to cp -r
  if cp -a "$GD_SRC/." "$GD_DEST/" 2>/dev/null; then
    :
  else
    cp -r "$GD_SRC/." "$GD_DEST/" 2>/dev/null || cp -r "$GD_SRC"/* "$GD_DEST/" 2>/dev/null || true
  fi
  # Verify critical files
  if [ -f "$GD_DEST/manifest.json" ] && [ -d "$GD_DEST/skills" ]; then
    SKILL_COUNT="$(find "$GD_DEST/skills" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')"
    echo "    Installed generate-design -> $GD_DEST/ ($SKILL_COUNT skill(s), manifest.json present)"
  elif [ -f "$GD_DEST/index.ts" ] || [ -f "$GD_DEST/manifest.json" ]; then
    echo "    Installed generate-design -> $GD_DEST/ (partial — check skills/ folder)"
    if [ ! -d "$GD_DEST/skills" ]; then
      echo "Warning: $GD_DEST/skills not found after copy — extension will use built-in fallbacks" >&2
    fi
  else
    echo "Warning: generate-design install may be incomplete — no index.ts or manifest.json at $GD_DEST" >&2
  fi
else
  echo "Warning: extensions/generate-design not found in source ($SRC_DIR), skipping" >&2
  echo "         Looked at: $GD_SRC" >&2
fi

echo "==> Extensions installed. Verify with: pi list && find \"$DEST_DIR\" -maxdepth 3"
find "$DEST_DIR" -maxdepth 3 2>/dev/null | head -n 80 || true
