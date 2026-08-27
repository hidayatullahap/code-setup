#!/usr/bin/env bash
set -euo pipefail

DEFAULT_EMAIL="hidayatullahap@gmail.com"
DEFAULT_NAME="Hidayatullah Agung Prasetyo"

GIT_TERMINAL="/dev/stdin"
if ! tty -s 2>/dev/null && (: < /dev/tty) 2>/dev/null; then
  GIT_TERMINAL="/dev/tty"
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git not found. Install git first (e.g. sudo apt-get install -y git) and re-run." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository. Run this inside a repo (where .git exists)." >&2
  exit 1
fi

if ! { tty -s 2>/dev/null || (: < /dev/tty) 2>/dev/null; }; then
  echo "Skipping git local config (non-interactive environment)." >&2
  echo "Tip: run manually: git config --local user.email \"$DEFAULT_EMAIL\" && git config --local user.name \"$DEFAULT_NAME\"" >&2
  exit 0
fi

echo "==> Configuring git local user (repo-level)..."
printf "Set git config --local user.email/name for this repo? [y/N]: "
read -r GIT_REPLY < "$GIT_TERMINAL" || GIT_REPLY=""

case "$GIT_REPLY" in
  [yY]|[yY][eE][sS])
    printf "Email [%s]: " "$DEFAULT_EMAIL"
    read -r GIT_EMAIL < "$GIT_TERMINAL" || GIT_EMAIL=""
    GIT_EMAIL="${GIT_EMAIL:-$DEFAULT_EMAIL}"
    printf "Name [%s]: " "$DEFAULT_NAME"
    read -r GIT_NAME < "$GIT_TERMINAL" || GIT_NAME=""
    GIT_NAME="${GIT_NAME:-$DEFAULT_NAME}"
    git config --local user.email "$GIT_EMAIL"
    git config --local user.name "$GIT_NAME"
    echo "Set git (local) user.email=$GIT_EMAIL and user.name=$GIT_NAME"
    echo "  in $(git rev-parse --show-toplevel)/.git/config"
    ;;
  *)
    echo "Skipped git local config"
    ;;
esac
