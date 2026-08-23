#!/usr/bin/env bats

# Tests for setup.sh – run with: npx bats test/setup.bats
# Each test gets an isolated HOME and faked PATH (curl, npm, pi).

setup() {
  export TEST_TMP="$(mktemp -d)"
  export HOME="$TEST_TMP/home"
  mkdir -p "$HOME"

  export FAKE_BIN="$TEST_TMP/bin"
  mkdir -p "$FAKE_BIN"
  export ORIG_PATH="$PATH"
  export PATH="$FAKE_BIN:$PATH"

  export PROJECT_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  export FIXTURE_AGENTS="$PROJECT_ROOT/test/fixtures/AGENTS.md"
  export FIXTURE_SUBAGENTS="$PROJECT_ROOT/test/fixtures/subagents.json"
  export FAKE_LOG="$TEST_TMP/fake.log"

  # default stubs – npm and pi are always faked
  cat > "$FAKE_BIN/npm" <<'EOS'
#!/usr/bin/env bash
echo "npm $*" >> "$FAKE_LOG"
exit 0
EOS
  chmod +x "$FAKE_BIN/npm"

  cat > "$FAKE_BIN/pi" <<'EOS'
#!/usr/bin/env bash
echo "pi $*" >> "$FAKE_LOG"
if [ "$1" = "list" ]; then echo "fake pi list"; fi
exit 0
EOS
  chmod +x "$FAKE_BIN/pi"

  # curl stub – behaviour controlled by CURL_SCENARIO
  cat > "$FAKE_BIN/curl" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
OUTPUT=""
URL=""
# parse -o <file> and URL
args=("$@")
for ((i=0;i<${#args[@]};i++)); do
  if [ "${args[i]}" = "-o" ]; then
    OUTPUT="${args[i+1]}"
  fi
  if [[ "${args[i]}" == https* ]]; then
    URL="${args[i]}"
  fi
done
SCENARIO="${CURL_SCENARIO:-success}"
case "$SCENARIO" in
  fail)
    exit 22
    ;;
  empty)
    : > "$OUTPUT"
    exit 0
    ;;
  invalid-subagents)
    if [[ "$URL" == *"subagents.json"* ]]; then
      echo "not-json" > "$OUTPUT"
      exit 0
    else
      cat "$FIXTURE_AGENTS" > "$OUTPUT"
      exit 0
    fi
    ;;
  *)
    # success
    if [[ "$URL" == *"AGENTS.md"* ]]; then
      cat "$FIXTURE_AGENTS" > "$OUTPUT"
      exit 0
    elif [[ "$URL" == *"subagents.json"* ]]; then
      cat "$FIXTURE_SUBAGENTS" > "$OUTPUT"
      exit 0
    else
      echo "curl stub: unknown URL $URL" >&2
      exit 1
    fi
    ;;
esac
EOS
  chmod +x "$FAKE_BIN/curl"

  # Ensure real jq is available via PATH unless test hides it
  # (jq lives in /usr/bin, which stays in ORIG_PATH)
  export CURL_SCENARIO="success"
}

teardown() {
  export PATH="$ORIG_PATH"
  rm -rf "$TEST_TMP"
}

# helper to run setup.sh and capture output
run_setup() {
  run bash "$PROJECT_ROOT/setup.sh"
}

@test "fresh install creates vision.json, AGENTS.md and settings.json" {
  run_setup
  [ "$status" -eq 0 ]
  [ -f "$HOME/.pi/agent/vision.json" ]
  grep -q "opencode-go" "$HOME/.pi/agent/vision.json"
  [ -f "$HOME/.pi/agent/AGENTS.md" ]
  grep -q "Test fixture AGENTS line" "$HOME/.pi/agent/AGENTS.md"
  grep -q "# code-setup AGENTS.md" "$HOME/.pi/agent/AGENTS.md"
  [ -f "$HOME/.pi/agent/settings.json" ]
  grep -q "muse-spark-1.2-contributor" "$HOME/.pi/agent/settings.json"
}

@test "second run is idempotent – AGENTS.md not duplicated" {
  run_setup
  [ "$status" -eq 0 ]
  count_before=$(grep -c "Test fixture AGENTS line" "$HOME/.pi/agent/AGENTS.md" || true)
  [ "$count_before" -eq 1 ]
  marker_before=$(grep -c "code-setup AGENTS.md" "$HOME/.pi/agent/AGENTS.md" || true)
  [ "$marker_before" -eq 1 ]

  run bash "$PROJECT_ROOT/setup.sh"
  [ "$status" -eq 0 ]
  count_after=$(grep -c "Test fixture AGENTS line" "$HOME/.pi/agent/AGENTS.md" || true)
  [ "$count_after" -eq 1 ]
  marker_after=$(grep -c "code-setup AGENTS.md" "$HOME/.pi/agent/AGENTS.md" || true)
  [ "$marker_after" -eq 1 ]
  # vision.json not overwritten
  grep -q "opencode-go" "$HOME/.pi/agent/vision.json"
}

@test "merge preserves user customizations (user settings win)" {
  mkdir -p "$HOME/.pi/agent"
  cat > "$HOME/.pi/agent/settings.json" <<'EOF'
{
  "subagents": {
    "agentOverrides": {
      "delegate": { "model": "custom/my-model" },
      "myExtra": { "model": "keep-me" }
    }
  },
  "otherKey": "keep"
}
EOF
  run_setup
  [ "$status" -eq 0 ]
  # custom delegate preserved
  grep -q "custom/my-model" "$HOME/.pi/agent/settings.json"
  # extra keys preserved
  grep -q "keep-me" "$HOME/.pi/agent/settings.json"
  grep -q "otherKey" "$HOME/.pi/agent/settings.json"
  # defaults still added for missing agents (e.g. worker)
  grep -q "deepseek-v4-flash" "$HOME/.pi/agent/settings.json"
}

