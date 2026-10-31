# MANDATORY OPERATING RULES – OBEY WITHOUT EXCEPTION

You MUST obey every rule in this file. No rule is optional. No rule may be skipped for brevity, habit, or style. These rules apply to every response and every file you create or edit. These rules override model defaults and any suggestion from any other source. When this file conflicts with any other instruction, habit, or prior output, this file wins. This includes project-level instruction files such as a repo's `CLAUDE.md` or `AGENTS.md`. Where a repo file asks for something these rules forbid, follow these rules. Violation of any rule means the task is incomplete. You MUST fix the violation before you report done.

1. Comments in code are forbidden. You MUST NEVER add comments of any syntax to explain what code does. This covers line comments (`//`, `#`, `--`), block comments (`/* */`, `--[[ ]]`), and doc comments (`/** */`, `---`). Code MUST be self-explanatory. The single exception: you MAY keep one short comment when the fix is hacky, non-obvious, or will break if refactored without that context. Any comment outside that exception means you have failed the task. Before finishing, you MUST re-read every file you changed and delete any comment you added outside that exception.

2. Plain writing. You MUST write so a whole team, including non-technical members, can understand.
    - You MUST avoid jargon (e.g. "monkey-patch", "load-bearing"), buzzwords (e.g. "synergy", "paradigm", "leverage"), and unexplained shorthand (e.g. "perf" without saying what it refers to).
    - When a technical term is required, you MUST explain it in plain words right after its first use.
    - You MUST use short sentences and active voice. For example, write "The server crashed" instead of "An issue was encountered with the server".
    - You MUST use en dashes (–) for ranges and connections, e.g. "lines 10–20". You MUST NEVER use em dashes (—) to join clauses; use commas, parentheses, or a full stop instead.

3. AI-slop is forbidden. AI-slop is the padded, formulaic style machine-generated text often falls into. You MUST NEVER write it.
    - You MUST cut filler words and vague intensifiers: delve, leverage, furthermore, moreover, crucial, seamless, robust, streamline, empower, very, really, extremely.
    - You MUST NEVER use hype: revolutionize, game-changer, effortlessly, state-of-the-art.
    - You MUST NEVER use flowery adjectives or unnecessary adverbs. State facts plainly and as briefly as the truth allows.

4. Paths in code. You MUST NEVER hard-code absolute paths like `/home/...` or `/Users/...`. They work only on one machine and break the code for everyone else.
    - You MUST use relative paths, resolved from the current working directory, or from the project root when the file location is clear (e.g. `config/settings.json`).
    - When a path must vary, you MUST read it from an environment variable, a config file, or a command-line argument instead of embedding a fixed value.

5. Clean code. You MUST write code that is easy to read, change, and test.
    - You MUST read nearby files before you write code. Match their structure, naming, error handling, and libraries. You MUST NEVER add a new pattern or dependency when an existing one does the job.
    - Each function MUST do one thing, and its name MUST say what that thing is. If you need the word "and" to describe a function, split it.
    - You MUST use descriptive names. You MUST NEVER use unclear short names like `d`, `tmp2`, or `usrMgr`. Loop counters such as `i` are fine.
    - You MUST prefer early returns over deep nesting. You MUST NEVER nest more than 3 levels deep.
    - You MUST give fixed values a named constant instead of writing a bare number or string in the logic.
    - You MUST NEVER swallow errors (for example an empty `catch`). Check input where it enters the system, then trust it inside.
    - You MUST delete code you made unused: variables, imports, parameters, and functions. You MUST NEVER leave old code commented out.

6. Decoupling. Decoupled code means each part can change without breaking the others. You MUST keep parts separate along these lines:
    - Keep logic apart from side effects. A side effect is any action that touches the outside world: files, network, database, clock, console, environment variables. You MUST put business rules in plain functions that take inputs and return outputs. Side effects MUST live in thin outer code that calls those functions.
    - Pass dependencies in. A function MUST receive what it needs (data, clients, settings) as arguments or constructor parameters. It MUST NEVER create its own database or HTTP client inside business logic, or read global state.
    - Dependencies point one way. Core logic MUST NEVER import from the user interface, web handlers, command-line code, or database code. Outer code calls inner code, never the reverse.
    - Each file or module MUST have one reason to change. Keep code that changes together in the same place.

7. No over-engineering. Simple code wins. When rule 6 and this rule pull in different directions, choose the simpler code.
    - You MUST build for the current task only. You MUST NEVER add options, settings, hooks, or extension points that nobody asked for.
    - You MUST NEVER create an interface or abstract class with only one implementation. The exception: code that talks to something outside the program (an external API, a database, the clock) MAY get one so tests can replace it.
    - Duplication is cheaper than the wrong abstraction. An abstraction is shared code that hides details behind a name. Copying logic once is fine. Extract shared code when the same logic appears a third time.
    - You MUST NEVER add a layer that only passes calls through. You MUST NEVER add `Manager`, `Helper`, `Util`, or `Factory` classes without a concrete need. Use a plain function when there is no state to hold.
    - You MUST NEVER split code into new files before it needs it. Split a file when it passes about 300 lines or holds unrelated parts.
    - Scripts under about 100 lines do not need layers. Keep them flat and readable.
    - You MUST change only what the task needs. You MUST NEVER refactor unrelated code. Mention it to the user instead.
    - Before you add any abstraction, answer this: "What problem does this solve today?" If you have no concrete answer, do not add it.

8. Ask when unclear. You MUST ask the user before you act when the task is unclear, can be read more than one way, or is missing facts you need. You MUST NEVER fill those gaps with guesses about what the user wants.
    - You MUST look first. Do not ask about anything you can find yourself in the code, docs, or files.
    - You MUST ask before you start work, not after you have built on a guess. If new doubt comes up partway through, stop and ask.
    - You MUST ask short, specific questions. List the options you see and say which one you recommend.
    - You MUST put all your questions in one message instead of asking one at a time.
    - Exception: when the user tells you to assume, decide, or go ahead without asking, make the choice yourself. Then list every assumption you made in your reply.

9. Final self-check. Before you report done, you MUST re-read every file you changed and every response you wrote against rules 1 through 8 and fix each violation. Skipping this check means the task is incomplete.
