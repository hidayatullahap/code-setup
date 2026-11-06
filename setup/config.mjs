export const AGENTS_MARKER = "# code-setup AGENTS.md";

export const DEFAULT_GIT_EMAIL = "hidayatullahap@gmail.com";
export const DEFAULT_GIT_NAME = "Hidayatullah Agung Prasetyo";

export const PI_PACKAGE = "@earendil-works/pi-coding-agent";

export const PI_PLUGINS = [
  "npm:pi-web-access",
  "npm:pi-mcp-adapter",
  "npm:@juicesharp/rpiv-ask-user-question",
  "npm:@janvitos/pi-plan-build",
  "npm:pi-lens",
  "npm:vision-handoff",
  "npm:pi-gmi-cloud",
  "npm:@aliou/pi-guardrails",
  "npm:pi-blackhole",
];

export const VISION_CONFIG = {
  provider: "opencode-go",
  model: "deepseek-v4-flash-vision-exp",
};

export const LEGACY_CHAT_ONLY_FILE = "chat-only.js";

export const WEB_SEARCH_PROVIDERS = [
  { label: "OpenAI", hint: "sk-...", jsonKey: "openaiApiKey" },
  { label: "Brave", hint: "BSA_...", jsonKey: "braveApiKey" },
  { label: "Exa", hint: "exa-...", jsonKey: "exaApiKey" },
  { label: "TinyFish", hint: "sk-tinyfish-...", jsonKey: "tinyfishApiKey" },
  { label: "Search1API", jsonKey: "search1apiApiKey" },
  { label: "SearchInfinity", jsonKey: "searchinfinityApiKey" },
  { label: "Querit", jsonKey: "queritApiKey" },
  { label: "Jina", hint: "jina_...", jsonKey: "jinaApiKey" },
  { label: "Bocha", hint: "sk-...", jsonKey: "bochaApiKey" },
  { label: "Perplexity", hint: "pplx-...", jsonKey: "perplexityApiKey" },
  { label: "Gemini", hint: "AIza...", jsonKey: "geminiApiKey" },
];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonObject(text) {
  try {
    const value = JSON.parse(text);
    return isPlainObject(value) ? value : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export function mergeSettings(defaults, userSettings) {
  const merged = { ...defaults };
  for (const [key, userValue] of Object.entries(userSettings)) {
    const bothObjects = isPlainObject(merged[key]) && isPlainObject(userValue);
    merged[key] = bothObjects ? mergeSettings(merged[key], userValue) : userValue;
  }
  return merged;
}

export function withAgentsSection(existingText, agentsText) {
  if (existingText.includes(AGENTS_MARKER)) return existingText;
  return `${existingText}\n${AGENTS_MARKER}\n${agentsText}`;
}

export function buildWebSearchConfig(answers) {
  const config = {};
  for (const { provider, key } of answers) {
    const trimmedKey = key.trim();
    if (trimmedKey) config[provider.jsonKey] = trimmedKey;
  }
  return config;
}

export function runRequired(runCommand, command, args) {
  const status = runCommand(command, args);
  if (status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${status}`);
}
