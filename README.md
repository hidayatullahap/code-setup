# setup

Full install (pi, extensions, AGENTS.md, subagents, vision):

```sh
curl -fsSL https://raw.githubusercontent.com/hidayatullahap/code-setup/main/setup.sh | bash
```

Extensions only (re-install `chat-only` + `generate-design` without touching pi/packages):

```sh
# via standalone installer (local checkout)
./install-extensions.sh

# via curl
curl -fsSL https://raw.githubusercontent.com/hidayatullahap/code-setup/main/install-extensions.sh | bash

# or target a specific clone / dest
./install-extensions.sh --from-clone /tmp/code-setup-clone
./install-extensions.sh --source ./ --dest ~/.pi/agent/extensions
```

`setup.sh` will use `install-extensions.sh` from the clone when present, otherwise it falls back to an inline install.