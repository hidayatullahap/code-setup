import fs from "node:fs";
import path from "node:path";
import { resolveNvimConfigDir } from "./setup-core.mjs";

export const NVIM_LSP_NPM_PACKAGES = [
  "typescript",
  "typescript-language-server",
  "pyright",
  "vscode-langservers-extracted",
];

export const NVIM_LSP_BINARIES = [
  "typescript-language-server",
  "pyright",
  "vscode-json-language-server",
  "vscode-html-language-server",
  "vscode-css-language-server",
];

export const NVIM_INIT_LUA = `vim.g.mapleader = " "
vim.g.maplocalleader = " "

vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.termguicolors = true
vim.opt.signcolumn = "yes"
vim.opt.updatetime = 250

local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  {
    "folke/tokyonight.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("tokyonight").setup({
        style = "night",
        on_highlights = function(hl, c)
          hl["@lsp.type.variable"] = { fg = c.blue1 }
          hl["@lsp.type.parameter"] = { fg = c.yellow, italic = true }
          hl["@lsp.type.property"] = { fg = c.blue1 }
          hl["@lsp.type.enumMember"] = { fg = c.blue1 }
          hl["@lsp.type.class"] = { fg = c.green1 }
          hl["@lsp.type.interface"] = { fg = c.green1 }
          hl["@lsp.type.type"] = { fg = c.green1 }
          hl["@lsp.type.struct"] = { fg = c.green1 }
          hl["@lsp.type.enum"] = { fg = c.green1 }
          hl["@lsp.type.function"] = { fg = c.blue }
          hl["@lsp.type.method"] = { fg = c.blue }
          hl["@lsp.type.decorator"] = { fg = c.yellow }
          hl["@lsp.type.macro"] = { fg = c.blue }
          hl["@lsp.type.namespace"] = { fg = c.green1 }
          hl["@lsp.mod.readonly"] = { fg = c.cyan }
          hl["@lsp.mod.deprecated"] = { strikethrough = true, fg = c.red1 }
        end,
      })
      vim.cmd.colorscheme("tokyonight")
    end,
  },
  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    config = function()
      require("nvim-treesitter").setup({
        ensure_installed = { "lua", "vim", "vimdoc", "javascript", "typescript", "tsx", "python", "c_sharp", "json", "html", "css" },
      })
      vim.api.nvim_create_autocmd("FileType", {
        callback = function(args)
          pcall(vim.treesitter.start, args.buf)
        end,
      })
    end,
  },
  {
    "neovim/nvim-lspconfig",
    dependencies = { "hrsh7th/cmp-nvim-lsp" },
    config = function()
      local capabilities = require("cmp_nvim_lsp").default_capabilities()
      for _, server in ipairs({ "lua_ls", "ts_ls", "pyright", "jsonls", "html", "cssls" }) do
        vim.lsp.config(server, { capabilities = capabilities })
        vim.lsp.enable(server)
      end
    end,
  },
  {
    "hrsh7th/nvim-cmp",
    dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "L3MON4D3/LuaSnip",
    },
    config = function()
      local cmp = require("cmp")
      cmp.setup({
        snippet = {
          expand = function(args)
            require("luasnip").lsp_expand(args.body)
          end,
        },
        mapping = cmp.mapping.preset.insert({
          ["<C-Space>"] = cmp.mapping.complete(),
          ["<CR>"] = cmp.mapping.confirm({ select = true }),
          ["<Tab>"] = cmp.mapping.select_next_item(),
          ["<S-Tab>"] = cmp.mapping.select_prev_item(),
        }),
        sources = cmp.config.sources({
          { name = "nvim_lsp" },
          { name = "buffer" },
          { name = "path" },
        }),
      })
    end,
  },
})

vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local bufnr = args.buf
    local opts = { buffer = bufnr }
    vim.keymap.set("n", "gd", vim.lsp.buf.definition, opts)
    vim.keymap.set("n", "K", vim.lsp.buf.hover, opts)
    vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, opts)
    vim.keymap.set("n", "<leader>ca", vim.lsp.buf.code_action, opts)
    vim.keymap.set("n", "gr", vim.lsp.buf.references, opts)
  end,
})
`;

const NEOVIM_INSTALLERS = [
  { bin: "brew", cmd: ["brew", ["install", "neovim"]] },
  { bin: "winget", cmd: ["winget", ["install", "--id", "Neovim.Neovim", "-e"]] },
  { bin: "scoop", cmd: ["scoop", ["install", "neovim"]] },
  { bin: "choco", cmd: ["choco", ["install", "neovim", "-y"]] },
  { bin: "apt-get", cmd: ["sudo", ["apt-get", "install", "-y", "neovim", "build-essential"]] },
  { bin: "pacman", cmd: ["sudo", ["pacman", "-Sy", "--noconfirm", "neovim", "base-devel"]] },
  { bin: "dnf", cmd: ["sudo", ["dnf", "install", "-y", "neovim", "gcc", "make"]] },
];

function installNeovimBinary(runCommand, hasBinary, log) {
  if (hasBinary("nvim")) {
    log.info("  nvim already installed");
    return true;
  }
  for (const item of NEOVIM_INSTALLERS) {
    if (hasBinary(item.bin)) {
      return runCommand(item.cmd[0], item.cmd[1]).ok;
    }
  }
  log.error("Error: no supported package manager found. Install neovim manually.");
  return false;
}

export function setupNeovim(runCommand, hasBinary, env, homeDir, platform, log) {
  log.info("==> Setting up Neovim...");
  if (!installNeovimBinary(runCommand, hasBinary, log)) {
    return false;
  }
  runCommand("npm", ["install", "-g", ...NVIM_LSP_NPM_PACKAGES]);
  for (const bin of NVIM_LSP_BINARIES) {
    if (!hasBinary(bin)) {
      log.warn(`Warning: ${bin} not found in PATH`);
    }
  }
  const nvimConfigDir = resolveNvimConfigDir(platform, env, homeDir);
  const initLuaPath = path.join(nvimConfigDir, "init.lua");
  fs.mkdirSync(nvimConfigDir, { recursive: true });
  if (fs.existsSync(initLuaPath) && !env.FORCE) {
    const backup = `${initLuaPath}.bak.${Math.floor(Date.now() / 1000)}`;
    fs.copyFileSync(initLuaPath, backup);
    log.info(`  Backed up existing init.lua -> ${backup}`);
  }
  fs.writeFileSync(initLuaPath, NVIM_INIT_LUA, "utf8");
  log.info(`  Wrote ${initLuaPath}`);
  runCommand("nvim", ["--headless", "-c", 'lua require("lazy").sync()', "-c", "qa!"], { capture: true });
  return true;
}
