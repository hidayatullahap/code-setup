#!/usr/bin/env bash
set -euo pipefail

# Web search API key configuration
# Can be run standalone or called from setup.sh

# Guard: skip interactive prompts when no terminal is reachable.
# In CI there is neither a TTY on stdin nor an openable /dev/tty; when piped
# (curl ... | bash) stdin is the download pipe but /dev/tty still works.
READ_FROM="/dev/stdin"
if tty -s 2>/dev/null; then
  :
elif (: < /dev/tty) 2>/dev/null; then
  READ_FROM="/dev/tty"
else
  echo "  Skipping web search setup (non-interactive environment)."
  exit 0
fi

# When called from setup.sh, keys are written to TMP_WEB_KEYS (env var)
# Otherwise, writes directly to web-search.json
WEB_SEARCH_FILE="${HOME}/.pi/web-search.json"
OUTPUT_FILE="$WEB_SEARCH_FILE"

if [ -n "${TMP_WEB_KEYS:-}" ]; then
  OUTPUT_FILE="$TMP_WEB_KEYS"
fi

KEYS_ORDERED=(
  "openai"
  "brave"
  "exa"
  "tinyfish"
  "search1api"
  "searchinfinity"
  "querit"
  "jina"
  "bocha"
  "perplexity"
  "gemini"
)

provider_label() {
  case "$1" in
    openai) echo "OpenAI API Key  | sk-..." ;;
    brave) echo "Brave API Key    | BSA_..." ;;
    exa) echo "Exa API Key      | exa-..." ;;
    tinyfish) echo "TinyFish API Key | sk-tinyfish-..." ;;
    search1api) echo "Search1API Key   | ..." ;;
    searchinfinity) echo "SearchInfinity   | ..." ;;
    querit) echo "Querit API Key   | ..." ;;
    jina) echo "Jina API Key     | jina_..." ;;
    bocha) echo "Bocha API Key    | sk-..." ;;
    perplexity) echo "Perplexity Key   | pplx-..." ;;
    gemini) echo "Gemini API Key   | AIza..." ;;
    *) echo "$1" ;;
  esac
}

provider_json_key() {
  case "$1" in
    openai) echo "openaiApiKey" ;;
    brave) echo "braveApiKey" ;;
    exa) echo "exaApiKey" ;;
    tinyfish) echo "tinyfishApiKey" ;;
    search1api) echo "search1apiApiKey" ;;
    searchinfinity) echo "searchinfinityApiKey" ;;
    querit) echo "queritApiKey" ;;
    jina) echo "jinaApiKey" ;;
    bocha) echo "bochaApiKey" ;;
    perplexity) echo "perplexityApiKey" ;;
    gemini) echo "geminiApiKey" ;;
    *) echo "${1}ApiKey" ;;
  esac
}

show_menu() {
  local i=1
  echo "  Select API key(s) to configure (comma-separated, e.g. 1,3,5) or 'a' for all:"
  echo ""
  for key in "${KEYS_ORDERED[@]}"; do
    printf "  [%2d] %s\n" "$i" "$(provider_label "$key")"
    i=$((i+1))
  done
  echo ""
  echo "  [0]  Done / Skip"
  echo ""
}

echo "==> Configuring web search API keys (optional)..."
echo ""

SELECTED_KEYS=""

while true; do
  show_menu
  read -rp "  Choice: " choice < "$READ_FROM"

  # Handle "a" for all
  if [ "$choice" = "a" ] || [ "$choice" = "A" ]; then
    SELECTED_KEYS="${KEYS_ORDERED[*]}"
    break
  fi

  # Parse comma-separated numbers
  if [ -z "$choice" ]; then
    echo "  No selection made."
    break
  fi

  SELECTED_KEYS=""
  IFS=',' read -ra NUMBERS <<< "$choice"
  for num in "${NUMBERS[@]}"; do
    num=$(echo "$num" | tr -d ' ')
    if [ "$num" = "0" ]; then
      echo "  Skipping."
      SELECTED_KEYS=""
      break 2
    fi
    idx=$((num - 1))
    if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#KEYS_ORDERED[@]}" ]; then
      SELECTED_KEYS+=" ${KEYS_ORDERED[$idx]}"
    else
      echo "  Invalid number: $num (ignored)"
    fi
  done

  if [ -n "$SELECTED_KEYS" ]; then
    break
  fi
done

# Prompt for each selected provider
KEYS_JSON="{"
FIRST=true

for key in $SELECTED_KEYS; do
  _label="$(provider_label "$key")"
  read -rp "  $_label: " value < "$READ_FROM"

  if [ -n "$value" ]; then
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      KEYS_JSON+=", "
    fi
    json_name="$(provider_json_key "$key")"
    KEYS_JSON+="\"$json_name\": \"$value\""
  fi
done

KEYS_JSON+="}"

if [ "$KEYS_JSON" = "{}" ] || [ -z "$SELECTED_KEYS" ]; then
  echo "  No keys provided."
else
  echo "$KEYS_JSON" > "$OUTPUT_FILE"
  if [ -n "${TMP_WEB_KEYS:-}" ]; then
    echo "  Keys saved (will be written after installation)."
  else
    mkdir -p "$(dirname "$WEB_SEARCH_FILE")"
    echo "  Saved to $WEB_SEARCH_FILE"
  fi
fi
