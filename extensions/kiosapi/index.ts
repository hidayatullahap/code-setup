/**
 * Kios API Custom Provider for pi
 * https://kiosapi.com/v1 – OpenAI-compatible
 *
 * POST /v1/chat/completions
 * GET  /v1/models
 * Auth: Bearer sk-...
 *
 * Usage:
 *   /login kiosapi   -> paste sk-...
 *   or export KIOS_API_KEY=sk-...
 *   /model kiosapi/Qwen/Qwen3-8B
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE_URL = "https://kiosapi.com/v1";

function getEnvKey(): string | undefined {
  return (
    process.env.KIOS_API_KEY ||
    process.env.KIOSAPI_API_KEY ||
    process.env.KILO_API_KEY ||
    process.env.KIOS_API_TOKEN ||
    undefined
  );
}

function getStoredKey(): string | undefined {
  try {
    const p = join(homedir(), ".pi", "agent", "auth.json");
    if (!existsSync(p)) return undefined;
    const j = JSON.parse(readFileSync(p, "utf-8"));
    return j?.kiosapi?.key?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function getAnyKey(): string | undefined {
  return getStoredKey() || getEnvKey();
}

type KiosModelEntry = {
  id: string;
  name?: string;
  display_name?: string;
};

async function fetchKiosModels(): Promise<KiosModelEntry[]> {
  const key = getAnyKey();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  const res = await fetch(`${BASE_URL}/models`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET /v1/models ${res.status} ${text.slice(0, 400)}`);
  }
  const payload = (await res.json()) as { data?: KiosModelEntry[] } | KiosModelEntry[];
  const list = Array.isArray(payload) ? payload : payload.data ?? [];
  return list;
}

function toModel(entry: KiosModelEntry) {
  const id = entry.id;
  const isReasoning = /qwen3|qwq|deepseek-r1|reasoning|thinking|nemotron|hy3|mimo|kimi|agnes/i.test(id);
  return {
    id,
    name: entry.display_name || entry.name || id,
    reasoning: isReasoning,
    input: ["text" as const, "image" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131072,
    maxTokens: 16384,
    compat: { supportsDeveloperRole: false },
  };
}

const FALLBACK = [
  {
    id: "Qwen/Qwen3-8B",
    name: "Qwen3 8B",
    reasoning: true,
    input: ["text" as const, "image" as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131072,
    maxTokens: 16384,
    compat: { supportsDeveloperRole: false },
  },
];

// apiKey via !command that reads stored key + env – supports /login and env
const API_KEY_CMD =
  "!node -e \"try{const fs=require('fs'),os=require('os'),path=require('path');let k='';try{k=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.pi','agent','auth.json'),'utf8')).kiosapi?.key||''}catch{};process.stdout.write((k||process.env.KIOS_API_KEY||process.env.KIOSAPI_API_KEY||process.env.KILO_API_KEY||process.env.KIOS_API_TOKEN||'').trim())}catch{process.stdout.write('')}\"";

export default async function (pi: ExtensionAPI) {
  let models: ReturnType<typeof toModel>[] = FALLBACK as any;

  if (getAnyKey()) {
    try {
      const entries = await fetchKiosModels();
      if (entries.length > 0) {
        models = entries.map(toModel);
        if (!models.some((m) => m.id === "Qwen/Qwen3-8B")) models.unshift(FALLBACK[0] as any);
      }
    } catch (e) {
      console.warn(`[kiosapi] /v1/models fetch failed (${e instanceof Error ? e.message : String(e)}) – using fallback`);
      models = FALLBACK as any;
    }
  }

  pi.registerProvider("kiosapi", {
    name: "Kios API",
    baseUrl: BASE_URL,
    apiKey: API_KEY_CMD,
    api: "openai-completions",
    models,
  } as any);

  pi.on("session_start", async () => {
    if (!getAnyKey()) return;
    try {
      const entries = await fetchKiosModels();
      if (entries.length === 0) return;
      const fresh = entries.map(toModel);
      if (!fresh.some((m) => m.id === "Qwen/Qwen3-8B")) fresh.unshift(FALLBACK[0] as any);
      pi.registerProvider("kiosapi", {
        name: "Kios API",
        baseUrl: BASE_URL,
        apiKey: API_KEY_CMD,
        api: "openai-completions",
        models: fresh,
      } as any);
    } catch {
      // keep fallback
    }
  });
}
