#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  AGENTS_MARKER,
  DEFAULT_GIT_EMAIL,
  DEFAULT_GIT_NAME,
  DEFAULT_VISION_CONFIG,
  PI_CODING_AGENT_PACKAGE,
  PI_PACKAGES,
  WEB_SEARCH_PROVIDERS,
  appendAgentsMarkdown,
  buildWebSearchConfig,
  mergeJsonObjects,
  parseArgs,
  parseWebSearchSelection,
  resolveSetupPaths,
} from "./lib/setup-core.mjs";
import { setupNeovim } from "./lib/setup-nvim.mjs";

const REPO_URL = "https://github.com/hidayatullahap/code-setup.git";
const REPO_BRANCH = "main";

const HELP_TEXT = `Usage: node setup.mjs [options]

Options:
  --extensions        Install only pi extensions
  --web-search        Configure only ~/.pi/web-search.json
  --git-local         Configure git user.email and user.name for the current repo
  --git-global        Configure global git user.email and user.name
  --nvim              Install and configure Neovim and language servers
  --all               Run standard setup plus Neovim setup
  --source <dir>      Read setup assets from <dir>
  --from-clone <dir>  Alias for --source <dir>
  --dest <dir>        Custom destination directory for extensions
  -h, --help          Show this help message
`;

function createCommandRunner(env, platform) {
  const isWindows = platform === "win32";
  return function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
      stdio: options.capture ? "pipe" : "inherit",
      encoding: "utf8",
      env,
      shell: isWindows,
    });
    return {
      ok: result.status === 0,
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  };
}

function createBinaryChecker(runCommand, platform) {
  const lookupCmd = platform === "win32" ? "where" : "which";
  return function hasBinary(binaryName) {
    return runCommand(lookupCmd, [binaryName], { capture: true }).ok;
  };
}

function hasNonEmptyFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

function parseJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return { valid: true, value: JSON.parse(raw) };
  } catch (error) {
    return { valid: false, error };
  }
}

export async function promptWebSearchKeys(askQuestion, isInteractive, log) {
  log.info("==> Configuring web search API keys (optional)...");
  if (!isInteractive) {
    log.info("  Skipping web search setup (non-interactive environment).");
    return {};
  }

  let selectedProviders = [];
  while (selectedProviders.length === 0) {
    log.info("  Select API key(s) to configure (comma-separated, e.g. 1,3,5) or 'a' for all:\n");
    WEB_SEARCH_PROVIDERS.forEach((provider, idx) => {
      log.info(`  [${String(idx + 1).padStart(2, " ")}] ${provider.label}`);
    });
    log.info("\n  [0]  Done / Skip\n");

    const choice = await askQuestion("  Choice: ");
    const parsed = parseWebSearchSelection(choice, WEB_SEARCH_PROVIDERS);
    for (const badToken of parsed.invalidTokens) {
      log.info(`  Invalid number: ${badToken} (ignored)`);
    }
    if (parsed.skipped || !choice.trim()) {
      log.info("  No selection made.");
      return {};
    }
    selectedProviders = parsed.selectedProviders;
  }

  const entries = [];
  for (const provider of selectedProviders) {
    const value = await askQuestion(`  ${provider.label}: `);
    entries.push({ jsonKey: provider.jsonKey, value });
  }
  return buildWebSearchConfig(entries);
}

export function writeWebSearchConfig(webSearchFile, configObject, log) {
  log.info("==> Writing web search keys to config...");
  if (Object.keys(configObject).length === 0) {
    log.info("  No keys configured, skipping web-search.json");
    return;
  }
  fs.mkdirSync(path.dirname(webSearchFile), { recursive: true });
  fs.writeFileSync(webSearchFile, `${JSON.stringify(configObject, null, 2)}\n`, "utf8");
  log.info(`  Saved to ${webSearchFile}`);
}

