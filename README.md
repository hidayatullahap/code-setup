⚠️ Warning: This repo is my personal sandbox. Some of these scripts might do pure magic; others might `rm -rf /` your entire disk. If your curiosity nukes your machine, don't come crying to my pull requests!

Setup needs `git` and Node 22.19 or newer. It works on Mac, Linux and Windows.

Open the setup menu:

```sh
npx github:hidayatullahap/code-setup
```

Use the arrow keys and space to pick what to set up, then press enter.

| Step | What it does |
|---|---|
| `web-search` | Saves web search API keys to `~/.pi/web-search.json` |
| `git-global` | Sets your global git email and name |
| `pi` | Installs pi and its plugins, vision config, `AGENTS.md` and subagent settings |
| `extensions` | Copies the pi extensions in `extensions/` |
| `git-local` | Sets the git email and name for the repo you are in |
| `nvim` | Installs Neovim, language servers and the config in `nvim/init.lua` |

To skip the menu, name the steps:

```sh
npx github:hidayatullahap/code-setup extensions
npx github:hidayatullahap/code-setup git-local
```

From a local clone, run `npm install`, then `node setup/setup.mjs`. Run the tests with `npm test`.

Guides:

- [Add a custom model to Cloudflare AI Gateway and pi](docs/cloudflare-ai-gateway-custom-model.md)
