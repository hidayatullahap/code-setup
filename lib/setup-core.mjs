import path from "node:path";

export const AGENTS_MARKER = "# code-setup AGENTS.md";
export const DEFAULT_GIT_EMAIL = "hidayatullahap@gmail.com";
export const DEFAULT_GIT_NAME = "Hidayatullah Agung Prasetyo";

export const DEFAULT_VISION_CONFIG = {
  provider: "opencode-go",
  model: "deepseek-v4-flash-vision-exp",
};

export const PI_CODING_AGENT_PACKAGE = "@earendil-works/pi-coding-agent";

export const PI_PACKAGES = [
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

const DEFAULT_STEPS = {
  webSearch: true,
  gitGlobal: true,
  gitLocal: false,
  piPackages: true,
  visionConfig: true,
  extensions: true,
  agentsMd: true,
  subagentsConfig: true,
  nvim: false,
};

const EMPTY_STEPS = {
  webSearch: false,
  gitGlobal: false,
  gitLocal: false,
  piPackages: false,
  visionConfig: false,
  extensions: false,
  agentsMd: false,
  subagentsConfig: false,
  nvim: false,
};

export function parseArgs(argv) {
  let showHelp = false;
  let unknownFlag = null;
  let sourceDir = "";
  let destDir = "";
  let hasExplicitStep = false;
  const selectedSteps = { ...EMPTY_STEPS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      showHelp = true;
    } else if (arg === "--from-clone" || arg === "--source") {
      sourceDir = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--dest") {
      destDir = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--extensions") {
      hasExplicitStep = true;
      selectedSteps.extensions = true;
    } else if (arg === "--web-search") {
      hasExplicitStep = true;
      selectedSteps.webSearch = true;
    } else if (arg === "--git-local") {
      hasExplicitStep = true;
      selectedSteps.gitLocal = true;
    } else if (arg === "--git-global") {
      hasExplicitStep = true;
      selectedSteps.gitGlobal = true;
    } else if (arg === "--nvim") {
      hasExplicitStep = true;
      selectedSteps.nvim = true;
    } else if (arg === "--all") {
      hasExplicitStep = true;
      Object.assign(selectedSteps, DEFAULT_STEPS, { nvim: true });
    } else {
      unknownFlag = arg;
      break;
    }
  }

  const steps = hasExplicitStep ? selectedSteps : { ...DEFAULT_STEPS };
  return { showHelp, unknownFlag, sourceDir, destDir, steps };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeJsonObjects(defaults, overrides) {
  const result = { ...defaults };
  for (const [key, overrideValue] of Object.entries(overrides)) {
    const defaultValue = result[key];
    if (isPlainObject(defaultValue) && isPlainObject(overrideValue)) {
      result[key] = mergeJsonObjects(defaultValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }
  return result;
}

export function appendAgentsMarkdown(existingContent, newContent, marker = AGENTS_MARKER) {
  if (existingContent.includes(marker)) {
    return { updated: false, content: existingContent };
  }
  const combined = `${existingContent}\n${marker}\n${newContent}`;
  return { updated: true, content: combined };
}

export function parseWebSearchSelection(choiceText, providers = WEB_SEARCH_PROVIDERS) {
  const trimmed = choiceText.trim();
  if (!trimmed) {
    return { skipped: false, selectedProviders: [], invalidTokens: [] };
  }
  if (trimmed.toLowerCase() === "a") {
    return { skipped: false, selectedProviders: [...providers], invalidTokens: [] };
  }

  const tokens = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const selectedProviders = [];
  const invalidTokens = [];

  for (const token of tokens) {
    if (token === "0") {
      return { skipped: true, selectedProviders: [], invalidTokens: [] };
    }
    const numberValue = Number.parseInt(token, 10);
    const index = numberValue - 1;
    if (String(numberValue) === token && index >= 0 && index < providers.length) {
      selectedProviders.push(providers[index]);
    } else {
      invalidTokens.push(token);
    }
  }

  return { skipped: false, selectedProviders, invalidTokens };
}

export function buildWebSearchConfig(providerEntries) {
  const result = {};
  for (const entry of providerEntries) {
    const trimmed = entry.value.trim();
    if (trimmed) {
      result[entry.jsonKey] = trimmed;
    }
  }
  return result;
}

export function resolveNvimConfigDir(platform, env, homeDir) {
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    return path.join(localAppData, "nvim");
  }
  const configBase = env.XDG_CONFIG_HOME || path.join(homeDir, ".config");
  return path.join(configBase, "nvim");
}

export function resolveSetupPaths(homeDir, sourceDir, customExtensionsDest = "") {
  const piDir = path.join(homeDir, ".pi");
  const agentDir = path.join(piDir, "agent");
  const extensionsDestDir = customExtensionsDest || path.join(agentDir, "extensions");
  return {
    piDir,
    agentDir,
    visionFile: path.join(agentDir, "vision.json"),
    agentsFile: path.join(agentDir, "AGENTS.md"),
    settingsFile: path.join(agentDir, "settings.json"),
    webSearchFile: path.join(piDir, "web-search.json"),
    extensionsDestDir,
    sourceAgentsFile: path.join(sourceDir, "AGENTS.md"),
    sourceSubagentsFile: path.join(sourceDir, "subagents.json"),
    sourceExtensionsDir: path.join(sourceDir, "extensions"),
  };
}