export async function configureGitUser(scope, askQuestion, isInteractive, runCommand, hasBinary, log) {
  const flag = scope === "local" ? "--local" : "--global";
  log.info(`==> Configuring git ${scope} user...`);

  if (!hasBinary("git")) {
    const message = "git not found, skipping git config";
    if (scope === "local") {
      log.error(`Error: ${message}`);
      return false;
    }
    log.warn(`Warning: ${message}`);
    return true;
  }

  if (scope === "local" && !runCommand("git", ["rev-parse", "--is-inside-work-tree"], { capture: true }).ok) {
    log.error("Error: not inside a git repository. Run this inside a repo (where .git exists).");
    return false;
  }

  if (!isInteractive) {
    log.info(`Skipping git ${scope} config (non-interactive environment).`);
    return true;
  }

  const reply = (await askQuestion(`Set git config ${flag} user.email/name? [y/N]: `)).trim().toLowerCase();
  if (reply !== "y" && reply !== "yes") {
    log.info(`Skipped git ${scope} config`);
    return true;
  }

  const emailInput = (await askQuestion(`Email [${DEFAULT_GIT_EMAIL}]: `)).trim();
  const nameInput = (await askQuestion(`Name [${DEFAULT_GIT_NAME}]: `)).trim();
  const email = emailInput || DEFAULT_GIT_EMAIL;
  const name = nameInput || DEFAULT_GIT_NAME;

  runCommand("git", ["config", flag, "user.email", email]);
  runCommand("git", ["config", flag, "user.name", name]);
  log.info(`Set git (${scope}) user.email=${email} and user.name=${name}`);
  return true;
}

export function installPiAndPackages(runCommand, log) {
  log.info("==> Installing pi...");
  const npmResult = runCommand("npm", ["install", "-g", "--ignore-scripts", PI_CODING_AGENT_PACKAGE]);
  if (!npmResult.ok) {
    log.error(`Error: failed to install ${PI_CODING_AGENT_PACKAGE}`);
    return false;
  }

  log.info("==> Installing pi packages...");
  for (const pkg of PI_PACKAGES) {
    const pkgResult = runCommand("pi", ["install", pkg]);
    if (!pkgResult.ok) {
      log.error(`Error: failed to install ${pkg}`);
      return false;
    }
  }
  return true;
}

export function configureVisionHandoff(visionFile, log) {
  log.info("==> Configuring vision handoff...");
  fs.mkdirSync(path.dirname(visionFile), { recursive: true });
  if (fs.existsSync(visionFile)) {
    log.info("vision.json already exists, skipping");
    return;
  }
  fs.writeFileSync(visionFile, `${JSON.stringify(DEFAULT_VISION_CONFIG, null, 2)}\n`, "utf8");
  log.info(`Created ${visionFile} (${DEFAULT_VISION_CONFIG.provider}/${DEFAULT_VISION_CONFIG.model})`);
}

function installChatOnlyExtension(sourceExtensionsDir, destExtensionsDir, log) {
  const chatSrc = path.join(sourceExtensionsDir, "chat-only", "chat-only.js");
  const chatDestDir = path.join(destExtensionsDir, "chat-only");
  const chatDest = path.join(chatDestDir, "index.js");
  const legacyDest = path.join(chatDestDir, "chat-only.js");
  fs.mkdirSync(chatDestDir, { recursive: true });
  fs.rmSync(legacyDest, { force: true });

  if (!hasNonEmptyFile(chatSrc)) {
    log.warn(`Warning: extensions/chat-only/chat-only.js not found in source (${sourceExtensionsDir}), skipping`);
    return;
  }
  fs.copyFileSync(chatSrc, chatDest);
  log.info(`Installed chat-only -> ${chatDest} (from clone)`);
}

function installGenerateDesignExtension(sourceExtensionsDir, destExtensionsDir, log) {
  const gdSrc = path.join(sourceExtensionsDir, "generate-design");
  const gdDest = path.join(destExtensionsDir, "generate-design");
  if (!fs.existsSync(gdSrc)) {
    log.warn(`Warning: extensions/generate-design not found in source (${sourceExtensionsDir}), skipping`);
    return;
  }
  fs.mkdirSync(gdDest, { recursive: true });
  fs.cpSync(gdSrc, gdDest, { recursive: true });
  const skillsDir = path.join(gdDest, "skills");
  if (fs.existsSync(skillsDir)) {
    const skillCount = fs.readdirSync(skillsDir).length;
    log.info(`Installed generate-design -> ${gdDest}/ (${skillCount} skill(s), from clone)`);
  } else {
    log.warn(`Warning: ${skillsDir} not found after copy`);
  }
}

