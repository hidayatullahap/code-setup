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
  withAgentsSection,
} from "../setup/config.mjs";
import { runSetup } from "../setup/setup.mjs";

const REPO_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PI_STEPS = ["pi", "extensions"];

function createTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "code-setup-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function createFakePrompts(answers) {
  const remainingAnswers = [...answers];
  const nextAnswer = async (options) => (remainingAnswers.length > 0 ? remainingAnswers.shift() : options.defaultValue);
  return { multiselect: nextAnswer, password: nextAnswer, text: nextAnswer };
}

function createFakes({ answers = null, statusFor = () => 0 } = {}) {
  const commands = [];
  const lines = [];
  return {
    commands,
    lines,
    runCommand: (command, args) => {
      commands.push([command, ...args].join(" "));
      return statusFor(command, args);
    },
    hasCommand: () => true,
    prompts: answers && createFakePrompts(answers),
    output: { log: (line) => lines.push(line), warn: (line) => lines.push(line) },
  };
}

function setupWith(home, fakes, { steps = PI_STEPS, repoDir = REPO_DIR } = {}) {
  return runSetup({ steps, home, nvimDir: path.join(home, "nvim"), repoDir, ...fakes });
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

test("buildWebSearchConfig skips empty keys", () => {
  const [openai, brave] = WEB_SEARCH_PROVIDERS;
  const answers = [
    { provider: openai, key: " sk-1 " },
    { provider: brave, key: "" },
  ];
  assert.deepEqual(buildWebSearchConfig(answers), { openaiApiKey: "sk-1" });
});

test("pi steps install pi, config files and every extension", async (t) => {
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

test("web search step saves only the keys that were filled in", async (t) => {
  const home = createTempDir(t);
  const [openai, brave] = WEB_SEARCH_PROVIDERS;
  const fakes = createFakes({ answers: [[openai, brave], "sk-test", ""] });

  await setupWith(home, fakes, { steps: ["web-search"] });

  assert.deepEqual(readJson(path.join(home, ".pi", "web-search.json")), { openaiApiKey: "sk-test" });
});

test("web search step writes nothing when no provider is picked", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: [[]] });

  await setupWith(home, fakes, { steps: ["web-search"] });

  assert.equal(fs.existsSync(path.join(home, ".pi", "web-search.json")), false);
});

test("git-global step uses the default user when answers are empty", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: [] });

  await setupWith(home, fakes, { steps: ["git-global"] });

  assert.ok(fakes.commands.includes(`git config --global user.email ${DEFAULT_GIT_EMAIL}`));
  assert.ok(fakes.commands.includes(`git config --global user.name ${DEFAULT_GIT_NAME}`));
});

test("prompt steps are skipped without an interactive terminal", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes();

  await setupWith(home, fakes, { steps: ["web-search", "git-global"] });

  assert.equal(fs.existsSync(path.join(home, ".pi", "web-search.json")), false);
  assert.deepEqual(fakes.commands, []);
});

test("steps run in menu order, not in the order given", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes();

  await setupWith(home, fakes, { steps: ["extensions", "pi"] });

  const piLine = fakes.lines.indexOf("==> Installing pi...");
  const extensionsLine = fakes.lines.indexOf("==> Installing extensions...");
  assert.ok(piLine >= 0 && piLine < extensionsLine);
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

  await setupWith(home, fakes, { steps: ["extensions"] });

  assert.ok(fs.existsSync(agentPath(home, "extensions", "kucing", "index.ts")));
  assert.deepEqual(fakes.commands, []);
  assert.equal(fs.existsSync(agentPath(home, "vision.json")), false);
});

test("git-local step sets the repo user", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: ["me@example.com", "Me"] });

  await setupWith(home, fakes, { steps: ["git-local"] });

  assert.ok(fakes.commands.includes("git config --local user.email me@example.com"));
  assert.ok(fakes.commands.includes("git config --local user.name Me"));
});

test("git-local step fails outside a git repository", async (t) => {
  const home = createTempDir(t);
  const fakes = createFakes({ answers: [], statusFor: (command, args) => (args[0] === "rev-parse" ? 128 : 0) });

  await assert.rejects(setupWith(home, fakes, { steps: ["git-local"] }), /not inside a git repository/);
  assert.equal(fakes.commands.some((command) => command.startsWith("git config")), false);
});
