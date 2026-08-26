#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/hidayatullahap/code-setup.git"
REPO_BRANCH="main"
AGENTS_MARKER="# code-setup AGENTS.md"

CLONE_DIR=""
TMP_MERGED=""
TMP_WEB_KEYS=""  # Temp file to store web search keys from setup-web-search.sh
TMP_WEB_SCRIPT=""  # Temp copy of setup-web-search.sh when the script runs via curl | bash
cleanup() {
  if [ -n "$CLONE_DIR" ] && [ -d "$CLONE_DIR" ]; then rm -rf "$CLONE_DIR" 2>/dev/null || true; fi
  if [ -n "$TMP_MERGED" ]; then rm -f "$TMP_MERGED" 2>/dev/null || true; fi
  if [ -n "${TMP_WEB_KEYS:-}" ]; then rm -f "$TMP_WEB_KEYS" 2>/dev/null || true; fi
  if [ -n "${TMP_WEB_SCRIPT:-}" ]; then rm -f "$TMP_WEB_SCRIPT" 2>/dev/null || true; fi
}
trap cleanup EXIT

echo "==> Configuring web search API keys..."
echo ""
echo "This step is optional. You can press Enter without selecting any to skip."
echo ""

# Create temp file to pass keys from setup-web-search.sh to this script
TMP_WEB_KEYS=$(mktemp)
export TMP_WEB_KEYS

# BASH_SOURCE is empty when the script is piped into bash (curl ... | bash), so fall back to $0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)" || SCRIPT_DIR="$PWD"
if [ -f "$SCRIPT_DIR/setup-web-search.sh" ]; then
  bash "$SCRIPT_DIR/setup-web-search.sh"
elif command -v curl >/dev/null 2>&1; then
  RAW_URL="$(printf '%s' "$REPO_URL" | sed 's#github\.com#raw.githubusercontent.com#; s#\.git$##')/$REPO_BRANCH/setup-web-search.sh"
  echo "Downloading setup-web-search.sh..."
  TMP_WEB_SCRIPT="$(mktemp)"
  if curl -fsSL "$RAW_URL" -o "$TMP_WEB_SCRIPT"; then
    bash "$TMP_WEB_SCRIPT"
  else
    echo "Warning: could not download setup-web-search.sh, skipping web search setup" >&2
    rm -f "$TMP_WEB_SCRIPT"
    TMP_WEB_SCRIPT=""
  fi
else
  echo "Warning: setup-web-search.sh not found and curl unavailable, skipping web search setup" >&2
fi

# Unset to prevent child processes from seeing it
unset TMP_WEB_KEYS

echo ""
echo "==> Configuring git global user (optional)..."
GIT_TERMINAL="/dev/stdin"
if ! tty -s 2>/dev/null && (: < /dev/tty) 2>/dev/null; then
  GIT_TERMINAL="/dev/tty"
fi
if ! command -v git >/dev/null 2>&1; then
  echo "Warning: git not found, skipping git config" >&2
elif ! { tty -s 2>/dev/null || (: < /dev/tty) 2>/dev/null; }; then
  echo "Skipping git config (non-interactive environment)."
else
  printf "Set git config --global user.email/name? [y/N]: "
  read -r GIT_REPLY < "$GIT_TERMINAL" || GIT_REPLY=""
  case "$GIT_REPLY" in
    [yY]|[yY][eE][sS])
      printf "Email [%s]: " "hidayatullahap@gmail.com"
      read -r GIT_EMAIL < "$GIT_TERMINAL" || GIT_EMAIL=""
      GIT_EMAIL="${GIT_EMAIL:-hidayatullahap@gmail.com}"
      printf "Name [%s]: " "Hidayatullah Agung Prasetyo"
      read -r GIT_NAME < "$GIT_TERMINAL" || GIT_NAME=""
      GIT_NAME="${GIT_NAME:-Hidayatullah Agung Prasetyo}"
      git config --global user.email "$GIT_EMAIL"
      git config --global user.name "$GIT_NAME"
      echo "Set git user.email=$GIT_EMAIL and user.name=$GIT_NAME"
      ;;
    *)
      echo "Skipped git config"
      ;;
  esac
fi

echo ""
echo "==> Cloning code-setup repo..."
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required but not found. Install git first (e.g. sudo apt-get install -y git) and re-run setup." >&2
  exit 1
fi

CLONE_DIR="$(mktemp -d)"
echo "Cloning $REPO_URL (branch: $REPO_BRANCH) into $CLONE_DIR ..."
if ! git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$CLONE_DIR"; then
  echo "Error: failed to clone $REPO_URL (branch: $REPO_BRANCH)" >&2
  exit 1
