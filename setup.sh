#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="https://raw.githubusercontent.com/hidayatullahap/code-setup/main"
AGENTS_MARKER="# code-setup AGENTS.md"

TMP_AGENTS=""
TMP_SUBAGENTS=""
TMP_MERGED=""
TMP_EXT=""
cleanup() {
  if [ -n "$TMP_AGENTS" ]; then rm -f "$TMP_AGENTS" 2>/dev/null || true; fi
  if [ -n "$TMP_SUBAGENTS" ]; then rm -f "$TMP_SUBAGENTS" 2>/dev/null || true; fi
  if [ -n "$TMP_MERGED" ]; then rm -f "$TMP_MERGED" 2>/dev/null || true; fi
  if [ -n "$TMP_EXT" ]; then rm -f "$TMP_EXT" 2>/dev/null || true; fi
}
trap cleanup EXIT

echo "==> Installing pi..."
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

echo "==> Installing pi packages..."
pi install npm:pi-web-access
pi install npm:pi-subagents
pi install npm:@juicesharp/rpiv-ask-user-question
pi install npm:@narumitw/pi-btw
pi install npm:@narumitw/pi-plan-mode
pi install npm:vision-handoff

# single setup for all agent files – simpler than repeating mkdir -p
mkdir -p "$HOME/.pi/agent"

echo "==> Configuring vision handoff..."
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

echo "==> Installing extensions..."
mkdir -p "$HOME/.pi/agent/extensions"
EXT_URL="$REPO_ROOT/extensions/chat-only.ts"
TMP_EXT="$(mktemp)"
EXT_SRC=""

if curl -fsSL "$EXT_URL" -o "$TMP_EXT" 2>/dev/null && [ -s "$TMP_EXT" ]; then
  EXT_SRC="$TMP_EXT"
  echo "Fetched chat-only.ts from $EXT_URL"
else
  # Local fallback for git-clone installs
  _src="${BASH_SOURCE[0]:-}"
  if [ -n "$_src" ] && [ "$_src" != "bash" ] && [ "$_src" != "-" ]; then
    if ! SCRIPT_DIR_EXT="$(cd "$(dirname "$_src")" 2>/dev/null && pwd)"; then
      SCRIPT_DIR_EXT="$(pwd)"
    fi
  else
    SCRIPT_DIR_EXT="$(pwd)"
  fi
  if [ -f "$SCRIPT_DIR_EXT/extensions/chat-only.ts" ]; then
    EXT_SRC="$SCRIPT_DIR_EXT/extensions/chat-only.ts"
    echo "Using local extensions/chat-only.ts at $EXT_SRC"
    # Copy content to TMP_EXT so later logic is uniform, but keep EXT_SRC for direct cp
    # Clean up the empty TMP_EXT we created for the curl attempt
    rm -f "$TMP_EXT" 2>/dev/null || true
    TMP_EXT=""
  else
    rm -f "$TMP_EXT" 2>/dev/null || true
    TMP_EXT=""
  fi
fi

if [ -z "$EXT_SRC" ] || [ ! -f "$EXT_SRC" ]; then
  echo "Warning: extensions/chat-only.ts not found (tried $EXT_URL and local file), skipping" >&2
else
  cp "$EXT_SRC" "$HOME/.pi/agent/extensions/chat-only.ts"
  echo "Installed chat-only extension to \$HOME/.pi/agent/extensions/chat-only.ts"
  # Clean up TMP_EXT if it was the source
  if [ -n "$TMP_EXT" ] && [ "$EXT_SRC" = "$TMP_EXT" ]; then
    rm -f "$TMP_EXT" 2>/dev/null || true
    TMP_EXT=""
  fi
fi

