import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MARKER,
  appendAgentsMarkdown,
  buildWebSearchConfig,
  mergeJsonObjects,
  parseArgs,
  parseWebSearchSelection,
  resolveNvimConfigDir,
} from "../lib/setup-core.mjs";
import { runSetup } from "../setup.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createTestHarness(overrides = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "code-setup-test-"));
  const homeDir = path.join(tempRoot, "home");
  fs.mkdirSync(homeDir, { recursive: true });

  const commands = [];
  const logs = [];
  const answers = [...(overrides.answers ?? [])];

  const log = {
    info: (msg) => logs.push(msg),
    warn: (msg) => logs.push(msg),
    error: (msg) => logs.push(msg),
  };

  const runCommand = overrides.runCommand ?? ((cmd, args) => {
    commands.push([cmd, ...args].join(" "));
    return { ok: true, status: 0, stdout: "", stderr: "" };
  });

  const askQuestion = async () => answers.shift() ?? "";

  return {
    tempRoot,
    homeDir,
    commands,
    logs,
    cleanup: () => fs.rmSync(tempRoot, { recursive: true, force: true }),
    run: (argv = [], extraDeps = {}) =>
      runSetup(argv, {
        homeDir,
        env: { HOME: homeDir, ...(overrides.env ?? {}) },
        isInteractive: overrides.isInteractive ?? false,
        askQuestion,
        runCommand,
        log,
        ...extraDeps,
      }),
  };
}

test("parseArgs returns default steps when no mode flags are passed", () => {
  const parsed = parseArgs([]);
  assert.equal(parsed.showHelp, false);
  assert.equal(parsed.unknownFlag, null);
  assert.equal(parsed.steps.piPackages, true);
  assert.equal(parsed.steps.extensions, true);
  assert.equal(parsed.steps.nvim, false);
  assert.equal(parsed.steps.gitLocal, false);
});

test("parseArgs enables only requested steps when mode flags are passed", () => {
  const extOnly = parseArgs(["--extensions", "--source", "src-dir", "--dest", "dest-dir"]);
  assert.equal(extOnly.steps.extensions, true);
  assert.equal(extOnly.steps.piPackages, false);
  assert.equal(extOnly.sourceDir, "src-dir");
  assert.equal(extOnly.destDir, "dest-dir");

  const allSteps = parseArgs(["--all"]);
  assert.equal(allSteps.steps.piPackages, true);
  assert.equal(allSteps.steps.nvim, true);
});

test("mergeJsonObjects preserves user overrides and adds missing defaults", () => {
  const defaults = {
    subagents: {
      agentOverrides: {
        delegate: { model: "default-delegate" },
        worker: { model: "default-worker" },
      },
    },
  };
  const userSettings = {
    subagents: {
      agentOverrides: {
        delegate: { model: "custom/my-model" },
        myExtra: { model: "keep-me" },
      },
    },
    otherKey: "keep",
  };
  const merged = mergeJsonObjects(defaults, userSettings);
  assert.equal(merged.subagents.agentOverrides.delegate.model, "custom/my-model");
  assert.equal(merged.subagents.agentOverrides.worker.model, "default-worker");
  assert.equal(merged.subagents.agentOverrides.myExtra.model, "keep-me");
  assert.equal(merged.otherKey, "keep");
});

test("appendAgentsMarkdown appends once and skips when marker is present", () => {
  const first = appendAgentsMarkdown("", "Rule 1", AGENTS_MARKER);
  assert.equal(first.updated, true);
  assert.ok(first.content.includes(AGENTS_MARKER));
  assert.ok(first.content.includes("Rule 1"));

  const second = appendAgentsMarkdown(first.content, "Rule 1", AGENTS_MARKER);
  assert.equal(second.updated, false);
  assert.equal(second.content, first.content);
});

test("parseWebSearchSelection and buildWebSearchConfig handle selections", () => {
  const picked = parseWebSearchSelection("1, 2, 99");
  assert.equal(picked.skipped, false);
  assert.equal(picked.selectedProviders.length, 2);
  assert.equal(picked.selectedProviders[0].id, "openai");
  assert.equal(picked.selectedProviders[1].id, "brave");
  assert.deepEqual(picked.invalidTokens, ["99"]);

  const skipped = parseWebSearchSelection("0");
  assert.equal(skipped.skipped, true);

  const config = buildWebSearchConfig([
    { jsonKey: "openaiApiKey", value: " sk-123 " },
    { jsonKey: "braveApiKey", value: "" },
  ]);
  assert.deepEqual(config, { openaiApiKey: "sk-123" });
});

test("resolveNvimConfigDir handles Windows and Unix paths", () => {
  const fakeHome = path.join(os.tmpdir(), "fake-home");
  const fakeAppData = path.join(fakeHome, "AppData", "Local");
  const winPath = resolveNvimConfigDir("win32", { LOCALAPPDATA: fakeAppData }, fakeHome);
  assert.equal(winPath, path.join(fakeAppData, "nvim"));

  const unixPath = resolveNvimConfigDir("darwin", {}, fakeHome);
  assert.equal(unixPath, path.join(fakeHome, ".config", "nvim"));
});

