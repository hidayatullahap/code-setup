// Test fixture chat-only extension
// Test fixture chat-only line
/**
 * Chat-Only Extension – Lazy Tool Loading
 *
 * Starts every session with tools enabled (/tools default). Chat-only
 * mode is opt-in via /chat: zero active tools, tiny system prompt, no
 * Available tools / Guidelines context. Tools load by default; /chat
 * disables them, /tools restores them.
 *
 * Default is tools-enabled per session. /chat enters chat-only,
 * /tools restores the previous tool set.
 *
 * Place as:
 *   ~/.pi/agent/extensions/chat-only.ts  (global)
 *   .pi/extensions/chat-only.ts          (project-local)
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CHAT_STATE_CUSTOM_TYPE = "chat-only-state";

// Tiny prompt used when in chat-only mode (entered manually via /chat). ~10 lines, no tool descriptions.
const TINY_CHAT_PROMPT = `You are pi, a helpful chat assistant.

You are currently in CHAT-ONLY mode. You have NO tools available – no file access, no shell, no edits.

- Answer conversationally and helpfully from your own knowledge.
- Do NOT claim you can read files, run commands, browse, or edit code while in this mode.
- If the user asks to read files, run commands, edit code, search the repo, or do anything needing tools, explain you are in chat-only mode and suggest they run /tools to enable tools for this session.
- Keep replies concise unless the user asks for detail.`;

// Very conservative intent detection – false positives go to a confirm dialog.
const TOOL_INTENT_RE =
  /\b(read|open|show|edit|write|create|update|modify|run|execute|bash|grep|search|find|ls|list files|cat|apply patch|check the repo|look at|see the file)\b/i;
const FILE_PATH_RE = /(\.\/|\.\.\/|~\/|[a-z0-9_-]+\.(ts|js|tsx|jsx|json|md|py|rs|go|yaml|yml|toml|css|html)|\bpackage\.json\b|\bREADME\b)/i;

function looksLikeToolIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Ignore slash commands – let command handlers run.
  if (trimmed.startsWith("/chat") || trimmed.startsWith("/tools")) return false;
  if (trimmed.startsWith("/")) return false;
  return TOOL_INTENT_RE.test(trimmed) || FILE_PATH_RE.test(trimmed);
}

interface ChatOnlyState {
  enabled: boolean;
  toolsBeforeChat?: string[];
}

export default function chatOnlyExtension(pi: ExtensionAPI) {
  let chatModeEnabled = false;
  let toolsBeforeChat: string[] | undefined;

  function validToolNames(names: string[]): string[] {
    const all = new Set(pi.getAllTools().map((t) => t.name));
    return names.filter((n) => all.has(n));
  }

  function persist() {
    pi.appendEntry<ChatOnlyState>(CHAT_STATE_CUSTOM_TYPE, {
      enabled: chatModeEnabled,
      toolsBeforeChat,
    });
  }

  function updateStatus(ctx: ExtensionContext) {
    if (chatModeEnabled) {
      ctx.ui.setStatus("chat-only", ctx.ui.theme.fg("accent", "💬 chat"));
      ctx.ui.setWidget(
        "chat-only",
        [ctx.ui.theme.fg("muted", "Chat-only – no tools loaded. Run /tools to enable.")],
      );
    } else {
      ctx.ui.setStatus("chat-only", undefined);
      ctx.ui.setWidget("chat-only", undefined);
    }
  }

  function enableChatMode(ctx: ExtensionContext) {
    if (chatModeEnabled) {
      ctx.ui.notify("Already in chat-only mode. No tools loaded.", "info");
      return;
    }
    // Snapshot current tools before wiping.
    toolsBeforeChat = [...pi.getActiveTools()];
    pi.setActiveTools([]);
    chatModeEnabled = true;
    persist();
    updateStatus(ctx);
    ctx.ui.notify("Chat-only mode enabled. Tools disabled for this session. Run /tools to re-enable.", "info");
  }

  function disableChatMode(ctx: ExtensionContext) {
    if (!chatModeEnabled) {
      ctx.ui.notify("Tools already enabled.", "info");
      return;
    }
    const toRestore = validToolNames(
      toolsBeforeChat ?? pi.getAllTools().map((t) => t.name),
    );
    // If snapshot is empty or invalid, fall back to current getAllTools.
    const effective = toRestore.length > 0 ? toRestore : validToolNames(pi.getAllTools().map((t) => t.name));
    pi.setActiveTools(effective);
    chatModeEnabled = false;
    persist();
    updateStatus(ctx);
    ctx.ui.notify(`Tools enabled (${effective.length} tools). Chat-only off for this session. Run /chat to go back.`, "info");
  }

  function restoreFromBranch(ctx: ExtensionContext): boolean {
    const branch = ctx.sessionManager.getBranch();
    let last: ChatOnlyState | undefined;
    for (const entry of branch) {
      const e = entry as { type?: string; customType?: string; data?: unknown };
      if (e.type === "custom" && e.customType === CHAT_STATE_CUSTOM_TYPE) {
        last = e.data as ChatOnlyState | undefined;
      }
    }
    if (last) {
      chatModeEnabled = last.enabled;
      toolsBeforeChat = last.toolsBeforeChat;
      // Re-apply tool state to match restored flag.
      if (chatModeEnabled) {
        // Save current active if we have no snapshot yet.
        if (!toolsBeforeChat) {
          toolsBeforeChat = [...pi.getActiveTools()];
        }
        pi.setActiveTools([]);
      } else {
        const toRestore = validToolNames(last.toolsBeforeChat ?? pi.getAllTools().map((t) => t.name));
        if (toRestore.length > 0) pi.setActiveTools(toRestore);
      }
      return true;
    }
    return false;
  }

  // ---- Commands ----
  pi.registerCommand("chat", {
    description: "Enter chat-only mode (disable all tools, minimal prompt)",
    handler: async (_args, ctx) => {
      enableChatMode(ctx);
    },
  });

  pi.registerCommand("tools", {
    description: "Enable tools for this session (leave chat-only mode)",
    handler: async (_args, ctx) => {
      disableChatMode(ctx);
    },
  });

  // ---- Lifecycle ----

  pi.on("session_start", async (event, ctx) => {
    const reason = (event as { reason?: string }).reason;

    if (reason === "startup" || reason === "new") {
      // Every new session defaults to tools enabled.
      chatModeEnabled = false;
      if (pi.getActiveTools().length === 0) {
        const all = validToolNames(pi.getAllTools().map((t) => t.name));
        if (all.length > 0) pi.setActiveTools(all);
      }
      persist();
      updateStatus(ctx);
      return;
    }

    // resume / reload / fork – try to restore persisted toggle.
    const restored = restoreFromBranch(ctx);
    if (!restored) {
      // No prior state – default to tools enabled. Ensure tools are on.
      chatModeEnabled = false;
      if (pi.getActiveTools().length === 0) {
        const all = validToolNames(pi.getAllTools().map((t) => t.name));
        if (all.length > 0) pi.setActiveTools(all);
      }
      // Don't persist yet – wait for explicit toggle to avoid spamming old sessions.
    }
    updateStatus(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreFromBranch(ctx);
    updateStatus(ctx);
  });

  // Keep status in sync if something else changes tools externally.
  pi.on("turn_start", async () => {
    // Persist so reload keeps the correct branch state.
    // Only persist after initial setup to avoid duplicate entries on every turn when unchanged.
    // We check last entry to dedupe is handled by appendEntry branching anyway.
    if (chatModeEnabled) {
      // Ensure we stay with no tools if something re-enabled.
      if (pi.getActiveTools().length !== 0) {
        pi.setActiveTools([]);
      }
    }
  });

  // ---- System prompt override ----
  pi.on("before_agent_start", async (event, _ctx) => {
    if (!chatModeEnabled) return;

    // Respect user-provided --append-system-prompt if present.
    const append = event.systemPromptOptions?.appendSystemPrompt?.trim();
    const base = append ? `${TINY_CHAT_PROMPT}\n\nAdditional instructions:\n${append}` : TINY_CHAT_PROMPT;

    return { systemPrompt: base };
  });

  // ---- Context filtering (save tokens on history) ----
  pi.on("context", async (event) => {
    if (!chatModeEnabled) return;
    // Strip historic tool artifacts when in chat-only – keep only user/assistant/custom text.
    const filtered = event.messages.filter((m) => {
      const role = (m as { role?: string }).role;
      if (role === "toolResult") return false;
      // Assistant toolCall blocks are inside assistant messages; we keep the message
      // but could strip toolCall content if needed. For minimal cost, drop assistant
      // messages that are purely tool calls without text.
      if (role === "assistant") {
        const content = (m as { content?: unknown }).content;
        if (Array.isArray(content)) {
          const hasText = content.some(
            (b) => (b as { type?: string })?.type === "text" && ((b as { text?: string }).text ?? "").trim(),
          );
          const hasOnlyToolCalls =
            content.length > 0 && content.every((b) => (b as { type?: string })?.type === "toolCall");
          if (hasOnlyToolCalls && !hasText) return false;
        }
      }
      return true;
    });
    // Also strip toolCalls from remaining assistant content arrays to avoid sending stale schemas.
    const cleaned = filtered.map((m) => {
      if ((m as { role?: string }).role !== "assistant") return m;
      const content = (m as { content?: unknown[] }).content;
      if (!Array.isArray(content)) return m;
      const withoutToolCalls = content.filter((b) => (b as { type?: string })?.type !== "toolCall");
      if (withoutToolCalls.length === content.length) return m;
      // If we removed everything, drop the message (already filtered, but guard).
      if (withoutToolCalls.length === 0) return null;
      return { ...(m as object), content: withoutToolCalls } as typeof m;
    }).filter(Boolean) as typeof event.messages;

    return { messages: cleaned };
  });

  // ---- Auto-detect intent -> prompt to enable ----
  pi.on("input", async (event, ctx) => {
    if (!chatModeEnabled) return { action: "continue" };
    if (!ctx.hasUI) return { action: "continue" };
    if (ctx.mode !== "tui") return { action: "continue" };
    // Avoid interrupting mid-stream.
    const streaming = (event as { streamingBehavior?: string }).streamingBehavior;
    if (streaming) return { action: "continue" };

    const text = event.text ?? "";
    if (!looksLikeToolIntent(text)) return { action: "continue" };

    const ok = await ctx.ui.confirm(
      "Enable tools?",
      "Your message looks like it needs file or shell access (e.g. reading a file, running a command).\nEnable tools for this session?",
    );
    if (ok) {
      disableChatMode(ctx);
    }
    return { action: "continue" };
  });
}