function installSingleFileExtension(name, sourceExtensionsDir, destExtensionsDir, log) {
  const extSrcDir = path.join(sourceExtensionsDir, name);
  const entrySrc = path.join(extSrcDir, "index.ts");
  const extDestDir = path.join(destExtensionsDir, name);
  const entryDest = path.join(extDestDir, "index.ts");
  if (!hasNonEmptyFile(entrySrc)) {
    log.warn(`Warning: extensions/${name}/index.ts not found in source (${sourceExtensionsDir}), skipping`);
    return;
  }
  fs.mkdirSync(extDestDir, { recursive: true });
  fs.copyFileSync(entrySrc, entryDest);
  const readmeSrc = path.join(extSrcDir, "README.md");
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(extDestDir, "README.md"));
  }
  log.info(`Installed ${name} -> ${entryDest} (from clone)`);
}

export function installAllExtensions(sourceExtensionsDir, destExtensionsDir, log) {
  log.info(`==> Installing pi extensions to ${destExtensionsDir}...`);
  fs.mkdirSync(destExtensionsDir, { recursive: true });
  installChatOnlyExtension(sourceExtensionsDir, destExtensionsDir, log);
  installGenerateDesignExtension(sourceExtensionsDir, destExtensionsDir, log);
  installSingleFileExtension("kiosapi", sourceExtensionsDir, destExtensionsDir, log);
  installSingleFileExtension("kucing", sourceExtensionsDir, destExtensionsDir, log);
}

export function configureAgentsMarkdown(sourceAgentsFile, targetAgentsFile, log) {
  log.info("==> Appending AGENTS.md...");
  if (!hasNonEmptyFile(sourceAgentsFile)) {
    log.warn(`Warning: AGENTS.md not found in clone (${path.dirname(sourceAgentsFile)}), skipping`);
    return;
  }
  fs.mkdirSync(path.dirname(targetAgentsFile), { recursive: true });
  const existing = fs.existsSync(targetAgentsFile) ? fs.readFileSync(targetAgentsFile, "utf8") : "";
  const sourceText = fs.readFileSync(sourceAgentsFile, "utf8");
  const result = appendAgentsMarkdown(existing, sourceText, AGENTS_MARKER);
  if (!result.updated) {
    log.info("AGENTS.md already appended, skipping");
    return;
  }
  fs.writeFileSync(targetAgentsFile, result.content, "utf8");
  log.info(`Appended AGENTS.md to ${targetAgentsFile}`);
}

