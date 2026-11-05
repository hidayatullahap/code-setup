# Add a custom model to Cloudflare AI Gateway and pi

This guide shows how to send requests for a model that Cloudflare does not list through your Cloudflare AI Gateway, and how to make that model show up in pi.

It has two parts:

1. **Cloudflare:** add the AI service as a custom provider, store its key, add the model, and test it.
2. **pi:** add the model to pi's model list and test it.

The example uses OpenCode as the service and `deepseek-v4.1-flash` as the model. The same steps work for any service that offers an OpenAI-style chat API (it accepts requests at `/chat/completions`).

## Terms

- **AI Gateway:** a Cloudflare service that sits between your app and AI services. It logs each request, can cache answers, and can add your stored API keys for you.
- **Custom provider:** an AI service you add to the gateway yourself because Cloudflare does not list it.
- **Stored provider key:** the AI service's API key, saved in the gateway. The gateway adds it to each request, so your apps do not need it.
- **Cloudflare API token:** a token from your Cloudflare account. When the gateway has authentication turned on, every request must send it in the `cf-aig-authorization` header.

## What you need

- The `cf` CLI, logged in with `cf auth login`.
- An AI Gateway. List yours with `cf ai-gateway gateways list`.
- An API key for the AI service (here, OpenCode).
- A Cloudflare API token with the **AI Gateway: Run** permission.
- pi, for part 2.

Replace these placeholders in every command:

| Placeholder | Meaning | Example |
|---|---|---|
| `<ACCOUNT_ID>` | Your Cloudflare account ID | `0123456789abcdef0123456789abcdef` |
| `<GATEWAY_ID>` | Your gateway name | `my-gateway` |
| `<PROVIDER_ID>` | The custom provider's ID, a long code that Cloudflare creates | `cfc44d45-...` |
| `<CF_TOKEN>` | Your Cloudflare API token | |

> **Dashboard notes:** each Cloudflare step also says how to do it in the Cloudflare website. I wrote and tested this guide with the `cf` CLI. The dashboard notes were not tested, so menu names may differ.

## Part 1: Cloudflare

### Step 1: Find the service's address and model ID

Most OpenAI-style services list their models at `<address>/models`:

```bash
curl -s https://opencode.ai/zen/v1/models | python3 -c 'import json,sys; print([m["id"] for m in json.load(sys.stdin)["data"] if "deepseek" in m["id"]])'
```

Write down the exact model ID (here, `deepseek-v4.1-flash`) and its prices per million tokens. OpenCode lists the prices in the same reply, under `cost`.

Check that the address accepts chat requests. Send one without a key:

```bash
curl -s -X POST https://opencode.ai/zen/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"deepseek-v4.1-flash","messages":[{"role":"user","content":"hi"}]}' \
  -w ' [%{http_code}]\n'
```

- **401 "Missing API key"** means the address is right. It only wants a key.
- **404** means the address is wrong.

OpenCode accepts chat requests at two addresses: `https://opencode.ai/zen/v1` and `https://opencode.ai/inference/openai/v1`. This guide uses `zen/v1`.

### Step 2: Add the custom provider

```bash
cf ai-gateway account-providers create \
  --name Opencode \
  --slug opencode \
  --base-url https://opencode.ai/zen/v1 \
  --enable
```

Get the provider's ID (`<PROVIDER_ID>`) from the `id` field:

```bash
cf ai-gateway account-providers list
```

If the provider already exists with a wrong address, fix it:

```bash
cf ai-gateway account-providers update <PROVIDER_ID> --base-url https://opencode.ai/zen/v1
```

Commands that take a provider ID need this long code. The slug (`opencode`) gives the error `[7001] Invalid uuid`.

The gateway serves the provider at `custom-<slug>`, here `custom-opencode`. To see the full address:

```bash
cf ai-gateway urls get custom-opencode --gateway-id <GATEWAY_ID>
```

**Dashboard:** open **AI Gateway**, find the custom providers settings, and add a provider with the same name, slug and address.

### Step 3: Store the service's API key in the gateway

The dashboard is the safer way here, because a key typed into a command stays in your shell history.

**Dashboard:** open your gateway, go to the provider keys settings, pick the `opencode` provider, and paste your OpenCode key.

**CLI:**

```bash
cf ai-gateway gateways providers create <GATEWAY_ID> \
  --provider-slug opencode \
  --alias default \
  --secret <OPENCODE_KEY>
```

Check that the key is stored. The key shows only its last few characters:

```bash
cf ai-gateway gateways providers list --gateway-id <GATEWAY_ID>
```

### Step 4: Add the model with its prices

Cloudflare builds a custom provider's model list from its price entries. A provider without price entries has no models in the dashboard.

```bash
cf ai-gateway account-providers costs create \
  --account-provider-id <PROVIDER_ID> \
  --model deepseek-v4.1-flash \
  --model-rule equals \
  --cost-type tokens \
  --cost-in 0.3 \
  --cost-out 1.2 \
  --token-pricing-input-tokens 0.3 \
  --token-pricing-output-tokens 1.2 \
  --token-pricing-input-cached-tokens 0.006 \
  --enable
```

- Prices are in US dollars per million tokens. Cloudflare saves `cost_in` and `cost_out` per single token, so the reply shows `3e-7` for `0.3`. That is expected.
- The `--token-pricing-...` options are required. Without them, Cloudflare returns `[7001] token_pricing object must be provided`.
- Cloudflare uses these prices only to show cost estimates in your logs. It does not bill you with them.

To see the models on a provider:

