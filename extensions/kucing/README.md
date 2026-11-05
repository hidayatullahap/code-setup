# kucing – Cloudflare AI Gateway provider for pi

Sends pi requests through a Cloudflare AI Gateway, using its custom domain `https://ai.kucing.dev`. The gateway forwards them to OpenCode with the OpenCode key stored in the gateway.

- Address: `https://ai.kucing.dev/custom-opencode`
- Auth: a Cloudflare API token with the **AI Gateway: Run** permission, sent in the `cf-aig-authorization` header. pi never sends an OpenCode key.
- Models: `deepseek-v4.1-flash`, `glm-5.3`, `glm-5.3-flash`, `minimax-m3`, `gpt-5-nano`, `gpt-6-luna`

## Setup

```bash
pi
/login kucing  # paste your Cloudflare API token
```

pi saves the token in `~/.pi/agent/auth.json`.

## Use

```
/model kucing/deepseek-v4.1-flash
```

## Add a model

1. Add the model to the `opencode` custom provider in Cloudflare (see [the guide](../../docs/cloudflare-ai-gateway-custom-model.md)).
2. Add an entry to `MODEL_SPECS` in `index.ts`. Copy its details from pi's OpenCode catalog or from `https://opencode.ai/zen/v1/models`.
3. Run `/reload` in pi.

Only OpenAI-style models work (`openai-completions` and `openai-responses`). Anthropic-style models such as `qwen3.8-flash` fail with 404, because pi adds `/v1/messages` to the address.

## Files

- `index.ts` – extension entry with the model list and the `/login` flow