echo "==> Appending AGENTS.md..."
AGENTS_URL="$REPO_ROOT/AGENTS.md"
TMP_AGENTS="$(mktemp)"
if curl -fsSL "$AGENTS_URL" -o "$TMP_AGENTS" 2>/dev/null && [ -s "$TMP_AGENTS" ]; then
  if ! grep -qF "$AGENTS_MARKER" "$HOME/.pi/agent/AGENTS.md" 2>/dev/null; then
    {
      echo ""
      echo "$AGENTS_MARKER"
      cat "$TMP_AGENTS"
    } >> "$HOME/.pi/agent/AGENTS.md"
    echo "Appended AGENTS.md to \$HOME/.pi/agent/AGENTS.md"
  else
    echo "AGENTS.md already appended, skipping"
  fi
else
  echo "Failed to fetch AGENTS.md from $AGENTS_URL" >&2
fi

echo "==> Configuring subagents in settings.json..."
SETTINGS_FILE="$HOME/.pi/agent/settings.json"
SUBAGENTS_URL="$REPO_ROOT/subagents.json"
TMP_SUBAGENTS="$(mktemp)"
SUBAGENTS_SRC=""

if curl -fsSL "$SUBAGENTS_URL" -o "$TMP_SUBAGENTS" 2>/dev/null && [ -s "$TMP_SUBAGENTS" ]; then
  SUBAGENTS_SRC="$TMP_SUBAGENTS"
  echo "Fetched subagents.json from $SUBAGENTS_URL"
else
  # Local fallback for git-clone installs – one candidate is enough
  _src="${BASH_SOURCE[0]:-}"
  if [ -n "$_src" ] && [ "$_src" != "bash" ] && [ "$_src" != "-" ]; then
    if ! SCRIPT_DIR="$(cd "$(dirname "$_src")" 2>/dev/null && pwd)"; then
      SCRIPT_DIR="$(pwd)"
    fi
  else
    SCRIPT_DIR="$(pwd)"
  fi
  if [ -f "$SCRIPT_DIR/subagents.json" ]; then
    SUBAGENTS_SRC="$SCRIPT_DIR/subagents.json"
    echo "Using local subagents.json at $SUBAGENTS_SRC"
  fi
fi

if [ -z "$SUBAGENTS_SRC" ] || [ ! -f "$SUBAGENTS_SRC" ]; then
  echo "Warning: subagents.json not found (tried $SUBAGENTS_URL and local file), skipping" >&2
else
  if [ ! -f "$SETTINGS_FILE" ] || [ ! -s "$SETTINGS_FILE" ]; then
    echo "{}" > "$SETTINGS_FILE"
  fi

  if ! command -v jq >/dev/null 2>&1; then
    echo "Warning: jq is required but not found, cannot merge $SUBAGENTS_SRC into $SETTINGS_FILE" >&2
    echo "Install jq first (e.g. sudo apt-get install -y jq)" >&2
  else
    if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
      echo "Warning: $SETTINGS_FILE is not valid JSON, backing up and resetting" >&2
      cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak.$(date +%s)" 2>/dev/null || true
      echo "{}" > "$SETTINGS_FILE"
    fi

    if ! jq empty "$SUBAGENTS_SRC" 2>/dev/null; then
      echo "Warning: $SUBAGENTS_SRC is not valid JSON, skipping" >&2
    else
      TMP_MERGED="$(mktemp)"
      # User settings win on conflict – reruns do not clobber custom models
      if jq -s '.[0] * .[1]' "$SUBAGENTS_SRC" "$SETTINGS_FILE" > "$TMP_MERGED"; then
        mv "$TMP_MERGED" "$SETTINGS_FILE"
        TMP_MERGED=""
        echo "Merged $SUBAGENTS_SRC into $SETTINGS_FILE (jq – user settings preserved)"
      else
        echo "Warning: failed to merge $SUBAGENTS_SRC into $SETTINGS_FILE" >&2
        rm -f "$TMP_MERGED" 2>/dev/null || true
        TMP_MERGED=""
      fi
    fi
  fi
fi

echo "==> Done. Installed packages:"
pi list
cat "$HOME/.pi/agent/vision.json" 2>/dev/null || true
cat "$HOME/.pi/agent/settings.json" 2>/dev/null || true
