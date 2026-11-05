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
  { id: "openai", label: "OpenAI API Key  | sk-...", jsonKey: "openaiApiKey" },
  { id: "brave", label: "Brave API Key    | BSA_...", jsonKey: "braveApiKey" },
  { id: "exa", label: "Exa API Key      | exa-...", jsonKey: "exaApiKey" },
  { id: "tinyfish", label: "TinyFish API Key | sk-tinyfish-...", jsonKey: "tinyfishApiKey" },
  { id: "search1api", label: "Search1API Key   | ...", jsonKey: "search1apiApiKey" },
  { id: "searchinfinity", label: "SearchInfinity   | ...", jsonKey: "searchinfinityApiKey" },
  { id: "querit", label: "Querit API Key   | ...", jsonKey: "queritApiKey" },
  { id: "jina", label: "Jina API Key     | jina_...", jsonKey: "jinaApiKey" },
  { id: "bocha", label: "Bocha API Key    | sk-...", jsonKey: "bochaApiKey" },
  { id: "perplexity", label: "Perplexity Key   | pplx-...", jsonKey: "perplexityApiKey" },
  { id: "gemini", label: "Gemini API Key   | AIza...", jsonKey: "geminiApiKey" },
];

const SELECT_ALL_ANSWERS = ["a", "A"];
const SKIP_ANSWER = "0";
const YES_ANSWERS = ["y", "yes"];
const WHOLE_NUMBER = /^\d+$/;

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

export function parseKeySelection(choice, providers) {
  const trimmed = choice.trim();
  if (SELECT_ALL_ANSWERS.includes(trimmed)) return { skip: false, selected: [...providers], invalid: [] };
  if (trimmed === "") return { skip: true, selected: [], invalid: [] };

  const numbers = trimmed.split(",").map((part) => part.trim());
  if (numbers.includes(SKIP_ANSWER)) return { skip: true, selected: [], invalid: [] };

  const selected = [];
  const invalid = [];
  for (const number of numbers) {
    const provider = providers[Number(number) - 1];
    if (WHOLE_NUMBER.test(number) && provider) selected.push(provider);
    else invalid.push(number);
  }
  return { skip: false, selected, invalid };
}

export function buildWebSearchConfig(answers) {
  const config = {};
  for (const { provider, key } of answers) {
    const trimmedKey = key.trim();
    if (trimmedKey) config[provider.jsonKey] = trimmedKey;
  }
  return config;
}

export function isYes(answer) {
  return YES_ANSWERS.includes(answer.trim().toLowerCase());
}