```bash
cf ai-gateway account-providers costs list --account-provider-id <PROVIDER_ID>
```

**Dashboard:** open the custom provider and add a model with the same ID and prices.

### Step 5: Test the model

Run this in your own terminal. Do not paste your token into a chat or a shared document.

```bash
curl https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_ID>/custom-opencode/chat/completions \
  -H "cf-aig-authorization: Bearer <CF_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"model":"deepseek-v4.1-flash","messages":[{"role":"user","content":"Say hello in one sentence."}]}'
```

The command does not send the OpenCode key. The gateway adds the stored key.

Check the result in the gateway logs:

```bash
cf ai-gateway logs list --gateway-id <GATEWAY_ID> --per-page 3 --order-by created_at --order-by-direction desc
```

A working request shows `"provider": "custom-opencode"`, `"status_code": 200`, and `"byok": "default"`. The `byok` field means the gateway used the stored key named `default`.

### Problems and fixes

| What you see | Cause | Fix |
|---|---|---|
| 404 from the service | Wrong address on the custom provider | Repeat step 1, then fix it with `account-providers update` |
| `[7001] Invalid uuid` | You passed the slug instead of the provider ID | Use the `id` from `account-providers list` |
| `[7001] token_pricing object must be provided` | Missing `--token-pricing-...` options | Add them as in step 4 |
| 401 "Missing API key" | The gateway did not add a key | Check step 3. The key must be stored for the same provider slug |
| 403 | The Cloudflare token lacks permission | Give the token the **AI Gateway: Run** permission |
| The model is missing from the dashboard list | The provider has no price entry for it | Do step 4 |

## Part 2: pi

pi gets its Cloudflare AI Gateway models from a fixed catalog that it downloads. That catalog has only Cloudflare's standard models, so your custom provider's models do not show up. You add them yourself in `~/.pi/agent/models.json`.

### Step 1: Log in to Cloudflare AI Gateway in pi

Start pi, run `/login` and pick **Cloudflare AI Gateway**. pi asks for:

1. your Cloudflare API token (`<CF_TOKEN>`),
2. your Cloudflare account ID,
3. your gateway ID.

pi saves these in `~/.pi/agent/auth.json`. It sends the token in the `cf-aig-authorization` header and never sends a service key, so the gateway adds the stored OpenCode key.

### Step 2: Add the model to `models.json`

Create `~/.pi/agent/models.json` with the content below. If the file already exists, add the model entry to the `models` list under `cloudflare-ai-gateway`.

```json
{
  "$schema": "https://pi.dev/schemas/models.schema.json",
  "providers": {
    "cloudflare-ai-gateway": {
      "models": [
        {
          "id": "deepseek-v4.1-flash",
          "name": "DeepSeek V4.1 Flash (OpenCode)",
          "api": "openai-completions",
          "baseUrl": "https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/custom-opencode",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cacheRead": 0.006,
            "cacheWrite": 0
          },
          "contextWindow": 1000000,
          "maxTokens": 384000,
          "thinkingLevelMap": {
            "minimal": null,
            "low": "low",
            "medium": null,
            "high": "high",
            "max": "max"
          },
          "compat": {
            "thinkingFormat": "openai",
            "supportsReasoningEffort": true,
            "requiresReasoningContentOnAssistantMessages": true,
            "supportsDeveloperRole": false,
            "supportsStore": false
          }
        }
      ]
    }
  }
}
```

What the fields mean:

| Field | Meaning |
|---|---|
| `cloudflare-ai-gateway` | pi's built-in Cloudflare AI Gateway provider. Adding the model here reuses your login from step 1. |
| `id` | The model ID sent to the service. It must match the ID from part 1. |
| `name` | The name shown in pi's model picker. |
| `api` | The request format. `openai-completions` means OpenAI-style chat requests. |
| `baseUrl` | The gateway address for the custom provider. Keep `{CLOUDFLARE_ACCOUNT_ID}` and `{CLOUDFLARE_GATEWAY_ID}` as written. pi fills them in from your login. |
| `cost` | Prices per million tokens. pi uses them to show cost estimates. |
| `contextWindow`, `maxTokens` | The most tokens the model reads and writes. Copy them from the service's model list. |
| `thinkingLevelMap` | The thinking levels pi offers. `null` hides a level. OpenCode lists `low`, `high` and `max` for this model. |
| `compat` | Small differences in how this service handles requests. These values were tested with this model. |

### Step 3: Check and test

```bash
pi --list-models deepseek
```

The list should show a `cloudflare-ai-gateway` row for `deepseek-v4.1-flash`. Then send one test message:

```bash
pi -p --no-session --no-tools --model cloudflare-ai-gateway/deepseek-v4.1-flash:high "Reply with exactly: hello from pi"
```

A reply of `hello from pi` means it works. The gateway logs from part 1, step 5 show the request with a `pi/...` user agent.

### Step 4: Use the model

In pi, run `/model` and search for "OpenCode" or "deepseek". Pick the row whose provider is `cloudflare-ai-gateway`.

If you also log in to OpenCode directly in pi, the `opencode` provider has a model with the same ID. Check the provider column before you pick.

### Notes

- **Other computers:** `models.json` affects only the computer it is on. Copy it to the same folder on each computer. On Windows, the folder is `%USERPROFILE%\.pi\agent\`.
- **More models:** repeat part 1, step 4 for each model, then add one entry per model to the `models` list.
- **Thinking levels:** only `high` was tested. If another level returns an error, set it to `null` in `thinkingLevelMap`.
