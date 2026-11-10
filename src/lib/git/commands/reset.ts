import type { CommandHandler, ConflictKind, FileMap, Repo, SimState } from "../types";
import {
  allPaths,
  failure,
  get,
  has,
  headCommit,
  isAncestor,
  resolveRev,
  sameFiles,
  setFile,
  success,
  withUnmerged,
} from "../helpers";
import { msg } from "../messages";

type Mode = "soft" | "mixed" | "hard";

const ambiguous = (arg: string) =>
  `fatal: ambiguous argument '${arg}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`;

/** mixed reset-এর পর আসল Git যে তালিকা দেখায়: index-এ আছে কিন্তু ফোল্ডারে আলাদা বা মোছা ফাইল। */
function unstagedAfterReset(workdir: FileMap, index: FileMap): string {
  const lines = Object.keys(index)
    .sort()
    .filter((p) => get(workdir, p) !== index[p])
    .map((p) => `${has(workdir, p) ? "M" : "D"}\t${p}`);
  return lines.length ? ["Unstaged changes after reset:", ...lines].join("\n") : "";
}

/** reset-এর পর যে commit-গুলো আর branch-এ নেই, সেগুলোর কথা জানানো (ফেরার উপায়সহ)। */
function leftBehind(repo: Repo, oldId: string | undefined, newId: string): string {
  return oldId && !isAncestor(repo, oldId, newId) ? msg.resetLeftBehind(oldId) : "";
}

/** `git reset [<rev>] [--] <file>...`: শুধু ওই ফাইলগুলোর staging area বদলায়। */
function resetPaths(state: SimState, rev: string | null, revId: string | null, paths: readonly string[]) {
  const repo = state.repo!;
  const target = revId ? repo.commits[revId].files : (headCommit(repo)?.files ?? {});
  let index = repo.index;
  const unmerged: Record<string, ConflictKind> = { ...(repo.merge?.unmerged ?? {}) };
  for (const p of paths) {
    index = setFile(index, p, get(target, p));
    delete unmerged[p];
  }
  const resolved = Object.keys(unmerged).length !== Object.keys(repo.merge?.unmerged ?? {}).length;
  const merge = withUnmerged(repo, unmerged);
  return success(
    sameFiles(index, repo.index) && !resolved ? state : { ...state, repo: { ...repo, index, merge } },
    unstagedAfterReset(state.workdir, index),
    rev && rev !== "HEAD" ? msg.resetPathsTo(paths, revId!) : msg.resetPaths(paths),
  );
}

/**
 * `git reset [--soft | --mixed | --hard] [<commit>]` আর `git reset [<commit>] [--] <file>...`
 * - --soft: শুধু branch সরে; staging area আর ফাইল একই থাকে
 * - --mixed (ডিফল্ট): branch আর staging area সরে; ফাইলের লেখা একই থাকে
 * - --hard: branch, staging area আর ফোল্ডারের tracked ফাইল সব সরে (commit না করা বদল মুছে যায়)
 * চলমান merge বা revert-ও (--soft ছাড়া) বাতিল হয়, আসল Git-এর মতো।
 * সরলীকরণ: `--merge`, `--keep`, `-p`, `-q` নেই।
 */