export function configureSubagentsSettings(sourceSubagentsFile, settingsFile, log) {
  log.info("==> Configuring subagents in settings.json...");
  if (!hasNonEmptyFile(sourceSubagentsFile)) {
    log.warn(`Warning: subagents.json not found in clone (${path.dirname(sourceSubagentsFile)}), skipping`);
    return;
  }
  const parsedSource = parseJsonFile(sourceSubagentsFile);
  if (!parsedSource.valid) {
    log.warn(`Warning: ${sourceSubagentsFile} is not valid JSON, skipping`);
    return;
  }

  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  let existingObject = {};
  if (hasNonEmptyFile(settingsFile)) {
    const parsedExisting = parseJsonFile(settingsFile);
    if (!parsedExisting.valid) {
      const backupPath = `${settingsFile}.bak.${Math.floor(Date.now() / 1000)}`;
      log.warn(`Warning: ${settingsFile} is not valid JSON, backing up to ${backupPath} and resetting`);
      fs.copyFileSync(settingsFile, backupPath);
    } else {
      existingObject = parsedExisting.value;
    }
  }

  const merged = mergeJsonObjects(parsedSource.value, existingObject);
  fs.writeFileSync(settingsFile, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  log.info(`Merged ${sourceSubagentsFile} into ${settingsFile} (user settings preserved)`);
}

function acquireSourceDirectory(parsedSourceDir, scriptDir, env, runCommand, hasBinary, log) {
  if (parsedSourceDir) {
    return { dir: parsedSourceDir, tempCloneDir: "", ok: true };
  }
  const hasLocalAssets = fs.existsSync(path.join(scriptDir, "AGENTS.md")) && fs.existsSync(path.join(scriptDir, "extensions"));
  if (hasLocalAssets && env.SETUP_FORCE_CLONE !== "1") {
    return { dir: scriptDir, tempCloneDir: "", ok: true };
  }
  if (!hasBinary("git")) {
    log.error("Error: git is required but not found. Install git first and re-run setup.");
    return { dir: "", tempCloneDir: "", ok: false };
  }
  const tempCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-setup-"));
  log.info(`Cloning ${REPO_URL} (branch: ${REPO_BRANCH}) into ${tempCloneDir} ...`);
  const cloneRes = runCommand("git", ["clone", "--depth", "1", "--branch", REPO_BRANCH, REPO_URL, tempCloneDir]);
  if (!cloneRes.ok) {
    fs.rmSync(tempCloneDir, { recursive: true, force: true });
    log.error(`Error: failed to clone ${REPO_URL}`);
    return { dir: "", tempCloneDir: "", ok: false };
  }
  return { dir: tempCloneDir, tempCloneDir, ok: true };
}

export async function runSetup(argv = process.argv.slice(2), customDeps = {}) {
  const platform = customDeps.platform ?? process.platform;
  const env = customDeps.env ?? process.env;
  const homeDir = customDeps.homeDir ?? env.HOME ?? os.homedir();
  const runCommand = customDeps.runCommand ?? createCommandRunner(env, platform);
  const hasBinary = customDeps.hasBinary ?? createBinaryChecker(runCommand, platform);
  const isInteractive = customDeps.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const log = customDeps.log ?? {
    info: (msg) => console.log(msg),
    warn: (msg) => console.error(msg),
    error: (msg) => console.error(msg),
  };

  const parsed = parseArgs(argv);
  if (parsed.unknownFlag) {
    log.error(`Unknown option: ${parsed.unknownFlag}\n${HELP_TEXT}`);
    return 1;
  }
  if (parsed.showHelp) {
    log.info(HELP_TEXT);
    return 0;
  }

  const rl = isInteractive && !customDeps.askQuestion
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const askQuestion = customDeps.askQuestion ?? (async (promptText) => (rl ? rl.question(promptText) : ""));

  let tempCloneDir = "";
  try {
    const { steps } = parsed;
    const webKeys = steps.webSearch ? await promptWebSearchKeys(askQuestion, isInteractive, log) : {};

    if (steps.gitGlobal && !(await configureGitUser("global", askQuestion, isInteractive, runCommand, hasBinary, log))) {
      return 1;
    }
    if (steps.gitLocal && !(await configureGitUser("local", askQuestion, isInteractive, runCommand, hasBinary, log))) {
      return 1;
    }

    const needsRepoFiles = steps.extensions || steps.agentsMd || steps.subagentsConfig;
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    let sourceDir = parsed.sourceDir || scriptDir;
    if (needsRepoFiles) {
      const sourceInfo = acquireSourceDirectory(parsed.sourceDir, scriptDir, env, runCommand, hasBinary, log);
      tempCloneDir = sourceInfo.tempCloneDir;
      if (!sourceInfo.ok) {
        return 1;
      }
      sourceDir = sourceInfo.dir;
    }

    const paths = resolveSetupPaths(homeDir, sourceDir, parsed.destDir);
    if (steps.piPackages && !installPiAndPackages(runCommand, log)) {
      return 1;
    }
    if (steps.visionConfig) {
      configureVisionHandoff(paths.visionFile, log);
    }
    if (steps.extensions) {
      installAllExtensions(paths.sourceExtensionsDir, paths.extensionsDestDir, log);
    }
    if (steps.agentsMd) {
      configureAgentsMarkdown(paths.sourceAgentsFile, paths.agentsFile, log);
    }
    if (steps.subagentsConfig) {
      configureSubagentsSettings(paths.sourceSubagentsFile, paths.settingsFile, log);
    }
    if (steps.webSearch) {
      writeWebSearchConfig(paths.webSearchFile, webKeys, log);
    }
    if (steps.nvim && !setupNeovim(runCommand, hasBinary, env, homeDir, platform, log)) {
      return 1;
    }
    if (steps.piPackages) {
      log.info("==> Done. Installed packages:");
      runCommand("pi", ["list"]);
    }
    return 0;
  } finally {
    if (rl) {
      rl.close();
    }
    if (tempCloneDir) {
      fs.rmSync(tempCloneDir, { recursive: true, force: true });
    }
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) {
  const code = await runSetup();
  process.exit(code);
}
