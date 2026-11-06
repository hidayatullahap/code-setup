import { DEFAULT_GIT_EMAIL, DEFAULT_GIT_NAME, runRequired } from "./config.mjs";

async function configureGitUser({ scope, prompts, runCommand, output }) {
  if (!prompts) {
    output.log(`Skipping git ${scope} config (non-interactive environment).`);
    return;
  }
  const email = await prompts.text({ message: "Git email", placeholder: DEFAULT_GIT_EMAIL, defaultValue: DEFAULT_GIT_EMAIL });
  const name = await prompts.text({ message: "Git name", placeholder: DEFAULT_GIT_NAME, defaultValue: DEFAULT_GIT_NAME });
  runRequired(runCommand, "git", ["config", `--${scope}`, "user.email", email]);
  runRequired(runCommand, "git", ["config", `--${scope}`, "user.name", name]);
  output.log(`Set git (${scope}) user.email=${email} and user.name=${name}`);
}

export async function configureGitGlobalUser({ prompts, runCommand, output }) {
  output.log("==> Configuring git global user...");
  await configureGitUser({ scope: "global", prompts, runCommand, output });
}

export async function configureGitLocalUser({ prompts, runCommand, output }) {
  const insideRepo = runCommand("git", ["rev-parse", "--is-inside-work-tree"], { quiet: true }) === 0;
  if (!insideRepo) throw new Error("not inside a git repository. Run this inside a repo (where .git exists).");
  output.log("==> Configuring git local user (repo-level)...");
  await configureGitUser({ scope: "local", prompts, runCommand, output });
}
