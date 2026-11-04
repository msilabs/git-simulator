import type { CommandHandler, Commit, Repo } from "../types";
import { ancestors, failure, headCommit, success } from "../helpers";
import { msg } from "../messages";

/** commit-এর পাশে "(HEAD -> main, feature)" লেবেল, আসল Git-এর মতো। */
export function decoration(repo: Repo, id: string): string {
  const names = Object.keys(repo.branches)
    .filter((b) => repo.branches[b] === id)
    .sort((a, b) => (a === repo.head ? -1 : b === repo.head ? 1 : a.localeCompare(b)))
    .map((b) => (b === repo.head ? `HEAD -> ${b}` : b));
  return names.length ? ` (${names.join(", ")})` : "";
}

/**
 * HEAD থেকে পৌঁছানো যায় এমন সব commit, নতুন থেকে পুরোনো ক্রমে।
 * আসল Git-ও ডিফল্টে commit-এর সময় দেখে উল্টো ক্রমে সাজায়।
 */
export function reachableCommits(repo: Repo): Commit[] {
  const head = headCommit(repo);
  if (!head) return [];
  return [...ancestors(repo, head.id)].map((id) => repo.commits[id]).sort((a, b) => b.time - a.time);
}

/**
 * `git log` আর `git log --oneline`
 * সরলীকরণ: id ৭ অক্ষরের (আসল Git পূর্ণ ৪০ অক্ষরের hash দেখায়), Author নির্দিষ্ট,
 * আর Date লাইন নেই, কারণ সিমুলেটরে শুধু ক্রমিক সময় আছে। পেজার (less) খোলে না।
 */
export const log: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const oneline = args.includes("--oneline");
  const other = args.find((a) => a !== "--oneline");
  if (other) return failure(state, `error: unsupported in simulator: ${other}`, msg.unsupportedOption(other));

  const commits = reachableCommits(repo);
  if (commits.length === 0) {
    return failure(
      state,
      `fatal: your current branch '${repo.head}' does not have any commits yet`,
      msg.logNoCommits(repo.head),
    );
  }

  const output = oneline
    ? commits.map((c) => `${c.id}${decoration(repo, c.id)} ${c.message.split("\n")[0]}`).join("\n")
    : commits
        .map((c) => {
          const lines = [`commit ${c.id}${decoration(repo, c.id)}`];
          if (c.parents.length > 1) lines.push(`Merge: ${c.parents.join(" ")}`);
          lines.push("Author: Learner <learner@example.com>", "");
          lines.push(...c.message.split("\n").map((l) => (l ? `    ${l}` : "")));
          return lines.join("\n");
        })
        .join("\n\n");

  return success(state, output, msg.logShown(commits.length, repo.head));
};
