#!/bin/sh
set -eu

REPO_URL="https://github.com/hidayatullahap/code-setup.git"
REPO_BRANCH="main"

for command_name in git node; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: $command_name is required but not found. Install it first and re-run setup." >&2
    exit 1
  fi
done

CLONE_DIR="$(mktemp -d)"
trap 'rm -rf "$CLONE_DIR"' EXIT

echo "==> Cloning $REPO_URL (branch: $REPO_BRANCH)..."
if ! git clone --quiet --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$CLONE_DIR"; then
  echo "Error: failed to clone $REPO_URL (branch: $REPO_BRANCH)" >&2
  exit 1
fi

SETUP_SCRIPT="$CLONE_DIR/setup/setup.mjs"
if [ -t 0 ] || ! (: </dev/tty) 2>/dev/null; then
  node "$SETUP_SCRIPT" "$@"
else
  node "$SETUP_SCRIPT" "$@" </dev/tty
fi
