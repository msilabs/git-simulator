import type { CommandHandler } from "../types";
import { failure, get, headCommit, isAncestor, success, unmergedPaths } from "../helpers";
import { msg } from "../messages";
import { fetchAll, NO_REMOTE_FETCH, refLine, remoteError } from "./fetch";
import { mergeRevision } from "./merge";

const noTracking = (branch: string, remote: string) =>
  [
    "There is no tracking information for the current branch.",
    "Please specify which branch you want to merge with.",
    "See git-pull(1) for details.",
    "",
    "    git pull <remote> <branch>",
    "",
    "If you wish to set tracking information for this branch you can do so with:",
    "",
    `    git branch --set-upstream-to=${remote}/<branch> ${branch}`,
  ].join("\n");

const DIVERGENT = [
  "hint: You have divergent branches and need to specify how to reconcile them.",
  "hint: You can do so by running one of the following commands sometime before",
  "hint: your next pull:",
  "hint:",
  "hint:   git config pull.rebase false  # merge",
  "hint:   git config pull.rebase true   # rebase",
  "hint:   git config pull.ff only       # fast-forward only",
  "hint:",
  'hint: You can replace "git config" with "git config --global" to set a default',
  "hint: preference for all repositories. You can also pass --rebase, --no-rebase,",
  "hint: or --ff-only on the command line to override the configured default per",
  "hint: invocation.",
  "fatal: Need to specify how to reconcile divergent branches.",
].join("\n");

/**
 * `git pull [--no-rebase | --ff-only] [<remote> [<branch>]]` = `git fetch` + `git merge`।
 * আসল Git-এর মতো: দুই দিকেই নতুন commit থাকলে (divergent) কীভাবে মেলাবেন তা আগে বলতে হয়:
 * `git config pull.rebase false` (merge) বা `--no-rebase`।
 * সরলীকরণ: rebase নেই, তাই `--rebase` / `pull.rebase true` চলে না।
 */
export const pull: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let mode: "merge" | "ff-only" | null = null;
  const words: string[] = [];
  for (const a of args) {
    if (a === "--no-rebase") mode = "merge";
    else if (a === "--ff-only") mode = "ff-only";
    else if (a === "--rebase" || a === "-r") return failure(state, "error: unsupported in simulator: --rebase", msg.pullRebaseUnsupported);
    else if (a.startsWith("-")) return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    else words.push(a);
  }
  if (words.length > 2) return failure(state, `error: unsupported in simulator: ${words[2]}`, msg.unsupportedOption(words[2]));
  const remote = repo.remote;
  if (!remote) return failure(state, NO_REMOTE_FETCH, msg.remoteNone);
  const bad = remoteError(state, words[0]);
  if (bad) return bad;
  if (unmergedPaths(repo).length) {
    return failure(
      state,
      "error: Pulling is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
      msg.mergeInProgressUnmerged,
    );
  }

  const branch = words[1] ?? get(repo.upstream, repo.head);
  if (branch === undefined) return failure(state, noTracking(repo.head, remote.name), msg.pullNoTracking(repo.head, remote.name));
  if (get(remote.branches, branch) === undefined) {
    return failure(state, `fatal: couldn't find remote ref ${branch}`, msg.pullNoRemoteBranch(branch, remote.name));
  }

  // `git pull origin main` লিখলে আসল Git আগে FETCH_HEAD-এর লাইনটাও দেখায়
  const width = Math.max(10, ...Object.keys(remote.branches).map((n) => n.length));
  const fetchHead = words[1] !== undefined ? [refLine("*", "branch", branch, "FETCH_HEAD", width)] : [];
  const fetched = fetchAll(state, fetchHead);
  const after = fetched.state;
  const theirs = after.repo!.tracking[branch];
  const ours = headCommit(after.repo!);
  const prefix = fetched.output ? `${fetched.output}\n` : "";

  if (ours && isAncestor(after.repo!, theirs, ours.id)) {
    return success(after, `${prefix}Already up to date.`, msg.pullUpToDate(`${remote.name}/${branch}`));
  }
  const fastForward = !ours || isAncestor(after.repo!, ours.id, theirs);
  if (!fastForward) {
    const configured = get(repo.config, "pull.ff") === "only" ? "ff-only" : get(repo.config, "pull.rebase") === "false" ? "merge" : null;
    const how = mode ?? configured;
    if (get(repo.config, "pull.rebase") === "true" && mode === null) {
      return failure(after, `${prefix}error: unsupported in simulator: pull.rebase true`, msg.pullRebaseUnsupported);
    }
    if (how === null) return failure(after, `${prefix}${DIVERGENT}`, msg.pullDivergent);
    if (how === "ff-only") {
      const hint = [
        "hint: Diverging branches can't be fast-forwarded, you need to either:",
        "hint:",
        "hint: \tgit merge --no-ff",
        "hint:",
        "hint: or:",
        "hint:",
        "hint: \tgit rebase",
        "hint:",
      ].join("\n");
      return failure(after, `${prefix}${hint}\nfatal: Not possible to fast-forward, aborting.`, msg.pullNotFastForward);
    }
  }

  const merged = mergeRevision(after, theirs, `${remote.name}/${branch}`, `Merge branch '${branch}' of ${remote.url}`, theirs);
  return { ...merged, output: prefix + merged.output, explanation: [msg.pullFetched(`${remote.name}/${branch}`), merged.explanation].join("\n") };
};
