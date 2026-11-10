import type { CommandHandler } from "../types";
import { failure, get, resolveRev, success, treeChanges } from "../helpers";
import { fileDiff } from "../diffFormat";
import { msg } from "../messages";
import { formatCommit } from "./log";

/**
 * `git show [<commit>]`: একটা commit-এর বিবরণ আর সে আগের commit থেকে কী বদলেছে (diff)।
 * সরলীকরণ: Date লাইন নেই; merge commit-এ আসল Git "combined diff" দেখায় (সাধারণ merge-এ যা খালি),
 * সিমুলেটর শুধু বিবরণ দেখায়; `git show <commit>:<file>` নেই।
 */
export const show: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (args.length > 1) return failure(state, `error: unsupported in simulator: ${args[1]}`, msg.showTooMany);
  const rev = args[0] ?? "HEAD";
  const id = resolveRev(repo, rev);
  if (!id) {
    if (rev === "HEAD") return failure(state, `fatal: your current branch '${repo.head}' does not have any commits yet`, msg.logNoCommits(repo.head));
    return failure(
      state,
      `fatal: ambiguous argument '${rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`,
      msg.showUnknown(rev),
    );
  }
  const c = repo.commits[id];
  const header = formatCommit(repo, c);
  if (c.parents.length > 1) return success(state, header, msg.showMerge(id));
  const before = c.parents[0] ? repo.commits[c.parents[0]].files : {};
  const diffs = treeChanges(before, c.files).map((ch) => fileDiff(ch.path, get(before, ch.path), get(c.files, ch.path)));
  return success(state, [header, "", ...diffs].join("\n").trimEnd(), msg.showShown(id));
};
