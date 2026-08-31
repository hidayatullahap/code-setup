# kiosapi – Kios API provider for pi

OpenAI-compatible provider for `https://kiosapi.com/v1`.

- Endpoints: `POST /v1/chat/completions`, `GET /v1/models`
- Auth: `Authorization: Bearer sk-...`
- Model example: `Qwen/Qwen3-8B`

## Setup

```bash
# via login (stored in ~/.pi/agent/auth.json)
pi
/login kiosapi  # paste sk-...

# or via env
export KIOS_API_KEY="sk-..."
# also accepts KIOSAPI_API_KEY, KILO_API_KEY, KIOS_API_TOKEN
```

## Use

```
/model kiosapi/Qwen/Qwen3-8B
```

## Files

- `index.ts` – extension entry (auto-discovers models from /v1/models)
