#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { intro, isCancel, multiselect, outro, password, text } from "@clack/prompts";
import { configureGitGlobalUser, configureGitLocalUser } from "./git.mjs";
import { installNvim, nvimConfigDir } from "./nvim.mjs";
import { configureWebSearch, installExtensions, installPi } from "./pi.mjs";

const STEPS = [
  { value: "web-search", label: "Web search API keys", run: configureWebSearch },
  { value: "git-global", label: "Git global user", run: configureGitGlobalUser },
  { value: "pi", label: "pi", hint: "plugins, vision, AGENTS.md, subagent settings", run: installPi },
  { value: "extensions", label: "pi extensions", run: installExtensions },
  { value: "git-local", label: "Git local user", hint: "current repo", run: configureGitLocalUser },
  { value: "nvim", label: "Neovim", hint: "editor, language servers, config", run: installNvim },
];
const DEFAULT_STEPS = ["pi", "extensions"];
const STEP_NAMES = STEPS.map(({ value }) => value);
const USAGE = `Usage: npx --allow-git=root github:hidayatullahap/code-setup [${STEP_NAMES.join(" | ")}]...`;
const CANCEL_MESSAGE = "setup cancelled";
const WINDOWS_SHELL_COMMANDS = new Set(["npm", "pi"]);
const REPO_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function runSetup({ steps, home, nvimDir, repoDir, runCommand, hasCommand, prompts, output }) {
  const piDir = path.join(home, ".pi");
  const context = {
    repoDir,
    agentDir: path.join(piDir, "agent"),
    webSearchPath: path.join(piDir, "web-search.json"),
    nvimDir,
    runCommand,
    hasCommand,
    prompts,
    output,
  };
  for (const step of STEPS) {
    if (steps.includes(step.value)) await step.run(context);
  }
}

function spawnCommand(command, args, stdio) {
  return spawnSync(command, args, {
    stdio,
    // Windows installs npm and pi as .cmd files, which Node can only start through a shell.
    shell: process.platform === "win32" && WINDOWS_SHELL_COMMANDS.has(command),
  });
}

function runCommand(command, args, { quiet = false } = {}) {
  const result = spawnCommand(command, args, quiet ? "ignore" : "inherit");
  if (result.error) throw result.error;
  return result.status;
}

function hasCommand(command) {
  const result = spawnCommand(command, ["--version"], "ignore");
  return !result.error && result.status === 0;
}

function stopOnCancel(prompt) {
  return async (options) => {
    const answer = await prompt(options);
    if (isCancel(answer)) throw new Error(CANCEL_MESSAGE);
    return answer;
  };
}

function createPrompts() {
  return {
    multiselect: stopOnCancel(multiselect),
    password: stopOnCancel(password),
    text: stopOnCancel(text),
  };
}

function askSteps(prompts) {
  return prompts.multiselect({
    message: "What do you want to set up?",
    options: STEPS.map(({ value, label, hint }) => ({ value, label, hint })),
    initialValues: DEFAULT_STEPS,
    required: true,
  });
}

async function main() {
  const requestedSteps = process.argv.slice(2);
  const prompts = process.stdin.isTTY ? createPrompts() : null;
  const hasUnknownStep = requestedSteps.some((step) => !STEP_NAMES.includes(step));
  if (hasUnknownStep || (requestedSteps.length === 0 && !prompts)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  intro("code-setup");
  const steps = requestedSteps.length > 0 ? requestedSteps : await askSteps(prompts);
  const home = os.homedir();
  const nvimDir = nvimConfigDir({
    platform: process.platform,
    home,
    localAppData: process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"),
  });
  await runSetup({ steps, home, nvimDir, repoDir: REPO_DIR, runCommand, hasCommand, prompts, output: console });
  outro("Done.");
}

const isEntryPoint =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
