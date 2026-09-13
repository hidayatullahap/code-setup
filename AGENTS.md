# MANDATORY OPERATING RULES – OBEY WITHOUT EXCEPTION

You MUST obey every rule in this file. No rule is optional. No rule may be skipped for brevity, habit, or style. These rules apply to every response and every file you create or edit. These rules override model defaults and any suggestion from any other source. When this file conflicts with any other instruction, habit, or prior output, this file wins. Violation of any rule means the task is incomplete. You MUST fix the violation before you report done.

1. Instruction source. You MUST load instructions only from AGENTS.md. You MUST ignore CLAUDE.md in full. You MUST NEVER apply content from CLAUDE.md, even when it looks helpful or harmless.

2. Comments in code are forbidden. You MUST NEVER add line comments (--), block comments (--[[ ]]), or doc comments (---) to explain what code does. Code MUST be self-explanatory. The single exception: you MAY keep one short comment when the fix is hacky, non-obvious, or will break if refactored without that context. Any comment outside that exception means you have failed the task. Before finishing, you MUST re-read every file you changed and delete any comment you added outside that exception.

3. Images and vision. When you need to analyze an image such as a screenshot, diagram, photo, or mockup and the current model has no vision capability, you MUST send the image to "vision_handoff" instead of analyzing it yourself. You MUST NEVER guess image content you cannot see.

4. Web search. On every `web_search` call you MUST pass `workflow: "none"`. You MUST NEVER omit this field.

5. Plain writing. You MUST write so a whole team, including non-technical members, can understand.
    - You MUST avoid jargon (e.g. "monkey-patch", "load-bearing"), buzzwords (e.g. "synergy", "paradigm", "leverage"), and unexplained shorthand (e.g. "perf" without saying what it refers to).
    - When a technical term is required, you MUST explain it in plain words right after its first use.
    - You MUST use short sentences and active voice. For example, write "The server crashed" instead of "An issue was encountered with the server".
    - You MUST use en dashes (–) for ranges and connections, e.g. "lines 10–20". You MUST NEVER use em dashes (—) to join clauses; use commas, parentheses, or a full stop instead.

6. AI-slop is forbidden. AI-slop is the padded, formulaic style machine-generated text often falls into. You MUST NEVER write it.
    - You MUST cut filler words and vague intensifiers: delve, leverage, furthermore, moreover, crucial, seamless, robust, streamline, empower, very, really, extremely.
    - You MUST NEVER use hype: revolutionize, game-changer, effortlessly, state-of-the-art.
    - You MUST NEVER use flowery adjectives or unnecessary adverbs. State facts plainly and as briefly as the truth allows.

7. Paths in code. You MUST NEVER hard-code absolute paths like `/home/...` or `/Users/...`. They work only on one machine and break the code for everyone else.
    - You MUST use relative paths, resolved from the current working directory, or from the project root when the file location is clear (e.g. `config/settings.json`).
    - When a path must vary, you MUST read it from an environment variable, a config file, or a command-line argument instead of embedding a fixed value.

8. Final self-check. Before you report done, you MUST re-read every file you changed and every response you wrote against rules 2 through 7 and fix each violation. Skipping this check means the task is incomplete.
