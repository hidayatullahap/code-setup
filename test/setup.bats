#!/usr/bin/env bats

# Tests for setup.sh – run with: npx bats test/setup.bats
# Each test gets an isolated HOME and faked PATH (git, npm, pi).
# setup.sh now clones to a temp dir (git clone --depth 1) and copies
# from that clone. The git stub populates a fake clone dir from fixtures.

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
  export FIXTURE_EXT="$PROJECT_ROOT/test/fixtures/chat-only/chat-only.js"
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

  # git stub – simulates `git clone --depth 1 --branch main <url> <dest>`
  cat > "$FAKE_BIN/git" <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
echo "git $*" >> "$FAKE_LOG"
if [ "${1:-}" != "clone" ]; then
  echo "git stub: only clone supported, got $*" >&2
  exit 1
fi
# DEST is last argument
DEST="${@: -1}"
# Support both GIT_SCENARIO and legacy CURL_SCENARIO for backwards compat
SCENARIO="${GIT_SCENARIO:-}"
if [ -z "$SCENARIO" ] && [ -n "${CURL_SCENARIO:-}" ]; then
  case "${CURL_SCENARIO}" in
    fail) SCENARIO="fail" ;;
    empty) SCENARIO="empty" ;;
    empty-ext) SCENARIO="empty-ext" ;;
    invalid-subagents) SCENARIO="invalid-subagents" ;;
    *) SCENARIO="success" ;;
  esac
fi
SCENARIO="${SCENARIO:-success}"
case "$SCENARIO" in
  fail)
    exit 22
    ;;
  empty)
    mkdir -p "$DEST"
    mkdir -p "$DEST/extensions/generate-design"
    : > "$DEST/AGENTS.md"
    : > "$DEST/subagents.json"
    mkdir -p "$DEST/extensions/chat-only"
    : > "$DEST/extensions/chat-only/chat-only.js"
    : > "$DEST/extensions/generate-design/index.ts"
    exit 0
    ;;
  empty-ext)
    mkdir -p "$DEST"
    mkdir -p "$DEST/extensions/generate-design/skills"
    cat "$FIXTURE_AGENTS" > "$DEST/AGENTS.md"
    cat "$FIXTURE_SUBAGENTS" > "$DEST/subagents.json"
    mkdir -p "$DEST/extensions/chat-only"
    : > "$DEST/extensions/chat-only/chat-only.js"
    # populate generate-design so copy -r succeeds
    if [ -d "$PROJECT_ROOT/extensions/generate-design" ]; then
      cp -r "$PROJECT_ROOT/extensions/generate-design/." "$DEST/extensions/generate-design/" 2>/dev/null || true
      : > "$DEST/extensions/chat-only/chat-only.js"
    else
      echo "stub" > "$DEST/extensions/generate-design/index.ts"
    fi
    exit 0
    ;;
  invalid-subagents)
    mkdir -p "$DEST"
    mkdir -p "$DEST/extensions/generate-design"
    cat "$FIXTURE_AGENTS" > "$DEST/AGENTS.md"
    echo "not-json" > "$DEST/subagents.json"
    mkdir -p "$DEST/extensions/chat-only"
    cat "$FIXTURE_EXT" > "$DEST/extensions/chat-only/chat-only.js"
    if [ -d "$PROJECT_ROOT/extensions/generate-design" ]; then
      cp -r "$PROJECT_ROOT/extensions/generate-design/." "$DEST/extensions/generate-design/" 2>/dev/null || true
    fi
    exit 0
    ;;
  missing-agents)
    mkdir -p "$DEST"
    mkdir -p "$DEST/extensions/generate-design"
    # no AGENTS.md
    cat "$FIXTURE_SUBAGENTS" > "$DEST/subagents.json"
    mkdir -p "$DEST/extensions/chat-only"
    cat "$FIXTURE_EXT" > "$DEST/extensions/chat-only/chat-only.js"
    if [ -d "$PROJECT_ROOT/extensions/generate-design" ]; then
      cp -r "$PROJECT_ROOT/extensions/generate-design/." "$DEST/extensions/generate-design/" 2>/dev/null || true
    fi
    exit 0
    ;;
  missing-extension)
    mkdir -p "$DEST"
    mkdir -p "$DEST/extensions/generate-design"
    cat "$FIXTURE_AGENTS" > "$DEST/AGENTS.md"
    cat "$FIXTURE_SUBAGENTS" > "$DEST/subagents.json"
    mkdir -p "$DEST/extensions/chat-only"
    # intentionally no chat-only.js
    rm -f "$DEST/extensions/chat-only/chat-only.js"
    if [ -d "$PROJECT_ROOT/extensions/generate-design" ]; then
      cp -r "$PROJECT_ROOT/extensions/generate-design/." "$DEST/extensions/generate-design/" 2>/dev/null || true
    fi
    exit 0
    ;;
  *)
    # success – populate clone from fixtures + real generate-design
    mkdir -p "$DEST"
    cat "$FIXTURE_AGENTS" > "$DEST/AGENTS.md"
    cat "$FIXTURE_SUBAGENTS" > "$DEST/subagents.json"
    mkdir -p "$DEST/extensions/chat-only"
    cat "$FIXTURE_EXT" > "$DEST/extensions/chat-only/chat-only.js"
    mkdir -p "$DEST/extensions/generate-design/skills"
    if [ -d "$PROJECT_ROOT/extensions/generate-design" ]; then
      cp -r "$PROJECT_ROOT/extensions/generate-design/." "$DEST/extensions/generate-design/" 2>/dev/null || true
    fi
    # ensure at least one file exists for copy -r
    if [ ! -f "$DEST/extensions/generate-design/index.ts" ]; then
      echo "// stub generate-design" > "$DEST/extensions/generate-design/index.ts"
    fi
    exit 0
    ;;
