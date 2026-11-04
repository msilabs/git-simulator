import type { CommandHandler } from "../types";
import { allPaths, failure, headTree, success, unmergedPaths } from "../helpers";
import { fileDiff } from "../diffFormat";
import { msg } from "../messages";

/**
 * `git diff [<file>...]`: working directory বনাম staging area (staged নয় এমন বদল)
 * `git diff --staged|--cached [<file>...]`: staging area বনাম HEAD (পরের commit-এ যা যাবে)
 * untracked ফাইল দেখায় না, আসল Git-এর মতো।
 * সরলীকরণ: commit/branch তুলনা (`git diff main feature`) নেই; conflict চলাকালীন আসল Git
 * "combined diff" (diff --cc) দেখায়, আমরা সাধারণ diff দেখাই (index-এ থাকা আমাদের সংস্করণ বনাম ফাইল)।
 * রঙ ছাড়া কোনো পেজার নেই।
 */
export const diff: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let staged = false;
  const paths: string[] = [];
  for (const a of args) {
    if (a === "--staged" || a === "--cached") staged = true;
    else if (a === "--") continue;
    else if (a.startsWith("-")) return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    else paths.push(a);
  }

  const head = headTree(repo);
  for (const p of paths) {
    if (p === "HEAD" || p in repo.branches || p in repo.commits) {
      return failure(state, `error: unsupported in simulator: git diff ${p}`, msg.diffRevisionUnsupported(p));
    }
    if (!(p in state.workdir) && !(p in repo.index) && !(p in head)) {
      return failure(
        state,
        `fatal: ambiguous argument '${p}': unknown revision or path not in the working tree.`,
        msg.diffUnknownPath(p),
      );
    }
  }

  const unmerged = new Set(unmergedPaths(repo));
  const [from, to] = staged ? [head, repo.index] : [repo.index, state.workdir];
  const candidates = (paths.length ? paths : allPaths(from, to)).filter((p) => {
    if (staged) return !unmerged.has(p); // unmerged ফাইল staged অংশে দেখায় না
    return p in repo.index; // untracked বাদ
  });

  const output = candidates
    .map((p) => fileDiff(p, from[p], to[p]))
    .filter(Boolean)
    .join("\n");
  if (!output) return success(state, "", staged ? msg.diffNoneStaged : msg.diffNone);
  return success(state, output, staged ? msg.diffShownStaged : msg.diffShown);
};
