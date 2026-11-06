import fs from "node:fs";
import path from "node:path";
import { runRequired } from "./config.mjs";

const WINDOWS_PLATFORM = "win32";
const CONFIG_FILE = "init.lua";
const LANGUAGE_SERVERS = ["typescript", "typescript-language-server", "pyright", "vscode-langservers-extracted"];
const LSP_NAMES = "lua_ls, ts_ls, pyright, jsonls, html, cssls";
const C_COMPILERS = ["gcc", "cc"];
const PLUGIN_SYNC_ARGS = [
  "--headless",
  "-c",
  'lua require("lazy").sync(); vim.wait(30000, function() return false end)',
  "-c",
  "qa!",
];

export const NVIM_INSTALLERS = [
  {
    manager: "apt-get",
    commands: [
      ["sudo", "apt-get", "update"],
      ["sudo", "apt-get", "install", "-y", "neovim", "build-essential"],
    ],
  },
  { manager: "brew", commands: [["brew", "install", "neovim"]] },
  { manager: "pacman", commands: [["sudo", "pacman", "-Sy", "--noconfirm", "neovim", "base-devel"]] },
  { manager: "dnf", commands: [["sudo", "dnf", "install", "-y", "neovim", "gcc", "make"]] },
  {
    manager: "winget",
    commands: [
      ["winget", "install", "--id", "Neovim.Neovim", "--exact", "--accept-source-agreements", "--accept-package-agreements"],
    ],
  },
];

export function nvimConfigDir({ platform, home, localAppData }) {
  if (platform === WINDOWS_PLATFORM) return path.join(localAppData, "nvim");
  return path.join(home, ".config", "nvim");
}

function installNeovim({ runCommand, hasCommand, output }) {
  output.log("==> Installing Neovim...");
  if (hasCommand("nvim")) {
    output.log("  nvim found, skipping install");
    return;
  }
  const installer = NVIM_INSTALLERS.find(({ manager }) => hasCommand(manager));
  if (!installer) {
    const managers = NVIM_INSTALLERS.map(({ manager }) => manager).join(", ");
    throw new Error(`no supported package manager found (${managers}). Install Neovim manually.`);
  }
  for (const [command, ...args] of installer.commands) runRequired(runCommand, command, args);
}

function warnIfNoCCompiler({ hasCommand, output }) {
  if (C_COMPILERS.some((compiler) => hasCommand(compiler))) return;
  output.warn("  Warning: no C compiler found. Treesitter parsers need gcc or clang to compile.");
}

function installLanguageServers({ runCommand, output }) {
  output.log("==> Installing language servers (npm)...");
  runRequired(runCommand, "npm", ["install", "-g", ...LANGUAGE_SERVERS]);
}

function writeNvimConfig({ repoDir, configDir, output }) {
  output.log(`==> Writing Neovim config to ${configDir}...`);
  const configText = fs.readFileSync(path.join(repoDir, "nvim", CONFIG_FILE), "utf8");
  const targetPath = path.join(configDir, CONFIG_FILE);
  fs.mkdirSync(configDir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    if (fs.readFileSync(targetPath, "utf8") === configText) {
      output.log(`  ${CONFIG_FILE} is already up to date`);
      return;
    }
    const backupPath = `${targetPath}.bak.${Date.now()}`;
    fs.copyFileSync(targetPath, backupPath);
    output.log(`  Backed up existing ${CONFIG_FILE} -> ${backupPath}`);
  }
  fs.writeFileSync(targetPath, configText);
  output.log(`  Wrote ${targetPath}`);
}

function syncNvimPlugins({ runCommand, hasCommand, output }) {
  output.log("==> Syncing plugins (lazy.nvim)...");
  if (!hasCommand("nvim")) {
    output.warn("  nvim is not on PATH yet. Open a new terminal and run nvim once to install the plugins.");
    return;
  }
  if (runCommand("nvim", PLUGIN_SYNC_ARGS) !== 0) {
    output.warn("  Plugin sync did not finish. Run nvim once to complete it.");
  }
}

export function installNvim({ repoDir, nvimDir, runCommand, hasCommand, output }) {
  if (!hasCommand("git")) throw new Error("git is required for Neovim plugins. Install it first.");
  installNeovim({ runCommand, hasCommand, output });
  warnIfNoCCompiler({ hasCommand, output });
  installLanguageServers({ runCommand, output });
  writeNvimConfig({ repoDir, configDir: nvimDir, output });
  syncNvimPlugins({ runCommand, hasCommand, output });
  output.log(`  Config: ${path.join(nvimDir, CONFIG_FILE)}`);
  output.log(`  LSP: ${LSP_NAMES}`);
  output.log("  Check it with: nvim some_file.ts, then :LspInfo");
}
