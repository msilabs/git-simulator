import type { CommandHandler, ConflictKind, FileMap } from "../types";
import { allPaths, failure, get, has, headTree, setFile, success, withUnmerged } from "../helpers";
import { msg } from "../messages";

/** আসল `git rm`-এর এরর: প্রতিটা দলের জন্য আলাদা "error:" লাইন। */
function blockedError(group: readonly string[], one: string, many: string, hint: string): string {
  return `error: the following ${group.length === 1 ? one : many}${group.map((p) => `\n    ${p}`).join("")}${hint}`;
}

/**
 * `git rm <file>...`: ফাইল ফোল্ডার আর staging area দুই জায়গা থেকে মোছে (মুছে ফেলাটা staged হয়)
 * `git rm --cached <file>...`: শুধু staging area থেকে সরায়, ফাইল ফোল্ডারে থেকে যায় (untracked হয়)
 * `-f`: commit না করা বদল থাকলেও মোছে; `-r`: `git rm -r .` দিয়ে সব tracked ফাইল।
 * conflict চলা ফাইলে `git rm` মানে "মুছে ফেলেই conflict মেটালাম", আসল Git-এর মতো।
 * সরলীকরণ: ফোল্ডার আর glob নেই; `-n`, `-q` নেই।
 */
export const gitRm: CommandHandler = (state, args) => {
  const repo = state.repo!;
  let cached = false;
  let force = false;
  let recursive = false;
  let optionsDone = false;
  const paths: string[] = [];
  for (const a of args) {
    if (optionsDone || !a.startsWith("-") || a === "-") paths.push(a);
    else if (a === "--") optionsDone = true;
    else if (a === "--cached") cached = true;
    else if (a === "--force") force = true;
    else if (a === "--recursive") recursive = true;
    else if (/^-[rf]+$/.test(a)) {
      if (a.includes("f")) force = true;
      if (a.includes("r")) recursive = true;
    } else return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
  }
  if (paths.length === 0) {
    return failure(state, "fatal: No pathspec was given. Which files should I remove?", msg.gitRmMissingArg);
  }

  const unmerged: Record<string, ConflictKind> = { ...(repo.merge?.unmerged ?? {}) };
  const known = (p: string) => has(repo.index, p) || has(unmerged, p);
  const targets = new Set<string>();
  for (const p of paths) {
    if (p === ".") {
      if (!recursive) return failure(state, "fatal: not removing '.' recursively without -r", msg.gitRmNeedsRecursive);
      const all = allPaths(repo.index, unmerged);
      if (all.length === 0) return failure(state, "fatal: pathspec '.' did not match any files", msg.gitRmNoMatch("."));
      all.forEach((x) => targets.add(x));
    } else if (!known(p)) {
      return failure(state, `fatal: pathspec '${p}' did not match any files`, msg.gitRmNoMatch(p));
    } else {
      targets.add(p);
    }
  }

  const head = headTree(repo);
  // আসল Git-এর নিয়ম: commit না করা কাজ হারাবে এমন ফাইল -f ছাড়া মোছে না।
  if (!force) {
    const both: string[] = [];
    const stagedOnly: string[] = [];
    const localOnly: string[] = [];
    for (const p of targets) {
      if (has(unmerged, p)) continue;
      const inIndex = get(repo.index, p);
      const work = get(state.workdir, p);
      const staged = inIndex !== get(head, p);
      const local = work !== undefined && work !== inIndex;
      if (staged && local) both.push(p);
      else if (!cached) {
        if (staged) stagedOnly.push(p);
        if (local) localOnly.push(p);
      }
    }
    if (both.length || stagedOnly.length || localOnly.length) {
      const errors: string[] = [];
      const keepHint = "\n(use --cached to keep the file, or -f to force removal)";
      if (both.length) {
        errors.push(
          blockedError(
            both,
            "file has staged content different from both the\nfile and the HEAD:",
            "files have staged content different from both the\nfile and the HEAD:",
            "\n(use -f to force removal)",
          ),
        );
      }
      if (stagedOnly.length) {
        errors.push(blockedError(stagedOnly, "file has changes staged in the index:", "files have changes staged in the index:", keepHint));
      }
      if (localOnly.length) {
        errors.push(blockedError(localOnly, "file has local modifications:", "files have local modifications:", keepHint));
      }
      const blocked = [...both, ...stagedOnly, ...localOnly].sort();
      return failure(state, errors.join("\n"), msg.gitRmBlocked(blocked, both.length === 0));
    }
  }

  const sorted = [...targets].sort();
  let index: FileMap = repo.index;
  let workdir: FileMap = state.workdir;
  const resolved: string[] = [];
  for (const p of sorted) {
    index = setFile(index, p, undefined);
    if (!cached) workdir = setFile(workdir, p, undefined);
    if (has(unmerged, p)) {
      delete unmerged[p];
      resolved.push(p);
    }
  }

  const output = sorted.map((p) => `rm '${p}'`).join("\n");
  const removed = sorted.filter((p) => !resolved.includes(p));
  const explanation = [
    removed.length
      ? cached
        ? msg.gitRmCached(removed, removed.some((p) => has(head, p)))
        : msg.gitRmDone(removed)
      : "",
    resolved.length ? msg.gitRmResolved(resolved) : "",
    resolved.length && Object.keys(unmerged).length === 0 ? msg.addResolvedAll : "",
  ]
    .filter(Boolean)
    .join("\n");
  const merge = withUnmerged(repo, unmerged);
  return success({ ...state, workdir, repo: { ...repo, index, merge } }, output, explanation);
};
