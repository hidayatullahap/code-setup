#!/usr/bin/env bash
set -euo pipefail

NVIM_CONFIG_DIR="${HOME}/.config/nvim"
NVIM_DATA_DIR="${HOME}/.local/share/nvim"

echo "==> Checking dependencies..."
for cmd in git curl npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd is required but not found. Install it first." >&2
    exit 1
  fi
done

echo "==> Installing Neovim..."
if command -v nvim >/dev/null 2>&1; then
  echo "  nvim found: $(nvim --version | head -n1)"
else
  echo "  nvim not found, installing..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y neovim build-essential
  elif command -v brew >/dev/null 2>&1; then
    brew install neovim
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm neovim base-devel
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y neovim gcc make
  else
    echo "Error: no supported package manager found (apt, brew, pacman, dnf). Install neovim manually." >&2
    exit 1
  fi
  echo "  Installed: $(nvim --version | head -n1)"
fi

if ! command -v gcc >/dev/null 2>&1 && ! command -v cc >/dev/null 2>&1; then
  echo "  Warning: no C compiler found. Treesitter parsers need gcc/clang to compile." >&2
  echo "  Install build-essential (Debian/Ubuntu) or base-devel (Arch) for full Treesitter support." >&2
fi

echo "==> Installing language servers (npm)..."
npm install -g typescript typescript-language-server pyright vscode-langservers-extracted 2>&1 | tail -n 5
echo "  Language servers installed:"
for bin in typescript-language-server pyright vscode-json-language-server vscode-html-language-server vscode-css-language-server; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "    $bin -> $(command -v "$bin")"
  else
    echo "    $bin not found in PATH (check npm global bin: $(npm bin -g 2>/dev/null || echo 'unknown'))" >&2
  fi
done

echo "==> Creating Neovim config at $NVIM_CONFIG_DIR..."
mkdir -p "$NVIM_CONFIG_DIR"

if [ -f "$NVIM_CONFIG_DIR/init.lua" ] && [ -z "${FORCE:-}" ]; then
  BACKUP="$NVIM_CONFIG_DIR/init.lua.bak.$(date +%s)"
  cp "$NVIM_CONFIG_DIR/init.lua" "$BACKUP"
  echo "  Backed up existing init.lua -> $BACKUP"
fi

cat > "$NVIM_CONFIG_DIR/init.lua" <<'NVIM_EOF'
vim.g.mapleader = " "
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
NVIM_EOF

echo "  Wrote $NVIM_CONFIG_DIR/init.lua"

echo "==> Syncing plugins (lazy.nvim)..."
nvim --headless -c 'lua require("lazy").sync(); vim.wait(30000, function() return false end)' -c 'qa!' 2>&1 | tail -n 20 || true

echo ""
echo "==> Done."
echo "  Config: $NVIM_CONFIG_DIR/init.lua"
echo "  Theme: tokyonight (VS Code-like LSP semantic tokens)"
echo "  LSP: lua_ls, ts_ls, pyright, jsonls, html, cssls"
echo ""
echo "  Verify:"
echo "    nvim --version"
echo "    nvim some_file.ts  -> :LspInfo  -> :Inspect"
echo ""
echo "  To add more servers, edit init.lua and add to the server list, then restart nvim."
