import type { CommandHandler, FileMap } from "../types";
import type { ConflictKind } from "../types";
import { allPaths, failure, get, has, headTree, setFile, success, unmergedPaths, withUnmerged } from "../helpers";
import { msg } from "../messages";

/**
 * `git restore <file>...`: ফাইলকে staging area-র অবস্থায় ফেরায় (commit না করা বদল বাদ)
 * `git restore --staged <file>...`: staging area-কে HEAD-এর অবস্থায় ফেরায় (unstage)
 * `--staged --worktree` একসাথে দিলে দুটোই, HEAD থেকে।
 * conflict চলা ফাইলে `--staged` দিলে ফাইলটা HEAD-এর অবস্থায় staged হয়ে মিটে যায়; শুধু `git restore <file>` আটকায়।
 * সরলীকরণ: `--source`, `-p` নেই।
 */
export const restore: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let staged = false;
  let worktree = false;
  const paths: string[] = [];
  for (const a of args) {
    if (a === "--staged" || a === "-S") staged = true;
    else if (a === "--worktree" || a === "-W") worktree = true;
    else if (a === "--") continue;
    else if (a.startsWith("-")) return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    else paths.push(a);
  }
  if (!staged) worktree = true;
  if (paths.length === 0) {
    return failure(state, "fatal: you must specify path(s) to restore", msg.restoreMissingArg);
  }

  const head = headTree(repo);
  const unmerged = new Set(unmergedPaths(repo));
  const all = paths.includes(".");
  // কোন ফাইলগুলো ছোঁয়া হবে: শুধু যেগুলো Git চেনে
  const known = (p: string) => (staged ? has(repo.index, p) || has(head, p) : has(repo.index, p));
  let targets: string[];
  if (all) {
    targets = allPaths(repo.index, head, state.workdir).filter(known);
  } else {
    for (const p of paths) {
      if (!known(p)) return failure(state, `error: pathspec '${p}' did not match any file(s) known to git`, msg.restoreNoMatch(p));
    }
    targets = paths;
  }
  // conflict চলা ফাইল: `--staged` দিলে HEAD-এর অবস্থায় staged হয়ে মিটে যায়; শুধু ফাইল ফেরানো যায় না (আসল Git-এর মতো)
  const blocked = staged ? undefined : targets.find((p) => unmerged.has(p));
  if (blocked) return failure(state, `error: path '${blocked}' is unmerged`, msg.restoreUnmerged(blocked));
  const stillUnmerged: Record<string, ConflictKind> = { ...(repo.merge?.unmerged ?? {}) };
  const resolved = staged ? targets.filter((p) => unmerged.has(p)) : [];
  for (const p of resolved) delete stillUnmerged[p];

  let index: FileMap = repo.index;
  let workdir: FileMap = state.workdir;
  const unstaged: string[] = [];
  const discarded: string[] = [];
  for (const p of targets) {
    if (staged && get(index, p) !== get(head, p)) {
      index = setFile(index, p, get(head, p));
      unstaged.push(p);
    }
    if (worktree) {
      // --staged থাকলে HEAD থেকে, নাহলে index থেকে
      const source = staged ? get(head, p) : get(index, p);
      if (get(workdir, p) !== source) {
        workdir = setFile(workdir, p, source);
        discarded.push(p);
      }
    }
  }

  if (!unstaged.length && !discarded.length && !resolved.length) return success(state, "", msg.restoreNothing);
  const explanation = [
    resolved.length ? msg.restoreResolved(resolved) : "",
    unstaged.length ? msg.restoreStaged(unstaged) : "",
    discarded.length ? msg.restoreWorktree(discarded) : "",
  ]
    .filter(Boolean)
    .join("\n");
  const merge = resolved.length ? withUnmerged(repo, stillUnmerged) : repo.merge;
  return success({ ...state, workdir, repo: { ...repo, index, merge } }, "", explanation);
};