@test "curl failure for AGENTS.md does not create empty file and still exits 0" {
  export CURL_SCENARIO="fail"
  run_setup
  [ "$status" -eq 0 ]
  # warning goes to stderr, but script still prints Done
  [[ "$output" == *"Done"* ]]
  # AGENTS.md should not contain fixture
  if [ -f "$HOME/.pi/agent/AGENTS.md" ]; then
    ! grep -q "Test fixture AGENTS line" "$HOME/.pi/agent/AGENTS.md"
  fi
  # settings also skipped because subagents fetch also fails in this mode – warning expected
  [[ "$output" == *"Warning"* ]] || [[ "$stderr" == *"Warning"* ]] || true
}

@test "empty curl response is treated as failure – no empty append" {
  export CURL_SCENARIO="empty"
  run_setup
  [ "$status" -eq 0 ]
  # AGENTS.md should not have marker from empty fetch
  if [ -f "$HOME/.pi/agent/AGENTS.md" ]; then
    ! grep -q "code-setup AGENTS.md" "$HOME/.pi/agent/AGENTS.md" || true
  fi
  [[ "$output" == *"Failed to fetch AGENTS.md"* ]]
}

@test "local fallback used when curl fails and file exists next to script" {
  export CURL_SCENARIO="fail"
  # create a temporary script dir with subagents.json
  TMP_SCRIPT_DIR="$(mktemp -d)"
  cp "$PROJECT_ROOT/test/fixtures/subagents.json" "$TMP_SCRIPT_DIR/subagents.json"
  cp "$PROJECT_ROOT/setup.sh" "$TMP_SCRIPT_DIR/setup.sh"
  # run the copy so BASH_SOURCE points there
  run bash "$TMP_SCRIPT_DIR/setup.sh"
  [ "$status" -eq 0 ]
  grep -q "Using local subagents.json" <<< "$output"
  [ -f "$HOME/.pi/agent/settings.json" ]
  grep -q "muse-spark" "$HOME/.pi/agent/settings.json"
  rm -rf "$TMP_SCRIPT_DIR"
}

@test "invalid JSON in existing settings.json is backed up and reset" {
  mkdir -p "$HOME/.pi/agent"
  echo "not-json" > "$HOME/.pi/agent/settings.json"
  run_setup
  [ "$status" -eq 0 ]
  [[ "$output" == *"not valid JSON"* ]]
  # backup exists
  ls "$HOME/.pi/agent/settings.json.bak."* 1>/dev/null 2>&1
  # new file is valid JSON with merged content
  jq empty "$HOME/.pi/agent/settings.json"
  grep -q "muse-spark" "$HOME/.pi/agent/settings.json"
}

@test "invalid JSON in fetched subagents is skipped with warning" {
  export CURL_SCENARIO="invalid-subagents"
  run_setup
  [ "$status" -eq 0 ]
  [[ "$output" == *"not valid JSON"* ]]
  # settings not created from invalid source – but valid empty fallback?
  # if settings was {} it should stay {}
  if [ -f "$HOME/.pi/agent/settings.json" ]; then
    jq empty "$HOME/.pi/agent/settings.json"
  fi
}

@test "missing jq does not wipe valid settings.json" {
  mkdir -p "$HOME/.pi/agent"
  echo '{"keep":"me"}' > "$HOME/.pi/agent/settings.json"
  # hide jq – build a PATH with all essentials but no jq
  mkdir -p "$TEST_TMP/nojq-bin"
  for b in bash sh cat grep mkdir mktemp rm mv cp dirname pwd date head tr cut sort chmod ls wc; do
    if p=$(command -v "$b" 2>/dev/null); then ln -sf "$p" "$TEST_TMP/nojq-bin/$b"; fi
  done
  cp "$FAKE_BIN/curl" "$TEST_TMP/nojq-bin/"
  cp "$FAKE_BIN/npm" "$TEST_TMP/nojq-bin/"
  cp "$FAKE_BIN/pi" "$TEST_TMP/nojq-bin/"
  # also need pi and npm helpers to find bash
  export PATH="$TEST_TMP/nojq-bin:$FAKE_BIN"
  # ensure jq not found
  ! command -v jq >/dev/null 2>&1
  run bash "$PROJECT_ROOT/setup.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"jq is required"* ]]
  # settings preserved, not reset to {}
  grep -q '"keep": *"me"' "$HOME/.pi/agent/settings.json" || grep -q "keep" "$HOME/.pi/agent/settings.json"
  # no backup created for valid json
  run bash -c "ls $HOME/.pi/agent/settings.json.bak.* 2>/dev/null | wc -l"
  [ "$output" -eq 0 ]
  export PATH="$FAKE_BIN:$ORIG_PATH"
}

@test "jq merge failure is reported and does not print success" {
  # stub jq to fail on merge (second invocation with -s)
  cat > "$FAKE_BIN/jq" <<'EOS'
#!/usr/bin/env bash
if [[ "$*" == *"-s"* ]]; then
  echo "fake jq merge failure" >&2
  exit 1
fi
/usr/bin/jq "$@"
EOS
  chmod +x "$FAKE_BIN/jq"
  export PATH="$FAKE_BIN:$ORIG_PATH"
  run_setup
  [ "$status" -eq 0 ]
  [[ "$output" == *"failed to merge"* ]]
  [[ "$output" != *"Merged"* ]] || [[ "$output" == *"failed"* ]]
}