fi
echo "Cloned into $CLONE_DIR"

echo "==> Installing pi..."
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

echo "==> Installing pi packages..."
pi install npm:pi-web-access
pi install npm:pi-subagents
pi install npm:@juicesharp/rpiv-ask-user-question
pi install npm:@narumitw/pi-btw
pi install npm:@narumitw/pi-plan-mode
pi install npm:vision-handoff
pi install npm:pi-gmi-cloud

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
# Prefer the standalone installer if present in the clone (keeps logic in one place)
if [ -s "$CLONE_DIR/install-extensions.sh" ]; then
  echo "  Using clone's install-extensions.sh..."
  bash "$CLONE_DIR/install-extensions.sh" --from-clone "$CLONE_DIR"
else
  # Fallback: inline install (covers older clones / tests that stub without the script)
  mkdir -p "$HOME/.pi/agent/extensions/chat-only"
  if [ -s "$CLONE_DIR/extensions/chat-only/chat-only.js" ]; then
    cp "$CLONE_DIR/extensions/chat-only/chat-only.js" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
    echo "Installed chat-only extension to \$HOME/.pi/agent/extensions/chat-only/chat-only.js (from clone)"
  else
    echo "Warning: extensions/chat-only/chat-only.js not found in clone ($CLONE_DIR), skipping" >&2
  fi

  echo "==> Installing generate-design extension..."
  GD_DEST="$HOME/.pi/agent/extensions/generate-design"
  if [ -d "$CLONE_DIR/extensions/generate-design" ]; then
    mkdir -p "$GD_DEST"
    # cp -a preserves skills/ subdir; fall back to cp -r with glob for minimal shells
    if cp -a "$CLONE_DIR/extensions/generate-design/." "$GD_DEST/" 2>/dev/null; then
      :
    else
      cp -r "$CLONE_DIR/extensions/generate-design/." "$GD_DEST/" 2>/dev/null || cp -r "$CLONE_DIR/extensions/generate-design/"* "$GD_DEST/" 2>/dev/null || true
    fi
    if [ -d "$GD_DEST/skills" ]; then
      echo "Installed generate-design extension to $GD_DEST/ ($(find "$GD_DEST/skills" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ') skill(s), from clone)"
    else
      echo "Installed generate-design extension to $GD_DEST/ (from clone)" >&2
      echo "Warning: $GD_DEST/skills not found after copy — extension will use built-in fallbacks" >&2
    fi
  else
    echo "Warning: extensions/generate-design not found in clone ($CLONE_DIR), skipping" >&2
  fi
fi

echo "==> Appending AGENTS.md..."
if [ -s "$CLONE_DIR/AGENTS.md" ]; then
  if ! grep -qF "$AGENTS_MARKER" "$HOME/.pi/agent/AGENTS.md" 2>/dev/null; then
    {
      echo ""
      echo "$AGENTS_MARKER"
      cat "$CLONE_DIR/AGENTS.md"
    } >> "$HOME/.pi/agent/AGENTS.md"
    echo "Appended AGENTS.md to \$HOME/.pi/agent/AGENTS.md"
  else
    echo "AGENTS.md already appended, skipping"
  fi
else
  echo "Warning: AGENTS.md not found in clone ($CLONE_DIR), skipping" >&2
fi

echo "==> Configuring subagents in settings.json..."
SETTINGS_FILE="$HOME/.pi/agent/settings.json"
SUBAGENTS_SRC="$CLONE_DIR/subagents.json"

if [ ! -s "$SUBAGENTS_SRC" ]; then
  echo "Warning: subagents.json not found in clone ($CLONE_DIR), skipping" >&2
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

echo "==> Writing web search keys to config..."
if [ -n "${TMP_WEB_KEYS:-}" ] && [ -s "$TMP_WEB_KEYS" ]; then
  WEB_SEARCH_FILE="$HOME/.pi/web-search.json"
  mkdir -p "$(dirname "$WEB_SEARCH_FILE")"
  mv "$TMP_WEB_KEYS" "$WEB_SEARCH_FILE"
  echo "  Saved to $WEB_SEARCH_FILE"
else
  rm -f "${TMP_WEB_KEYS:-}" 2>/dev/null || true
  echo "  No keys configured, skipping web-search.json"
fi

echo "==> Done. Installed packages:"
pi list
cat "$HOME/.pi/agent/vision.json" 2>/dev/null || true
cat "$HOME/.pi/agent/settings.json" 2>/dev/null || true
cat "$HOME/.pi/web-search.json" 2>/dev/null || true