export const reset: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let mode: Mode | null = null;
  let dashdash = -1;
  const words: string[] = [];
  for (const a of args) {
    if (dashdash < 0 && a === "--") dashdash = words.length;
    else if (dashdash < 0 && (a === "--soft" || a === "--mixed" || a === "--hard")) mode = a.slice(2) as Mode;
    else if (dashdash < 0 && a.startsWith("-")) return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    else words.push(a);
  }

  // কোনটা commit আর কোনটা ফাইল, আসল Git-এর মতো করে আলাদা করা
  let rev: string | null = null;
  let paths: string[];
  if (dashdash >= 0) {
    const before = words.slice(0, dashdash);
    if (before.length > 1) return failure(state, ambiguous(before[1]), msg.resetUnknown(before[1]));
    rev = before[0] ?? null;
    paths = words.slice(dashdash);
  } else if (words.length && resolveRev(repo, words[0])) {
    rev = words[0];
    paths = words.slice(1);
  } else {
    paths = words;
  }
  if (dashdash < 0) {
    const missing = paths.find((p) => !has(state.workdir, p));
    if (missing) return failure(state, ambiguous(missing), msg.resetUnknown(missing));
  }
  const revId = rev ? resolveRev(repo, rev) : null;
  if (rev && !revId) return failure(state, ambiguous(rev), msg.resetUnknown(rev));

  if (paths.length) {
    if (mode === "soft" || mode === "hard") {
      return failure(state, `fatal: Cannot do ${mode} reset with paths.`, msg.resetModeWithPaths(mode));
    }
    return resetPaths(state, rev, revId, paths);
  }

  const kind = mode ?? "mixed";
  const head = headCommit(repo);
  // প্রথম commit-এর আগে HEAD খালি tree-র মতো ধরা হয় (আসল Git-ও তাই করে)
  const targetId = revId ?? head?.id ?? null;
  const target = targetId ? repo.commits[targetId].files : {};
  const branches = targetId ? { ...repo.branches, [repo.head]: targetId } : repo.branches;
  const mergeNote = repo.merge && kind !== "soft" ? msg.resetMergeCleared(repo.merge.kind) : "";

  if (kind === "soft") {
    if (repo.merge) return failure(state, "fatal: Cannot do a soft reset in the middle of a merge.", msg.resetSoftMerge);
    if (!targetId || targetId === head?.id) return success(state, "", msg.resetNothing);
    return success(
      { ...state, repo: { ...repo, branches } },
      "",
      [msg.resetSoft(repo.head, targetId), leftBehind(repo, head?.id, targetId)].filter(Boolean).join("\n"),
    );
  }

  if (kind === "mixed") {
    const next = { ...state, repo: { ...repo, branches, index: target, merge: null } };
    const unchanged = targetId === (head?.id ?? null) && !repo.merge && sameFiles(target, repo.index);
    const explanation = [
      targetId && targetId !== head?.id ? msg.resetMixed(repo.head, targetId) : msg.resetMixedHead,
      mergeNote,
      targetId ? leftBehind(repo, head?.id, targetId) : "",
    ]
      .filter(Boolean)
      .join("\n");
    return success(unchanged ? state : next, unstagedAfterReset(state.workdir, target), unchanged ? msg.resetNothing : explanation);
  }

  // --hard: tracked প্রতিটা ফাইল (index-এ আছে, বা conflict চলছে) আর target-এর ফাইল target-এর মতো হয়;
  // untracked ফাইল যেমন ছিল থাকে।
  const headFiles = head?.files ?? {};
  const tracked = allPaths(repo.index, repo.merge?.unmerged ?? {}, headFiles);
  const discarded = tracked.filter(
    (p) => get(state.workdir, p) !== get(headFiles, p) || get(repo.index, p) !== get(headFiles, p),
  );
  let workdir = state.workdir;
  for (const p of allPaths(repo.index, repo.merge?.unmerged ?? {}, target)) {
    workdir = setFile(workdir, p, get(target, p));
  }
  const output = targetId ? `HEAD is now at ${targetId} ${repo.commits[targetId].message.split("\n")[0]}` : "";
  const unchanged =
    targetId === (head?.id ?? null) && !repo.merge && sameFiles(workdir, state.workdir) && sameFiles(target, repo.index);
  if (unchanged) return success(state, output, msg.resetHard(repo.head, targetId));
  const next = { ...state, workdir, repo: { ...repo, branches, index: target, merge: null } };
  const explanation = [
    msg.resetHard(repo.head, targetId),
    discarded.length ? msg.resetHardDiscarded(discarded) : "",
    mergeNote,
    targetId ? leftBehind(repo, head?.id, targetId) : "",
  ]
    .filter(Boolean)
    .join("\n");
  return success(next, output, explanation);
};
