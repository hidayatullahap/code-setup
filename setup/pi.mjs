import fs from "node:fs";
import path from "node:path";
import {
  LEGACY_CHAT_ONLY_FILE,
  PI_PACKAGE,
  PI_PLUGINS,
  VISION_CONFIG,
  WEB_SEARCH_PROVIDERS,
  buildWebSearchConfig,
  mergeSettings,
  parseJsonObject,
  runRequired,
  withAgentsSection,
} from "./config.mjs";

function readTextFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function askWebSearchKeys(prompts) {
  const providers = await prompts.multiselect({
    message: "Which web search API keys do you want to set?",
    options: WEB_SEARCH_PROVIDERS.map((provider) => ({ value: provider, label: provider.label, hint: provider.hint })),
    required: false,
  });
  const answers = [];
  for (const provider of providers) {
    answers.push({ provider, key: await prompts.password({ message: `${provider.label} API key` }) });
  }
  return buildWebSearchConfig(answers);
}

export async function configureWebSearch({ webSearchPath, prompts, output }) {
  output.log("==> Configuring web search API keys...");
  if (!prompts) {
    output.log("  Skipping web search setup (non-interactive environment).");
    return;
  }
  const config = await askWebSearchKeys(prompts);
  if (Object.keys(config).length === 0) {
    output.log("  No keys provided.");
    return;
  }
  fs.mkdirSync(path.dirname(webSearchPath), { recursive: true });
  writeJsonFile(webSearchPath, config);
  output.log(`  Saved to ${webSearchPath}`);
}

function installPiPackages({ runCommand, output }) {
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

function showPiSummary({ agentDir, runCommand, output }) {
  output.log("==> Installed pi packages:");
  runCommand("pi", ["list"]);
  for (const fileName of ["vision.json", "settings.json"]) {
    const text = readTextFile(path.join(agentDir, fileName));
    if (text) output.log(text);
  }
}

export function installPi({ repoDir, agentDir, runCommand, output }) {
  installPiPackages({ runCommand, output });
  fs.mkdirSync(agentDir, { recursive: true });
  writeVisionConfig({ agentDir, output });
  appendAgents({ repoDir, agentDir, output });
  mergeSubagentSettings({ repoDir, agentDir, output });
  showPiSummary({ agentDir, runCommand, output });
}

export function installExtensions({ repoDir, agentDir, output }) {
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
