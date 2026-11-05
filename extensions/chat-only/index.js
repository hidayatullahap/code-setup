/**
 * Chat-Only Extension – Lazy Tool Loading
 *
 * Starts every session with tools enabled (/tools default). Chat plus web
 * mode is opt-in via /chat: only web lookup tools stay active, tiny system
 * prompt, no Available tools / Guidelines context. Tools load by default;
 * /chat keeps web lookup only, /tools restores them.
 *
 * Default is tools-enabled per session. /chat enters chat plus web,
 * /tools restores the previous tool set.
 *
 * Place as:
 *   ~/.pi/agent/extensions/chat-only/index.js  (global)
 *   .pi/extensions/chat-only/index.js          (project-local)
 */

const CHAT_STATE_CUSTOM_TYPE = "chat-only-state";

// Tiny prompt used when in chat-only mode (entered manually via /chat). ~10 lines, no tool descriptions.
const TINY_CHAT_PROMPT = `You are pi, a helpful chat assistant.

You are currently in CHAT PLUS WEB mode. Web lookup (search and fetch) is available. File access, shell, and edits are off.

- Answer conversationally and helpfully. Use web lookup when the user asks about links, docs, or current info.
- Do NOT claim you can read local files, run commands, or edit code while in this mode.
- If the user asks to read files, run commands, edit code, or search the repo, explain you are in chat plus web mode and suggest they run /tools to enable full tools for this session.
- Keep replies concise unless the user asks for detail.`;

// Very conservative intent detection – false positives go to a confirm dialog.
const TOOL_INTENT_RE =
  /\b(read|open|show|edit|write|create|update|modify|run|execute|bash|grep|find|ls|list files|cat|apply patch|check the repo|look at|see the file)\b/i;
const FILE_PATH_RE =
  /(\.\/|\.\.\/|~\/|[a-z0-9_-]+\.(ts|js|tsx|jsx|json|md|py|rs|go|yaml|yml|toml|css|html)|\bpackage\.json\b|\bREADME\b)/i;

function looksLikeToolIntent(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Ignore slash commands – let command handlers run.
  if (trimmed.startsWith("/chat") || trimmed.startsWith("/tools")) return false;
  if (trimmed.startsWith("/")) return false;
  return TOOL_INTENT_RE.test(trimmed) || FILE_PATH_RE.test(trimmed);
}

