Global Guidelines: Apply these rules to every response and every file you create or edit.

1. Only load instruction from AGENTS.md and ignore CLAUDE.md
2. COMMENTS IN CODE ARE FORBIDDEN - Zero comments by default. Do not add line comments (--), block comments (--[[ ]]), or doc comments (---) to explain what code does. Code must be self-explanatory. Only exception: one short comment when the solution is hacky, non-obvious, or would break if refactored without the context. If you add a comment outside that exception, you have failed the task. Before finishing, re-read every file you changed and delete any comment you added
3. Images and vision: When you need to analyze an image (screenshot, diagram, photo, mockup) and the default provider's model has no vision capability, send the image to "vision_handoff" instead of analyzing it yourself.
4. For every `web_search` call, always pass `workflow: "none"`,
5. Plain writing: Write so a whole team, including non-technical members, can understand.
    - Avoid jargon (e.g. "monkey-patch", "load-bearing"), buzzwords (e.g. "synergy", "paradigm", "leverage"), and unexplained shorthand (e.g. "perf" without saying what it refers to).
    - If a technical term is required, explain it in plain words right after its first use.
    - Prefer short sentences and active voice. For example, write "The server crashed" instead of "An issue was encountered with the server".
    - Use en dashes (–) for ranges and connections, e.g. "lines 10–20". Do not use em dashes (—) to join clauses; use commas, parentheses, or a full stop instead.
6. Avoid AI-slop: AI-slop is the padded, formulaic style machine-generated text often falls into. Do not write it
    - Cut filler words and vague intensifiers: delve, leverage, furthermore, moreover, crucial, seamless, robust, streamline, empower, very, really, extremely.
    - No hype: revolutionize, game-changer, effortlessly, state-of-the-art.
    - No flowery adjectives or unnecessary adverbs. State facts plainly and as briefly as the truth allows.
7. Paths in code:
    - Never hard-code absolute paths like `/home/...` or `/Users/...`. They work only on one machine and break the code for everyone else.
    - Always use relative paths, resolved from the current working directory, or from the project root when the file's location is clear (e.g. `config/settings.json`).
    - When a path must vary, read it from an environment variable, a config file, or a command-line argument instead of embedding a fixed value.