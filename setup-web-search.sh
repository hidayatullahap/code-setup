#!/usr/bin/env bash
set -euo pipefail

# Web search API key configuration
# Can be run standalone or called from setup.sh

# When called from setup.sh, keys are written to TMP_WEB_KEYS (env var)
# Otherwise, writes directly to web-search.json
WEB_SEARCH_FILE="${HOME}/.pi/web-search.json"
OUTPUT_FILE="$WEB_SEARCH_FILE"

if [ -n "${TMP_WEB_KEYS:-}" ]; then
  OUTPUT_FILE="$TMP_WEB_KEYS"
fi

# Define available providers
declare -A PROVIDERS
PROVIDERS["openai"]="OpenAI API Key  | sk-..."
PROVIDERS["brave"]="Brave API Key    | BSA_..."
PROVIDERS["exa"]="Exa API Key      | exa-..."
PROVIDERS["tinyfish"]="TinyFish API Key | sk-tinyfish-..."
PROVIDERS["search1api"]="Search1API Key   | ..."
PROVIDERS["searchinfinity"]="SearchInfinity   | ..."
PROVIDERS["querit"]="Querit API Key   | ..."
PROVIDERS["jina"]="Jina API Key     | jina_..."
PROVIDERS["bocha"]="Bocha API Key    | sk-..."
PROVIDERS["perplexity"]="Perplexity Key   | pplx-..."
PROVIDERS["gemini"]="Gemini API Key   | AIza..."

declare -A KEY_JSON_NAMES
KEY_JSON_NAMES["openai"]="openaiApiKey"
KEY_JSON_NAMES["brave"]="braveApiKey"
KEY_JSON_NAMES["exa"]="exaApiKey"
KEY_JSON_NAMES["tinyfish"]="tinyfishApiKey"
KEY_JSON_NAMES["search1api"]="search1apiApiKey"
KEY_JSON_NAMES["searchinfinity"]="searchinfinityApiKey"
KEY_JSON_NAMES["querit"]="queritApiKey"
KEY_JSON_NAMES["jina"]="jinaApiKey"
KEY_JSON_NAMES["bocha"]="bochaApiKey"
KEY_JSON_NAMES["perplexity"]="perplexityApiKey"
KEY_JSON_NAMES["gemini"]="geminiApiKey"

declare -A HINTS
HINTS["openai"]="sk-..."
HINTS["brave"]="BSA_..."
HINTS["exa"]="exa-..."
HINTS["tinyfish"]="sk-tinyfish-..."
HINTS["search1api"]="..."
HINTS["searchinfinity"]="..."
HINTS["querit"]="..."
HINTS["jina"]="jina_..."
HINTS["bocha"]="sk-..."
HINTS["perplexity"]="pplx-..."
HINTS["gemini"]="AIza..."

# Build ordered key list
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

show_menu() {
  local i=1
  echo "  Select API key(s) to configure (comma-separated, e.g. 1,3,5) or 'a' for all:"
  echo ""
  for key in "${KEYS_ORDERED[@]}"; do
    printf "  [%2d] %s\n" "$i" "${PROVIDERS[$key]}"
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
  read -rp "  Choice: " choice

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
  hint="${HINTS[$key]:-...}"
  read -rp "  ${PROVIDERS[$key]}: " value

  if [ -n "$value" ]; then
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      KEYS_JSON+=", "
    fi
    json_name="${KEY_JSON_NAMES[$key]}"
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
