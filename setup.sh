#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="https://raw.githubusercontent.com/hidayatullahap/code-setup/refs/heads/main"

echo "==> Installing pi..."
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

echo "==> Installing pi packages..."
pi install npm:pi-web-access
pi install npm:pi-subagents
pi install npm:@juicesharp/rpiv-ask-user-question
pi install npm:@narumitw/pi-btw
pi install npm:@narumitw/pi-plan-mode
pi install npm:vision-handoff

echo "==> Configuring vision handoff..."
mkdir -p "$HOME/.pi/agent"
if [ ! -f "$HOME/.pi/agent/vision.json" ]; then
  cat > "$HOME/.pi/agent/vision.json" <<'EOF'
{
  "provider": "opencode-go",
  "model": "gpt-5.6-luna"
}
EOF
  echo "Created \$HOME/.pi/agent/vision.json (opencode-go/gpt-5.6-luna)"
else
  echo "vision.json already exists, skipping"
fi

echo "==> Appending AGENTS.md..."
AGENTS_URL="$REPO_ROOT/AGENTS.md"
mkdir -p "$HOME/.pi/agent"
touch "$HOME/.pi/agent/AGENTS.md"
TMP_AGENTS="$(mktemp)"
if curl -fsSL "$AGENTS_URL" -o "$TMP_AGENTS"; then
  if ! grep -qF "$(head -n 1 "$TMP_AGENTS")" "$HOME/.pi/agent/AGENTS.md" 2>/dev/null; then
    cat "$TMP_AGENTS" >> "$HOME/.pi/agent/AGENTS.md"
    echo "Appended AGENTS.md to \$HOME/.pi/agent/AGENTS.md"
  else
    echo "AGENTS.md already appended, skipping"
  fi
else
  echo "Failed to fetch AGENTS.md from $AGENTS_URL" >&2
fi
rm -f "$TMP_AGENTS"

echo "==> Configuring subagents in settings.json..."
mkdir -p "$HOME/.pi/agent"
SETTINGS_FILE="$HOME/.pi/agent/settings.json"
SUBAGENTS_URL="$REPO_ROOT/subagents.json"
TMP_SUBAGENTS="$(mktemp)"
SUBAGENTS_SRC=""

if curl -fsSL "$SUBAGENTS_URL" -o "$TMP_SUBAGENTS" 2>/dev/null && [ -s "$TMP_SUBAGENTS" ]; then
  SUBAGENTS_SRC="$TMP_SUBAGENTS"
  echo "Fetched subagents.json from $SUBAGENTS_URL"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd || pwd)"
  for candidate in "$SCRIPT_DIR/subagents.json" "./subagents.json" "$(dirname "$0")/subagents.json"; do
    if [ -f "$candidate" ]; then
      SUBAGENTS_SRC="$candidate"
      echo "Using local subagents.json at $candidate"
      break
    fi
  done
  rm -f "$TMP_SUBAGENTS"
fi

if [ -z "$SUBAGENTS_SRC" ] || [ ! -f "$SUBAGENTS_SRC" ]; then
  echo "Warning: subagents.json not found (tried $SUBAGENTS_URL and local file), skipping" >&2
else
  if [ ! -f "$SETTINGS_FILE" ] || [ ! -s "$SETTINGS_FILE" ]; then
    echo "{}" > "$SETTINGS_FILE"
  fi
  if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
    echo "Warning: $SETTINGS_FILE is not valid JSON, backing up and resetting" >&2
    cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak.$(date +%s)" 2>/dev/null || true
    echo "{}" > "$SETTINGS_FILE"
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: jq is required but not found, cannot merge $SUBAGENTS_SRC into $SETTINGS_FILE" >&2
    echo "Install jq first (e.g. sudo apt-get install -y jq)" >&2
  else
    if ! jq empty "$SUBAGENTS_SRC" 2>/dev/null; then
      echo "Warning: $SUBAGENTS_SRC is not valid JSON, skipping" >&2
    else
      TMP_MERGED="$(mktemp)"
      jq -s '.[0] * .[1]' "$SETTINGS_FILE" "$SUBAGENTS_SRC" > "$TMP_MERGED" && mv "$TMP_MERGED" "$SETTINGS_FILE"
      echo "Merged $SUBAGENTS_SRC into $SETTINGS_FILE (jq)"
    fi
  fi
fi
rm -f "$TMP_SUBAGENTS" 2>/dev/null || true

echo "==> Done. Installed packages:"
pi list
cat "$HOME/.pi/agent/vision.json" 2>/dev/null || true
cat "$HOME/.pi/agent/settings.json" 2>/dev/null || true