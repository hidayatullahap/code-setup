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

echo "==> Done. Installed packages:"
pi list