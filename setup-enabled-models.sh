#!/usr/bin/env bash
set -euo pipefail

SETTINGS_FILE="${SETTINGS_FILE:-$HOME/.pi/agent/settings.json}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || SCRIPT_DIR="$PWD"
MODELS_SOURCE="$SCRIPT_DIR/enabled-models.json"
if [ -s "$MODELS_SOURCE" ] && jq -e '.enabledModels' "$MODELS_SOURCE" >/dev/null 2>&1; then
  MODELS_JSON="$(jq -c '.enabledModels' "$MODELS_SOURCE")"
else
  MODELS_JSON='[
  "opencode-go/glm-5.3-flash",
  "opencode/hy3-free",
  "opencode/mimo-v2.5-free",
  "opencode/ling-3.0-flash-fin-free",
  "opencode/muse-spark-1.2-contributor-free"
]'
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Warning: jq is required but not found, cannot update $SETTINGS_FILE" >&2
  echo "Install jq first (e.g. sudo apt-get install -y jq)" >&2
  exit 0
fi

mkdir -p "$(dirname "$SETTINGS_FILE")"
if [ ! -s "$SETTINGS_FILE" ]; then
  echo "{}" >"$SETTINGS_FILE"
fi

if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
  echo "Warning: $SETTINGS_FILE is not valid JSON, backing up and resetting" >&2
  cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak.$(date +%s)" 2>/dev/null || true
  echo "{}" >"$SETTINGS_FILE"
fi

if ! MERGED="$(jq --argjson models "$MODELS_JSON" '
  .enabledModels = ((.enabledModels // []) + $models | unique)' "$SETTINGS_FILE" 2>/dev/null)"; then
  echo "Warning: failed to merge enabledModels into $SETTINGS_FILE" >&2
  exit 0
fi

if printf '%s' "$MERGED" | jq empty 2>/dev/null; then
  printf '%s\n' "$MERGED" >"$SETTINGS_FILE"
  echo "Merged enabledModels into $SETTINGS_FILE"
else
  echo "Warning: failed to merge enabledModels into $SETTINGS_FILE" >&2
  exit 0
fi
