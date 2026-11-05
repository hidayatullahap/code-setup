import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_GIT_EMAIL,
  DEFAULT_GIT_NAME,
  LEGACY_CHAT_ONLY_FILE,
  PI_PACKAGE,
  PI_PLUGINS,
  VISION_CONFIG,
  WEB_SEARCH_PROVIDERS,
  buildWebSearchConfig,
  isYes,
  mergeSettings,
  parseJsonObject,
  parseKeySelection,
  withAgentsSection,
} from "./config.mjs";

const STEP_ALL = "all";
const STEP_EXTENSIONS = "extensions";
const STEP_GIT_LOCAL = "git-local";
const STEPS = [STEP_ALL, STEP_EXTENSIONS, STEP_GIT_LOCAL];
const USAGE = `Usage: node setup/setup.mjs [${STEP_EXTENSIONS} | ${STEP_GIT_LOCAL}]`;
const WINDOWS_SHELL_COMMANDS = new Set(["npm", "pi"]);
const REPO_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readTextFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runRequired(runCommand, command, args) {
  const status = runCommand(command, args);
  if (status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${status}`);
}

function logProviderMenu(output) {
  output.log("  Select API key(s) to configure (comma-separated, e.g. 1,3,5) or 'a' for all:");
  output.log("");
  WEB_SEARCH_PROVIDERS.forEach((provider, index) => {
    output.log(`  [${String(index + 1).padStart(2)}] ${provider.label}`);
  });
  output.log("");
  output.log("  [0]  Done / Skip");
  output.log("");
}

async function askProviderChoice({ ask, output }) {
  while (true) {
    logProviderMenu(output);
    const { skip, selected, invalid } = parseKeySelection(await ask("  Choice: "), WEB_SEARCH_PROVIDERS);
    for (const number of invalid) output.log(`  Invalid number: ${number} (ignored)`);
    if (skip) return [];
    if (selected.length > 0) return selected;
  }
}

async function askWebSearchKeys({ ask, output }) {
  output.log("==> Configuring web search API keys (optional)...");
  if (!ask) {
    output.log("  Skipping web search setup (non-interactive environment).");
    return {};
  }
  const answers = [];
  for (const provider of await askProviderChoice({ ask, output })) {
    answers.push({ provider, key: await ask(`  ${provider.label}: `) });
  }
  return buildWebSearchConfig(answers);
}

function saveWebSearchConfig({ webSearchPath, config, output }) {
  if (Object.keys(config).length === 0) {
    output.log("  No keys provided.");
    return;
  }
  fs.mkdirSync(path.dirname(webSearchPath), { recursive: true });
  writeJsonFile(webSearchPath, config);
  output.log(`  Saved to ${webSearchPath}`);
}

async function configureGitUser({ scope, ask, runCommand, output }) {
  if (!ask) {
    output.log(`Skipping git ${scope} config (non-interactive environment).`);
    return;
  }
  if (!isYes(await ask(`Set git config --${scope} user.email/name? [y/N]: `))) {
    output.log(`Skipped git ${scope} config`);
    return;
  }
  const email = (await ask(`Email [${DEFAULT_GIT_EMAIL}]: `)).trim() || DEFAULT_GIT_EMAIL;
  const name = (await ask(`Name [${DEFAULT_GIT_NAME}]: `)).trim() || DEFAULT_GIT_NAME;
  runRequired(runCommand, "git", ["config", `--${scope}`, "user.email", email]);
  runRequired(runCommand, "git", ["config", `--${scope}`, "user.name", name]);
  output.log(`Set git (${scope}) user.email=${email} and user.name=${name}`);
}

async function configureGitLocalUser({ ask, runCommand, output }) {
  const insideRepo = runCommand("git", ["rev-parse", "--is-inside-work-tree"], { quiet: true }) === 0;
  if (!insideRepo) throw new Error("not inside a git repository. Run this inside a repo (where .git exists).");
  output.log("==> Configuring git local user (repo-level)...");
  await configureGitUser({ scope: "local", ask, runCommand, output });
}

function installPi({ runCommand, output }) {
  output.log("==> Installing pi...");
  runRequired(runCommand, "npm", ["install", "-g", "--ignore-scripts", PI_PACKAGE]);
  output.log("==> Installing pi packages...");
  for (const plugin of PI_PLUGINS) runRequired(runCommand, "pi", ["install", plugin]);
}

function writeVisionConfig({ agentDir, output }) {
  output.log("==> Configuring vision handoff...");
  const filePath = path.join(agentDir, "vision.json");
  if (fs.existsSync(filePath)) {
    output.log("vision.json already exists, skipping");
    return;
  }
  writeJsonFile(filePath, VISION_CONFIG);
  output.log(`Created ${filePath} (${VISION_CONFIG.provider}/${VISION_CONFIG.model})`);
}

function installExtensions({ repoDir, agentDir, output }) {
  output.log("==> Installing extensions...");
  const sourceDir = path.join(repoDir, "extensions");
  const extensionsDir = path.join(agentDir, "extensions");
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const destination = path.join(extensionsDir, entry.name);
    fs.cpSync(path.join(sourceDir, entry.name), destination, { recursive: true });
    output.log(`    Installed ${entry.name} -> ${destination}`);
  }
  fs.rmSync(path.join(extensionsDir, "chat-only", LEGACY_CHAT_ONLY_FILE), { force: true });
}

function appendAgents({ repoDir, agentDir, output }) {
  output.log("==> Appending AGENTS.md...");
  const agentsText = readTextFile(path.join(repoDir, "AGENTS.md"));
  if (!agentsText.trim()) {
    output.warn(`Warning: AGENTS.md not found in ${repoDir}, skipping`);
    return;
  }
  const targetPath = path.join(agentDir, "AGENTS.md");
  const existingText = readTextFile(targetPath);
  const updatedText = withAgentsSection(existingText, agentsText);
  if (updatedText === existingText) {
    output.log("AGENTS.md already appended, skipping");
    return;
  }
  fs.writeFileSync(targetPath, updatedText);
  output.log(`Appended AGENTS.md to ${targetPath}`);
}

function readSettings({ settingsPath, output }) {
  const text = readTextFile(settingsPath);
  if (!text.trim()) return {};
  const settings = parseJsonObject(text);
  if (settings) return settings;
  const backupPath = `${settingsPath}.bak.${Date.now()}`;
  fs.copyFileSync(settingsPath, backupPath);
  output.warn(`Warning: ${settingsPath} is not valid JSON, backed up to ${backupPath} and reset`);
  return {};
}

function mergeSubagentSettings({ repoDir, agentDir, output }) {
  output.log("==> Configuring subagents in settings.json...");
  const subagentsPath = path.join(repoDir, "subagents.json");
  const subagentsText = readTextFile(subagentsPath);
  if (!subagentsText.trim()) {
    output.warn(`Warning: subagents.json not found in ${repoDir}, skipping`);
    return;
  }
  const subagents = parseJsonObject(subagentsText);
  if (!subagents) {
    output.warn(`Warning: ${subagentsPath} is not valid JSON, skipping`);
    return;
  }
  const settingsPath = path.join(agentDir, "settings.json");
  const settings = readSettings({ settingsPath, output });
  writeJsonFile(settingsPath, mergeSettings(subagents, settings));
  output.log(`Merged ${subagentsPath} into ${settingsPath} (user settings preserved)`);
}

function showSummary({ agentDir, webSearchPath, runCommand, output }) {
  output.log("==> Done. Installed packages:");
  runCommand("pi", ["list"]);
  const configFiles = [
    path.join(agentDir, "vision.json"),
    path.join(agentDir, "settings.json"),
    webSearchPath,
  ];
  for (const filePath of configFiles) {
    const text = readTextFile(filePath);
    if (text) output.log(text);
  }
}

async function runFullSetup({ repoDir, agentDir, webSearchPath, runCommand, ask, output }) {
  const webSearchConfig = await askWebSearchKeys({ ask, output });
  saveWebSearchConfig({ webSearchPath, config: webSearchConfig, output });
  output.log("==> Configuring git global user (optional)...");
  await configureGitUser({ scope: "global", ask, runCommand, output });
  installPi({ runCommand, output });
  fs.mkdirSync(agentDir, { recursive: true });
  writeVisionConfig({ agentDir, output });
  installExtensions({ repoDir, agentDir, output });
  appendAgents({ repoDir, agentDir, output });
  mergeSubagentSettings({ repoDir, agentDir, output });
  showSummary({ agentDir, webSearchPath, runCommand, output });
}

export async function runSetup({ step, home, repoDir, runCommand, ask, output }) {
  const piDir = path.join(home, ".pi");
  const agentDir = path.join(piDir, "agent");
  const webSearchPath = path.join(piDir, "web-search.json");
  if (step === STEP_GIT_LOCAL) return configureGitLocalUser({ ask, runCommand, output });
  if (step === STEP_EXTENSIONS) return installExtensions({ repoDir, agentDir, output });
  return runFullSetup({ repoDir, agentDir, webSearchPath, runCommand, ask, output });
}

function runCommand(command, args, { quiet = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: quiet ? "ignore" : "inherit",
    // Windows installs npm and pi as .cmd files, which Node can only start through a shell.
    shell: process.platform === "win32" && WINDOWS_SHELL_COMMANDS.has(command),
  });
  if (result.error) throw result.error;
  return result.status;
}

async function main() {
  const step = process.argv[2] ?? STEP_ALL;
  if (!STEPS.includes(step)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const prompt = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  const ask = prompt && ((question) => prompt.question(question));
  try {
    await runSetup({ step, home: os.homedir(), repoDir: REPO_DIR, runCommand, ask, output: console });
  } finally {
    prompt?.close();
  }
}

const isEntryPoint =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