test("fresh install creates vision.json, AGENTS.md, settings.json, and all extensions", async () => {
  const harness = createTestHarness();
  try {
    const status = await harness.run(["--source", PROJECT_ROOT]);
    assert.equal(status, 0);

    const agentDir = path.join(harness.homeDir, ".pi", "agent");
    assert.ok(fs.existsSync(path.join(agentDir, "vision.json")));
    assert.ok(fs.readFileSync(path.join(agentDir, "vision.json"), "utf8").includes("opencode-go"));

    const agentsContent = fs.readFileSync(path.join(agentDir, "AGENTS.md"), "utf8");
    assert.ok(agentsContent.includes(AGENTS_MARKER));

    const settingsContent = fs.readFileSync(path.join(agentDir, "settings.json"), "utf8");
    assert.ok(settingsContent.includes("muse-spark-1.2-contributor"));

    const extDir = path.join(agentDir, "extensions");
    assert.ok(fs.existsSync(path.join(extDir, "chat-only", "index.js")));
    assert.ok(!fs.existsSync(path.join(extDir, "chat-only", "chat-only.js")));
    assert.ok(fs.existsSync(path.join(extDir, "generate-design", "index.ts")));
    assert.ok(fs.existsSync(path.join(extDir, "generate-design", "skills", "design-workflow.md")));
    assert.ok(fs.existsSync(path.join(extDir, "kiosapi", "index.ts")));
    assert.ok(fs.existsSync(path.join(extDir, "kucing", "index.ts")));
  } finally {
    harness.cleanup();
  }
});

test("second run does not duplicate AGENTS.md and removes legacy chat-only.js", async () => {
  const harness = createTestHarness();
  try {
    await harness.run(["--source", PROJECT_ROOT]);
    const legacyFile = path.join(harness.homeDir, ".pi", "agent", "extensions", "chat-only", "chat-only.js");
    fs.writeFileSync(legacyFile, "legacy", "utf8");

    const secondStatus = await harness.run(["--source", PROJECT_ROOT]);
    assert.equal(secondStatus, 0);

    const agentsContent = fs.readFileSync(path.join(harness.homeDir, ".pi", "agent", "AGENTS.md"), "utf8");
    const markerMatches = agentsContent.split(AGENTS_MARKER).length - 1;
    assert.equal(markerMatches, 1);
    assert.ok(!fs.existsSync(legacyFile));
  } finally {
    harness.cleanup();
  }
});

test("invalid settings.json is backed up and reset with valid merged JSON", async () => {
  const harness = createTestHarness();
  try {
    const agentDir = path.join(harness.homeDir, ".pi", "agent");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "settings.json"), "not-json", "utf8");

    const status = await harness.run(["--source", PROJECT_ROOT]);
    assert.equal(status, 0);

    const files = fs.readdirSync(agentDir);
    assert.ok(files.some((name) => name.startsWith("settings.json.bak.")));

    const parsed = JSON.parse(fs.readFileSync(path.join(agentDir, "settings.json"), "utf8"));
    assert.ok(parsed.subagents.agentOverrides.delegate.model.includes("muse-spark"));
  } finally {
    harness.cleanup();
  }
});

test("interactive web search and git global configuration save keys and run git config", async () => {
  const harness = createTestHarness({
    isInteractive: true,
    answers: ["1", "sk-test-openai-key", "y", "custom@example.com", "Custom User"],
  });
  try {
    const status = await harness.run(["--source", PROJECT_ROOT]);
    assert.equal(status, 0);

    const webSearchPath = path.join(harness.homeDir, ".pi", "web-search.json");
    const savedKeys = JSON.parse(fs.readFileSync(webSearchPath, "utf8"));
    assert.equal(savedKeys.openaiApiKey, "sk-test-openai-key");

    assert.ok(harness.commands.includes("git config --global user.email custom@example.com"));
    assert.ok(harness.commands.includes("git config --global user.name Custom User"));
  } finally {
    harness.cleanup();
  }
});

test("setupNeovim writes init.lua and backs up existing init.lua", async () => {
  const harness = createTestHarness();
  try {
    const nvimDir = resolveNvimConfigDir(process.platform, { HOME: harness.homeDir }, harness.homeDir);
    fs.mkdirSync(nvimDir, { recursive: true });
    const initPath = path.join(nvimDir, "init.lua");
    fs.writeFileSync(initPath, "old-config", "utf8");

    const status = await harness.run(["--nvim"]);
    assert.equal(status, 0);
    assert.ok(fs.readFileSync(initPath, "utf8").includes("tokyonight"));
    const backups = fs.readdirSync(nvimDir).filter((name) => name.startsWith("init.lua.bak."));
    assert.equal(backups.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("git clone failure exits non-zero when SETUP_FORCE_CLONE=1", async () => {
  const harness = createTestHarness({
    env: { SETUP_FORCE_CLONE: "1" },
    runCommand: (cmd, args) => {
      if (cmd === "git" && args[0] === "clone") {
        return { ok: false, status: 1, stdout: "", stderr: "clone failed" };
      }
      return { ok: true, status: 0, stdout: "", stderr: "" };
    },
  });
  try {
    const status = await harness.run([]);
    assert.equal(status, 1);
    assert.ok(harness.logs.some((line) => line.includes("failed to clone")));
  } finally {
    harness.cleanup();
  }
});

test("generate-design skills and README preserve required workflow rules", () => {
  const workflowFile = path.join(PROJECT_ROOT, "extensions", "generate-design", "skills", "design-workflow.md");
  const workflowText = fs.readFileSync(workflowFile, "utf8");
  assert.ok(workflowText.includes("Phase 1"));
  assert.ok(workflowText.includes("Phase 2"));
  assert.ok(workflowText.includes("Phase 3"));
  assert.ok(workflowText.includes("Do not write index.html"));

  const indexTsFile = path.join(PROJECT_ROOT, "extensions", "generate-design", "index.ts");
  const indexTsText = fs.readFileSync(indexTsFile, "utf8");
  assert.ok(indexTsText.includes("planPhaseInjected"));
  assert.ok(indexTsText.includes("shouldInjectPlanPhase"));
});
