import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { NVIM_INSTALLERS, nvimConfigDir } from "../setup/nvim.mjs";
import { runSetup } from "../setup/setup.mjs";

const REPO_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_CONFIG = fs.readFileSync(path.join(REPO_DIR, "nvim", "init.lua"), "utf8");

function createTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "code-setup-nvim-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function createFakes({ installed = ["git", "nvim", "gcc"], statusFor = () => 0 } = {}) {
  const commands = [];
  const lines = [];
  return {
    commands,
    lines,
    runCommand: (command, args) => {
      commands.push([command, ...args].join(" "));
      return statusFor(command, args);
    },
    hasCommand: (command) => installed.includes(command),
    prompts: null,
    output: { log: (line) => lines.push(line), warn: (line) => lines.push(line) },
  };
}

function createNvimSetup(t, fakes) {
  const home = createTempDir(t);
  const nvimDir = path.join(home, "nvim");
  return {
    configPath: path.join(nvimDir, "init.lua"),
    run: () => runSetup({ steps: ["nvim"], home, nvimDir, repoDir: REPO_DIR, ...fakes }),
  };
}

test("nvimConfigDir uses LOCALAPPDATA on Windows and ~/.config elsewhere", () => {
  const home = path.join("home", "me");
  const localAppData = path.join("C:", "AppData", "Local");
  assert.equal(nvimConfigDir({ platform: "win32", home, localAppData }), path.join(localAppData, "nvim"));
  assert.equal(nvimConfigDir({ platform: "darwin", home, localAppData }), path.join(home, ".config", "nvim"));
});

test("nvim step installs language servers, writes config and syncs plugins", async (t) => {
  const fakes = createFakes();
  const { run, configPath } = createNvimSetup(t, fakes);
  await run();

  assert.equal(fs.readFileSync(configPath, "utf8"), REPO_CONFIG);
  assert.ok(fakes.commands.some((command) => command.startsWith("npm install -g typescript")));
  assert.ok(fakes.commands.some((command) => command.startsWith("nvim --headless")));
  assert.equal(fakes.commands.some((command) => command.includes("install neovim")), false);
});

test("nvim step installs Neovim with the first package manager it finds", async (t) => {
  const fakes = createFakes({ installed: ["git", "gcc", "winget"] });
  const { run } = createNvimSetup(t, fakes);
  await run();

  const winget = NVIM_INSTALLERS.find(({ manager }) => manager === "winget");
  assert.ok(fakes.commands.includes(winget.commands[0].join(" ")));
  assert.ok(fakes.lines.some((line) => line.includes("nvim is not on PATH yet")));
});

test("nvim step fails when no package manager is found", async (t) => {
  const fakes = createFakes({ installed: ["git"] });
  const { run, configPath } = createNvimSetup(t, fakes);

  await assert.rejects(run(), /no supported package manager found/);
  assert.equal(fs.existsSync(configPath), false);
});

test("nvim step fails without git", async (t) => {
  const fakes = createFakes({ installed: ["nvim"] });
  const { run } = createNvimSetup(t, fakes);

  await assert.rejects(run(), /git is required/);
  assert.deepEqual(fakes.commands, []);
});

test("nvim step backs up a different init.lua and skips an identical one", async (t) => {
  const fakes = createFakes();
  const { run, configPath } = createNvimSetup(t, fakes);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, "old config");

  await run();
  await run();

  const backups = fs.readdirSync(path.dirname(configPath)).filter((name) => name.startsWith("init.lua.bak."));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(configPath, "utf8"), REPO_CONFIG);
  assert.ok(fakes.lines.includes("  init.lua is already up to date"));
});

test("nvim step warns when there is no C compiler or plugin sync fails", async (t) => {
  const fakes = createFakes({ installed: ["git", "nvim"], statusFor: (command) => (command === "nvim" ? 1 : 0) });
  const { run } = createNvimSetup(t, fakes);
  await run();

  assert.ok(fakes.lines.some((line) => line.includes("no C compiler found")));
  assert.ok(fakes.lines.some((line) => line.includes("Plugin sync did not finish")));
});
