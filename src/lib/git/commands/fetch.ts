import type { CommandHandler, SimState } from "../types";
import { failure, get, has, isAncestor, success } from "../helpers";
import { msg } from "../messages";

/**
 * আসল Git-এর ref-আপডেট লাইন: " * [new branch]      main       -> origin/main"।
 * `note` পুরোটা দিতে হয়, কারণ push আর fetch-এ বন্ধনীর আগের ফাঁক আলাদা।
 */
export function refLine(flag: string, summary: string, from: string, to: string, width = 0, note = ""): string {
  return ` ${flag} ${summary.padEnd(17)} ${from.padEnd(width)} -> ${to}${note}`;
}

/**
 * remote-এর সব branch-এর খবর আনে: remote-tracking ref (`origin/...`) remote-এর এখনকার অবস্থায় যায়।
 * নিজের branch বা ফাইল বদলায় না। `git fetch` আর `git pull` দুটোই এটা ব্যবহার করে।
 */
export function fetchAll(state: SimState, extraLines: readonly string[] = []): { state: SimState; output: string; updated: string[] } {
  const repo = state.repo!;
  const remote = repo.remote!;
  const names = Object.keys(remote.branches).sort();
  const width = Math.max(10, ...names.map((n) => n.length));
  const lines: string[] = [];
  const updated: string[] = [];
  for (const name of names) {
    const now = remote.branches[name];
    const before = get(repo.tracking, name);
    if (before === now) continue;
    updated.push(name);
    const to = `${remote.name}/${name}`;
    if (before === undefined) lines.push(refLine("*", "[new branch]", name, to, width));
    else if (isAncestor(repo, before, now)) lines.push(refLine(" ", `${before}..${now}`, name, to, width));
    else lines.push(refLine("+", `${before}...${now}`, name, to, width, "  (forced update)"));
  }
  // Git 2.48 থেকে fetch নিজে origin/HEAD (remote-এর ডিফল্ট branch) বানায়, না থাকলে
  const head = remote.head ?? (has(remote.branches, "main") ? "main" : (names[0] ?? null));
  const next: SimState =
    updated.length || head !== remote.head
      ? { ...state, repo: { ...repo, remote: { ...remote, head }, tracking: { ...repo.tracking, ...remote.branches } } }
      : state;
  const all = [...extraLines, ...lines];
  return { state: next, output: all.length ? [`From ${remote.url}`, ...all].join("\n") : "", updated };
}

/** remote নেই বা নাম ভুল হলে আসল Git-এর এরর; ঠিক থাকলে null */
export function remoteError(state: SimState, name: string | undefined): ReturnType<CommandHandler> | null {
  const remote = state.repo!.remote;
  if (name !== undefined && remote?.name !== name) {
    return failure(
      state,
      `fatal: '${name}' does not appear to be a git repository\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.`,
      msg.remoteUnknown(name),
    );
  }
  return null;
}

/**
 * `git fetch [<remote>]`: remote-এ কী নতুন এসেছে তা আনে, কিন্তু নিজের কাজের সাথে মেলায় না।
 * সরলীকরণ: একটাই remote; `--prune`, `--all` ইত্যাদি নেই।
 */
export const fetch: CommandHandler = (state, args) => {
  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (args.length > 1) return failure(state, `error: unsupported in simulator: ${args[1]}`, msg.unsupportedOption(args[1]));
  if (!state.repo!.remote) return failure(state, NO_REMOTE_FETCH, msg.remoteNone);
  const bad = remoteError(state, args[0]);
  if (bad) return bad;
  const { state: next, output, updated } = fetchAll(state);
  return success(next, output, updated.length ? msg.fetchDone(updated, state.repo!.remote!.name) : msg.fetchNothing);
};

export const NO_REMOTE_FETCH =
  "fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.";
