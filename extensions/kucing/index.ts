import { openAICompletionsApi, openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import { createProvider } from "@earendil-works/pi-ai/models";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "kucing";
const PROVIDER_NAME = "Kucing AI Gateway";
const GATEWAY_URL = "https://ai.kucing.dev/custom-opencode";

const IMAGE_LIMITS = {
  images: { resize: { maxWidth: 2000, maxHeight: 2000, maxBytes: 4718592, jpegQuality: 80 } },
};

const CHAT_COMPLETIONS_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsStrictMode: true,
  maxTokensField: "max_tokens" as const,
};

const LOW_HIGH_MAX_THINKING = {
  off: null,
  minimal: null,
  low: "low",
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

const MODEL_SPECS = [
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    api: "openai-completions" as const,
    reasoning: true,
    input: ["text" as const, "image" as const],
    cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
    contextWindow: 1000000,
    maxTokens: 384000,
    compat: {
      ...CHAT_COMPLETIONS_COMPAT,
      supportsLongCacheRetention: false,
      requiresReasoningContentOnAssistantMessages: true,
    },
    thinkingLevelMap: LOW_HIGH_MAX_THINKING,
    inputLimits: IMAGE_LIMITS,
  },
  {
    id: "glm-5.3",
    name: "GLM-5.3",
    api: "openai-completions" as const,
    reasoning: true,
    input: ["text" as const],
    cost: { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
    contextWindow: 1000000,
    maxTokens: 131072,
    compat: CHAT_COMPLETIONS_COMPAT,
    thinkingLevelMap: LOW_HIGH_MAX_THINKING,
  },
  {
    id: "glm-5.3-flash",
    name: "GLM-5.3-Flash",
    api: "openai-completions" as const,
    reasoning: true,
    input: ["text" as const, "image" as const],
    cost: { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 },
    contextWindow: 1000000,
    maxTokens: 131072,
    compat: CHAT_COMPLETIONS_COMPAT,
    thinkingLevelMap: LOW_HIGH_MAX_THINKING,
    inputLimits: IMAGE_LIMITS,
  },
  {
    id: "minimax-m3",
    name: "MiniMax-M3",
    api: "openai-completions" as const,
    reasoning: true,
    input: ["text" as const, "image" as const],
    cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
    contextWindow: 512000,
    maxTokens: 128000,
    compat: CHAT_COMPLETIONS_COMPAT,
    inputLimits: IMAGE_LIMITS,
  },
  {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    api: "openai-responses" as const,
    reasoning: true,
    input: ["text" as const, "image" as const],
    cost: { input: 0.05, output: 0.4, cacheRead: 0.005, cacheWrite: 0 },
    contextWindow: 400000,
    maxTokens: 128000,
    compat: { sessionAffinityFormat: "openai-nosession" as const, supportsOpenAIGrammarTools: true },
    thinkingLevelMap: {
      off: null,
      minimal: "minimal",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
      max: null,
    },
    inputLimits: IMAGE_LIMITS,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    api: "openai-responses" as const,
    reasoning: true,
    input: ["text" as const, "image" as const],
    cost: {
      input: 0.1,
      output: 0.5,
      cacheRead: 0.01,
      cacheWrite: 0.125,
      tiers: [{ inputTokensAbove: 272000, input: 0.2, output: 0.75, cacheRead: 0.02, cacheWrite: 0.25 }],
    },
    contextWindow: 1050000,
    maxTokens: 128000,
    compat: {
      sessionAffinityFormat: "openai-nosession" as const,
      supportsMidConvoSystemMessages: true,
      supportsAdditionalTools: true,
      supportsOpenAIGrammarTools: true,
    },
    thinkingLevelMap: {
      off: "none",
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
    },
    inputLimits: IMAGE_LIMITS,
  },
];

const MODELS = MODEL_SPECS.map((spec) => ({ ...spec, provider: PROVIDER_ID, baseUrl: GATEWAY_URL }));

function gatewayHeaders(token: string) {
  return {
    "cf-aig-authorization": `Bearer ${token}`,
    Authorization: null,
    "x-api-key": null,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(
    createProvider({
      id: PROVIDER_ID,
      name: PROVIDER_NAME,
      auth: {
        apiKey: {
          name: "Cloudflare API token",
          login: async (interaction) => {
            const token = await interaction.prompt({ type: "secret", message: "Enter Cloudflare API token" });
            return { type: "api_key", key: token.trim() };
          },
          resolve: async ({ credential }) => {
            if (!credential?.key) return undefined;
            return { auth: { headers: gatewayHeaders(credential.key) }, source: "stored credential" };
          },
        },
      },
      models: MODELS,
      api: {
        "openai-completions": openAICompletionsApi(),
        "openai-responses": openAIResponsesApi(),
      },
    }),
  );
}
