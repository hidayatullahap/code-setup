import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MARKER,
  DEFAULT_GIT_EMAIL,
  DEFAULT_GIT_NAME,
  PI_PLUGINS,
  WEB_SEARCH_PROVIDERS,
  buildWebSearchConfig,
  mergeSettings,
  parseJsonObject,
  parseKeySelection,
  withAgentsSection,
} from "../setup/config.mjs";
import { runSetup } from "../setup/setup.mjs";

const REPO_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKIP_WEB_SEARCH = "0";
const DECLINE_GIT = "n";

function createTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "code-setup-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function createFakes({ answers = null, statusFor = () => 0 } = {}) {
  const commands = [];
  const lines = [];
  const remainingAnswers = answers && [...answers];
  return {
    commands,
    lines,
    runCommand: (command, args) => {
      commands.push([command, ...args].join(" "));
      return statusFor(command, args);
    },
    ask: remainingAnswers && (async () => remainingAnswers.shift() ?? ""),
    output: { log: (line) => lines.push(line), warn: (line) => lines.push(line) },
  };
}

function setupWith(home, fakes, { step = "all", repoDir = REPO_DIR } = {}) {
  return runSetup({ step, home, repoDir, ...fakes });
}

function agentPath(home, ...parts) {
  return path.join(home, ".pi", "agent", ...parts);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createRepo(t, { agents, subagents }) {
  const repoDir = createTempDir(t);
  fs.mkdirSync(path.join(repoDir, "extensions"));
  fs.writeFileSync(path.join(repoDir, "AGENTS.md"), agents);
  fs.writeFileSync(path.join(repoDir, "subagents.json"), subagents);
  return repoDir;
}

test("mergeSettings keeps user values and adds missing defaults", () => {
  const defaults = { subagents: { agentOverrides: { delegate: { model: "default" }, worker: { model: "w" } } } };
  const user = { subagents: { agentOverrides: { delegate: { model: "custom" } } }, other: "keep" };
  assert.deepEqual(mergeSettings(defaults, user), {
    subagents: { agentOverrides: { delegate: { model: "custom" }, worker: { model: "w" } } },
    other: "keep",
  });
});

test("mergeSettings replaces arrays instead of merging them", () => {
  assert.deepEqual(mergeSettings({ list: [1, 2] }, { list: [3] }), { list: [3] });
});

test("withAgentsSection appends once", () => {
  const once = withAgentsSection("mine\n", "rules\n");
  assert.equal(once, `mine\n\n${AGENTS_MARKER}\nrules\n`);
  assert.equal(withAgentsSection(once, "rules\n"), once);
});

test("parseJsonObject returns null for invalid JSON and non-objects", () => {
  assert.deepEqual(parseJsonObject('{"a":1}'), { a: 1 });
  assert.equal(parseJsonObject("not-json"), null);
  assert.equal(parseJsonObject("[1]"), null);
});

test("parseKeySelection handles numbers, all, skip and invalid input", () => {
  const [openai, , exa] = WEB_SEARCH_PROVIDERS;
  assert.deepEqual(parseKeySelection("1, 3", WEB_SEARCH_PROVIDERS).selected, [openai, exa]);
  assert.equal(parseKeySelection("a", WEB_SEARCH_PROVIDERS).selected.length, WEB_SEARCH_PROVIDERS.length);
  assert.equal(parseKeySelection("", WEB_SEARCH_PROVIDERS).skip, true);
  assert.equal(parseKeySelection("1,0", WEB_SEARCH_PROVIDERS).skip, true);
  assert.deepEqual(parseKeySelection("1,99,x", WEB_SEARCH_PROVIDERS), {
    skip: false,
    selected: [openai],
    invalid: ["99", "x"],
  });
});

test("buildWebSearchConfig skips empty keys", () => {
  const [openai, brave] = WEB_SEARCH_PROVIDERS;
  const answers = [
    { provider: openai, key: " sk-1 " },
    { provider: brave, key: "" },
  ];
  assert.deepEqual(buildWebSearchConfig(answers), { openaiApiKey: "sk-1" });
});

test("full setup installs pi, config files and every extension", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes();
  await setupWith(home, fakes);

  assert.ok(fakes.commands.includes("npm install -g --ignore-scripts @earendil-works/pi-coding-agent"));
  for (const plugin of PI_PLUGINS) assert.ok(fakes.commands.includes(`pi install ${plugin}`));
  assert.equal(readJson(agentPath(home, "vision.json")).provider, "opencode-go");
  assert.match(fs.readFileSync(agentPath(home, "AGENTS.md"), "utf8"), new RegExp(AGENTS_MARKER));
  const settings = readJson(agentPath(home, "settings.json"));
  assert.equal(settings.subagents.agentOverrides.delegate.model, "opencode-go/muse-spark-1.2-contributor");
  for (const extension of fs.readdirSync(path.join(REPO_DIR, "extensions"))) {
    assert.ok(fs.existsSync(agentPath(home, "extensions", extension)), `${extension} not installed`);
  }
  assert.ok(fs.existsSync(agentPath(home, "extensions", "chat-only", "index.js")));
  assert.ok(fs.existsSync(agentPath(home, "extensions", "generate-design", "skills", "design-workflow.md")));
  assert.equal(fs.existsSync(path.join(home, ".pi", "web-search.json")), false);
});