export default function chatOnlyExtension(pi) {
  let chatModeEnabled = false;
  let toolsBeforeChat;

  function validToolNames(names) {
    const all = new Set(pi.getAllTools().map((t) => t.name));
    return names.filter((n) => all.has(n));
  }

  const WEB_TOOL_PATTERN = /(web|search|fetch|browser|http)/i;

  function webOnlyToolNames() {
    return validToolNames(
      pi
        .getAllTools()
        .filter((t) => WEB_TOOL_PATTERN.test(t.name))
        .map((t) => t.name),
    );
  }

  function chatToolNames() {
    const web = webOnlyToolNames();
    return web;
  }

  function persist() {
    pi.appendEntry(CHAT_STATE_CUSTOM_TYPE, {
      enabled: chatModeEnabled,
      toolsBeforeChat,
    });
  }

  function updateStatus(ctx) {
    if (chatModeEnabled) {
      ctx.ui.setStatus("chat-only", ctx.ui.theme.fg("accent", "💬 chat+web"));
      ctx.ui.setWidget("chat-only", [
        ctx.ui.theme.fg(
          "muted",
          "Chat + web – files and shell off. Run /tools to enable.",
        ),
      ]);
    } else {
      ctx.ui.setStatus("chat-only", undefined);
      ctx.ui.setWidget("chat-only", undefined);
    }
  }

  function enableChatMode(ctx) {
    if (chatModeEnabled) {
      ctx.ui.notify(
        "Already in chat plus web mode. Only web lookup loaded.",
        "info",
      );
      return;
    }
    toolsBeforeChat = [...pi.getActiveTools()];
    pi.setActiveTools(chatToolNames());
    chatModeEnabled = true;
    persist();
    updateStatus(ctx);
    ctx.ui.notify(
      "Chat plus web enabled. File, shell, and edit tools off. Run /tools to re-enable.",
      "info",
    );
  }

  function disableChatMode(ctx) {
    if (!chatModeEnabled) {
      ctx.ui.notify("Tools already enabled.", "info");
      return;
    }
    const toRestore = validToolNames(
      toolsBeforeChat ?? pi.getAllTools().map((t) => t.name),
    );
    // If snapshot is empty or invalid, fall back to current getAllTools.
    const effective =
      toRestore.length > 0
        ? toRestore
        : validToolNames(pi.getAllTools().map((t) => t.name));
    pi.setActiveTools(effective);
    chatModeEnabled = false;
    persist();
    updateStatus(ctx);
    ctx.ui.notify(
      `Tools enabled (${effective.length} tools). Chat-only off for this session. Run /chat to go back.`,
      "info",
    );
  }

  function restoreFromBranch(ctx) {
    const branch = ctx.sessionManager.getBranch();
    let last;
    for (const entry of branch) {
      const e = entry;
      if (e.type === "custom" && e.customType === CHAT_STATE_CUSTOM_TYPE) {
        last = e.data;
      }
    }
    if (last) {
      chatModeEnabled = last.enabled;
      toolsBeforeChat = last.toolsBeforeChat;
      // Re-apply tool state to match restored flag.
      if (chatModeEnabled) {
        if (!toolsBeforeChat) {
          toolsBeforeChat = [...pi.getActiveTools()];
        }
        pi.setActiveTools(chatToolNames());
      } else {
        const toRestore = validToolNames(
          last.toolsBeforeChat ?? pi.getAllTools().map((t) => t.name),
        );
        if (toRestore.length > 0) pi.setActiveTools(toRestore);
      }
      return true;
    }
    return false;
  }

  // ---- Commands ----
  pi.registerCommand("chat", {
    description: "Enter chat plus web mode (web lookup only, minimal prompt)",
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
    const reason = event.reason;

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

  pi.on("turn_start", async () => {
    if (chatModeEnabled) {
      const expected = chatToolNames();
      const active = pi.getActiveTools();
      const same =
        active.length === expected.length &&
        expected.every((n) => active.includes(n));
      if (!same) {
        pi.setActiveTools(expected);
      }
    }
  });

  // ---- System prompt override ----
  pi.on("before_agent_start", async (event, _ctx) => {
    if (!chatModeEnabled) return;

    // Respect user-provided --append-system-prompt if present.
    const append = event.systemPromptOptions?.appendSystemPrompt?.trim();
    const base = append
      ? `${TINY_CHAT_PROMPT}\n\nAdditional instructions:\n${append}`
      : TINY_CHAT_PROMPT;

    return { systemPrompt: base };
  });

  pi.on("context", async (event) => {
    if (!chatModeEnabled) return;
    const webIds = new Set();
    for (const m of event.messages) {
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
      for (const b of m.content) {
        if (b.type !== "toolCall") continue;
        const name = b.name ?? b.toolName ?? "";
        const id = b.id ?? b.toolCallId ?? b.toolCall?.id;
        if (id && WEB_TOOL_PATTERN.test(name)) webIds.add(id);
      }
    }
    const filtered = event.messages.filter((m) => {
      if (m.role === "toolResult") {
        const id = m.toolCallId ?? m.id ?? m.toolCall?.id;
        if (id && webIds.size > 0) return webIds.has(id);
        return true;
      }
      if (m.role === "assistant" && Array.isArray(m.content)) {
        const hasText = m.content.some(
          (b) => b.type === "text" && (b.text ?? "").trim(),
        );
        const webCalls = m.content.filter(
          (b) =>
            b.type === "toolCall" &&
            WEB_TOOL_PATTERN.test(b.name ?? b.toolName ?? ""),
        );
        const otherCalls = m.content.filter(
          (b) =>
            b.type === "toolCall" &&
            !WEB_TOOL_PATTERN.test(b.name ?? b.toolName ?? ""),
        );
        if (otherCalls.length > 0 && webCalls.length === 0 && !hasText)
          return false;
      }
      return true;
    });
    const cleaned = filtered
      .map((m) => {
        if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
        const kept = m.content.filter((b) => {
          if (b.type !== "toolCall") return true;
          return WEB_TOOL_PATTERN.test(b.name ?? b.toolName ?? "");
        });
        if (kept.length === m.content.length) return m;
        if (kept.length === 0) return null;
        return { ...m, content: kept };
      })
      .filter(Boolean);

    return { messages: cleaned };
  });

  // ---- Auto-detect intent -> prompt to enable ----
  pi.on("input", async (event, ctx) => {
    if (!chatModeEnabled) return { action: "continue" };
    if (!ctx.hasUI) return { action: "continue" };
    if (ctx.mode !== "tui") return { action: "continue" };
    // Avoid interrupting mid-stream.
    const streaming = event.streamingBehavior;
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