esac
EOS
  chmod +x "$FAKE_BIN/git"

  export GIT_SCENARIO="success"
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

@test "fresh install creates chat-only extension" {
  run_setup
  [ "$status" -eq 0 ]
  [ -f "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ]
  grep -q "Test fixture chat-only line" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  grep -q "chat-only-state" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  [[ "$output" == *"chat-only"* ]] || [[ "$output" == *"extensions"* ]]
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
  # extension still present after second run
  [ -f "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ]
  grep -q "Test fixture chat-only line" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
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

@test "git clone failure exits non-zero and reports error" {
  export GIT_SCENARIO="fail"
  run_setup
  [ "$status" -ne 0 ]
  [[ "$output" == *"failed to clone"* ]] || [[ "$output" == *"Error"* ]]
  # no AGENTS.md created from failed clone
  if [ -f "$HOME/.pi/agent/AGENTS.md" ]; then
    ! grep -q "Test fixture AGENTS line" "$HOME/.pi/agent/AGENTS.md"
  fi
}

@test "empty clone files are warned and not appended" {
  export GIT_SCENARIO="empty"
  run_setup
  [ "$status" -eq 0 ]
  # AGENTS.md should not have marker from empty file ( -s check )
  if [ -f "$HOME/.pi/agent/AGENTS.md" ]; then
    ! grep -q "code-setup AGENTS.md" "$HOME/.pi/agent/AGENTS.md" || true
  fi
  [[ "$output" == *"Warning"* ]]
  [[ "$output" == *"AGENTS.md not found"* ]] || [[ "$output" == *"not found in clone"* ]]
}

@test "clone succeeds regardless of cwd (no SCRIPT_DIR fallback needed)" {
  TMP_RUN_DIR="$(mktemp -d)"
  cp "$PROJECT_ROOT/setup.sh" "$TMP_RUN_DIR/setup.sh"
  run bash "$TMP_RUN_DIR/setup.sh"
  [ "$status" -eq 0 ]
  [ -f "$HOME/.pi/agent/settings.json" ]
  grep -q "muse-spark" "$HOME/.pi/agent/settings.json"
  [ -f "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ]
  grep -q "Test fixture chat-only line" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  rm -rf "$TMP_RUN_DIR"
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

@test "invalid JSON in cloned subagents is skipped with warning" {
  export GIT_SCENARIO="invalid-subagents"
  run_setup
  [ "$status" -eq 0 ]
  [[ "$output" == *"not valid JSON"* ]]
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
  cp "$FAKE_BIN/git" "$TEST_TMP/nojq-bin/"
  cp "$FAKE_BIN/npm" "$TEST_TMP/nojq-bin/"
  cp "$FAKE_BIN/pi" "$TEST_TMP/nojq-bin/"
  export PATH="$TEST_TMP/nojq-bin:$FAKE_BIN"
  # ensure jq not found
  ! command -v jq >/dev/null 2>&1 || { echo "jq still found at $(command -v jq)"; false; }
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

@test "extension installed via clone when chat-only present" {
  export GIT_SCENARIO="success"
  run_setup
  [ "$status" -eq 0 ]
  [ -f "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ]
  grep -q "Test fixture chat-only line" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  [[ "$output" == *"from clone"* ]]
}

@test "extension missing in clone still exits 0 and warns" {
  export GIT_SCENARIO="missing-extension"
  run_setup
  [ "$status" -eq 0 ]
  [[ "$output" == *"Warning"* ]]
  [[ "$output" == *"extensions/chat-only/chat-only.js not found"* ]]
  # extension not created
  [ ! -s "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ] || true
}

@test "empty extension in clone is warned and not installed" {
  export GIT_SCENARIO="empty-ext"
  run_setup
  [ "$status" -eq 0 ]
  [[ "$output" == *"Warning"* ]]
  [[ "$output" == *"chat-only"* ]]
  # extension should not be installed from empty file ( -s check )
  [ ! -s "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ] || true
}

@test "extension is re-installed on second run and overwrites correctly" {
  run_setup
  [ "$status" -eq 0 ]
  [ -f "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ]
  # modify installed file to simulate old version
  echo "// old version" > "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  grep -q "old version" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  # second run should overwrite with fixture content
  run bash "$PROJECT_ROOT/setup.sh"
  [ "$status" -eq 0 ]
  grep -q "Test fixture chat-only line" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  ! grep -q "old version" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
}

@test "chat-only extension defaults to tools enabled (/tools default, /chat manual)" {
  run_setup
  [ "$status" -eq 0 ]
  [ -f "$HOME/.pi/agent/extensions/chat-only/chat-only.js" ]
  # new sessions default to tools – chatModeEnabled must be false
  grep -q "let chatModeEnabled = false" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  grep -q "Starts every session with tools enabled" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  grep -q "Every new session defaults to tools enabled" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
  # chat-only is opt-in via /chat, not default
  ! grep -q "Every new session defaults to chat-only" "$HOME/.pi/agent/extensions/chat-only/chat-only.js"
}

@test "generate-design extension is installed from clone" {
  run_setup
  [ "$status" -eq 0 ]
  [ -d "$HOME/.pi/agent/extensions/generate-design" ]
  [ -f "$HOME/.pi/agent/extensions/generate-design/index.ts" ] || [ -f "$HOME/.pi/agent/extensions/generate-design/manifest.json" ]
}

@test "missing git binary fails fast with helpful message" {
  # hide git
  mkdir -p "$TEST_TMP/nogit-bin"
  for b in bash sh cat grep mkdir mktemp rm mv cp dirname pwd date head tr cut sort chmod ls wc npm pi jq; do
    if p=$(command -v "$b" 2>/dev/null); then
      # skip git
      if [ "$b" = "git" ]; then continue; fi
      ln -sf "$p" "$TEST_TMP/nogit-bin/$b" 2>/dev/null || true
    fi
  done
  # copy our fake npm/pi into nogit bin so setup can find them
  cp "$FAKE_BIN/npm" "$TEST_TMP/nogit-bin/" 2>/dev/null || true
  cp "$FAKE_BIN/pi" "$TEST_TMP/nogit-bin/" 2>/dev/null || true
  export PATH="$TEST_TMP/nogit-bin"
  ! command -v git >/dev/null 2>&1
  run bash "$PROJECT_ROOT/setup.sh"
  [ "$status" -ne 0 ]
  [[ "$output" == *"git is required"* ]]
}
