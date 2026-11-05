⚠️ Warning: This repo is my personal sandbox. Some of these bash scripts might do pure magic; others might `rm -rf /` your entire disk. If your curiosity nukes your machine, don't come crying to my pull requests!

Setup needs `git` and Node 22.19 or newer.

Full setup:

```sh
curl -fsSL https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.ps1 | iex
```

Install extensions only:

```sh
curl -fsSL https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.sh | sh -s -- extensions
```

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.ps1))) extensions
```

Set the git user for the current repo (run inside the repo):

```sh
curl -fsSL https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.sh | sh -s -- git-local
```

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.ps1))) git-local
```

From a local clone, run `node setup/setup.mjs [extensions | git-local]`. Run the tests with `node --test test/setup.test.mjs`.

Guides:

- [Add a custom model to Cloudflare AI Gateway and pi](docs/cloudflare-ai-gateway-custom-model.md)