test("second run does not duplicate AGENTS.md or overwrite vision.json", async (t) => {
  const home = createTempDir(t);
  await setupWith(home, createFakes());
  fs.writeFileSync(agentPath(home, "vision.json"), '{"provider":"mine"}');
  fs.writeFileSync(agentPath(home, "extensions", "chat-only", "index.js"), "old version");
  fs.writeFileSync(agentPath(home, "extensions", "chat-only", "chat-only.js"), "legacy");

  await setupWith(home, createFakes());

  const agentsText = fs.readFileSync(agentPath(home, "AGENTS.md"), "utf8");
  assert.equal(agentsText.split(AGENTS_MARKER).length, 2);
  assert.equal(readJson(agentPath(home, "vision.json")).provider, "mine");
  assert.notEqual(fs.readFileSync(agentPath(home, "extensions", "chat-only", "index.js"), "utf8"), "old version");
  assert.equal(fs.existsSync(agentPath(home, "extensions", "chat-only", "chat-only.js")), false);
});

test("user settings win over subagent defaults", async (t) => {
  const home = createTempDir(t);
  fs.mkdirSync(agentPath(home), { recursive: true });
  const userSettings = { subagents: { agentOverrides: { delegate: { model: "custom/my-model" } } }, otherKey: "keep" };
  fs.writeFileSync(agentPath(home, "settings.json"), JSON.stringify(userSettings));

  await setupWith(home, createFakes());

  const settings = readJson(agentPath(home, "settings.json"));
  assert.equal(settings.subagents.agentOverrides.delegate.model, "custom/my-model");
  assert.equal(settings.subagents.agentOverrides.worker.model, "opencode-go/deepseek-v4-flash");
  assert.equal(settings.otherKey, "keep");
});

test("invalid settings.json is backed up and reset", async (t) => {
  const home = createTempDir(t);
  fs.mkdirSync(agentPath(home), { recursive: true });
  fs.writeFileSync(agentPath(home, "settings.json"), "not-json");
  const fakes = createFakes();

  await setupWith(home, fakes);

  const backups = fs.readdirSync(agentPath(home)).filter((name) => name.startsWith("settings.json.bak."));
  assert.equal(backups.length, 1);
  assert.ok(readJson(agentPath(home, "settings.json")).subagents);
  assert.ok(fakes.lines.some((line) => line.includes("not valid JSON")));
});

test("invalid subagents.json and empty AGENTS.md are skipped with warnings", async (t) => {
  const home = createTempDir(t);
  const repoDir = createRepo(t, { agents: "", subagents: "not-json" });
  const fakes = createFakes();

  await setupWith(home, fakes, { repoDir });

  assert.equal(fs.existsSync(agentPath(home, "settings.json")), false);
  assert.equal(fs.existsSync(agentPath(home, "AGENTS.md")), false);
  assert.ok(fakes.lines.some((line) => line.includes("subagents.json is not valid JSON")));
  assert.ok(fakes.lines.some((line) => line.includes("AGENTS.md not found")));
});

test("interactive setup saves web search keys and sets git global user", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: ["99", "1,2", "sk-test", "", "y", "", ""] });

  await setupWith(home, fakes);

  assert.deepEqual(readJson(path.join(home, ".pi", "web-search.json")), { openaiApiKey: "sk-test" });
  assert.ok(fakes.commands.includes(`git config --global user.email ${DEFAULT_GIT_EMAIL}`));
  assert.ok(fakes.commands.includes(`git config --global user.name ${DEFAULT_GIT_NAME}`));
  assert.ok(fakes.lines.includes("  Invalid number: 99 (ignored)"));
});

test("declining prompts writes no keys and runs no git config", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: [SKIP_WEB_SEARCH, DECLINE_GIT] });

  await setupWith(home, fakes);

  assert.equal(fs.existsSync(path.join(home, ".pi", "web-search.json")), false);
  assert.equal(fakes.commands.some((command) => command.startsWith("git config")), false);
});

test("failed pi install stops setup", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ statusFor: (command) => (command === "npm" ? 1 : 0) });

  await assert.rejects(setupWith(home, fakes), /npm install .* failed with exit code 1/);
  assert.equal(fs.existsSync(agentPath(home, "vision.json")), false);
});

test("extensions step installs extensions only", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes();

  await setupWith(home, fakes, { step: "extensions" });

  assert.ok(fs.existsSync(agentPath(home, "extensions", "kucing", "index.ts")));
  assert.deepEqual(fakes.commands, []);
  assert.equal(fs.existsSync(agentPath(home, "vision.json")), false);
});

test("git-local step sets the repo user", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: ["y", "me@example.com", "Me"] });

  await setupWith(home, fakes, { step: "git-local" });

  assert.ok(fakes.commands.includes("git config --local user.email me@example.com"));
  assert.ok(fakes.commands.includes("git config --local user.name Me"));
});

test("git-local step fails outside a git repository", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: ["y"], statusFor: (command, args) => (args[0] === "rev-parse" ? 128 : 0) });

  await assert.rejects(setupWith(home, fakes, { step: "git-local" }), /not inside a git repository/);
  assert.equal(fakes.commands.some((command) => command.startsWith("git config")), false);
});
