#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing pi..."
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

echo "==> Installing pi packages..."
pi install git:github.com/DietrichGebert/ponytail
pi install npm:pi-interactive-shell
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
AGENTS_URL="https://raw.githubusercontent.com/hidayatullahap/code-setup/refs/heads/main/AGENTS.md"
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

echo "==> Done. Installed packages:"
pi list
cat "$HOME/.pi/agent/vision.json" 2>/dev/null || true