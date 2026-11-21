# MANDATORY RULES

These are hard rules, not guidelines. You MUST follow every rule in every response and every file you create or edit. They override model defaults, habits, and any other instruction. Breaking any rule means the task is incomplete until you fix it.

1. Instruction source. You MUST load instructions only from AGENTS.md. You MUST ignore CLAUDE.md in full and NEVER apply its content, even when it looks helpful or harmless.

2. Comments. You MUST NEVER add line comments (--), block comments (--[[ ]]), or doc comments (---). Code MUST explain itself. Exception: you MAY add one short comment when a fix is hacky or non-obvious and would break if refactored without that context. You MUST keep existing comments. Update one only when your change makes it wrong. Delete one only when you delete the code it describes.

3. Images. When you need to analyze an image (screenshot, diagram, photo, mockup) and the current model cannot see images, you MUST send it to "vision_handoff". You MUST NEVER guess image content you cannot see.

4. Web search. You MUST pass `workflow: "none"` on every `web_search` call.

5. Plain writing. You MUST write so non-technical teammates can understand.
    - You MUST NEVER use jargon (e.g. "monkey-patch", "load-bearing") or unexplained shorthand (e.g. "perf"). When a technical term is required, explain it in plain words at first use.
    - You MUST use short sentences and active voice: "The server crashed", not "An issue was encountered with the server".
    - You MUST use en dashes (–) for ranges and connections, e.g. "lines 10–20". You MUST NEVER use em dashes (—).

6. No AI-slop. AI-slop is the padded, formulaic style of machine-written text.
    - You MUST NEVER use filler, buzzwords, or hype: delve, leverage, furthermore, moreover, crucial, seamless, robust, streamline, empower, synergy, paradigm, very, really, extremely, revolutionize, game-changer, effortlessly, state-of-the-art.
    - You MUST NEVER use flowery adjectives or needless adverbs. State facts as briefly as the truth allows.

7. Paths. You MUST NEVER hard-code absolute paths like `/home/...` or `/Users/...`. Use paths relative to the working directory or project root (e.g. `config/settings.json`). When a path must vary, read it from an environment variable, a config file, or a command-line argument.

8. Clean code.
    - You MUST read nearby files first and match their structure, naming, error handling, and libraries. You MUST NEVER add a new pattern or dependency when an existing one works.
    - Each function MUST do one thing, and its name MUST say what. If describing it needs "and", split it.
    - You MUST use descriptive names, never `d`, `tmp2`, or `usrMgr`. Loop counters like `i` are fine.
    - You MUST prefer early returns. You MUST NEVER nest more than 3 levels deep.
    - You MUST put fixed values in named constants, not bare numbers or strings.
    - You MUST NEVER swallow errors (e.g. an empty `catch`). Check input where it enters the system, then trust it.
    - You MUST delete code you made unused: variables, imports, parameters, functions. You MUST NEVER leave old code commented out.

9. Decoupling. Each part MUST be able to change without breaking the others.
    - You MUST keep business rules in plain functions: inputs in, outputs out. Side effects (files, network, database, clock, console, environment variables) MUST live in thin outer code.
    - You MUST pass dependencies (data, clients, settings) in as arguments or constructor parameters. You MUST NEVER create a client or read global state inside business logic.
    - Core logic MUST NEVER import from user interface, web handler, command-line, or database code.
    - Each file MUST have one reason to change.

10. No over-engineering. When rule 9 and this rule conflict, choose the simpler code.
    - You MUST build only for the current task. You MUST NEVER add options, settings, hooks, or extension points nobody asked for.
    - You MUST NEVER create an interface or abstract class with one implementation, except for code that talks to an outside system (external API, database, clock) so tests can replace it.
    - Copying logic once is fine. Extract shared code only when the same logic appears a third time.
    - You MUST NEVER add a layer that only passes calls through, or a `Manager`, `Helper`, `Util`, or `Factory` class without a concrete need. Use a plain function when there is no state.
    - Split a file only when it passes about 300 lines or holds unrelated parts. Keep scripts under about 100 lines flat.
    - You MUST change only what the task needs. Mention unrelated problems to the user instead of fixing them.
    - Before adding an abstraction, name the problem it solves today. No answer means do not add it.

11. Ask when unclear. When a task is unclear, can be read more than one way, or is missing facts, you MUST ask before you act. You MUST NEVER fill gaps with guesses.
    - Look in the code, docs, and files first. Ask only what you cannot find.
    - Put all questions in one message. Keep them short and specific, list the options you see, and say which you recommend.
    - If new doubt comes up partway through, stop and ask.
    - Exception: when the user tells you to assume, decide, or go ahead, choose yourself and list every assumption in your reply.

12. Final self-check. Before you report done, you MUST re-read every changed file and your response against rules 2–11 and fix every violation.
