import type { CommandHandler, ConflictKind, Repo, SimState } from "../types";
import { allPaths, get, has, headCommit, headTree, success } from "../helpers";
import { msg } from "../messages";

export interface StatusEntry {
  readonly path: string;
  readonly kind: "new file" | "modified" | "deleted";
}

export interface StatusInfo {
  readonly branch: string;
  readonly noCommits: boolean;
  /** index বনাম HEAD commit */
  readonly staged: StatusEntry[];
  /** working directory বনাম index (শুধু tracked ফাইল) */
  readonly unstaged: StatusEntry[];
  /** working directory-তে আছে কিন্তু index-এ নেই */
  readonly untracked: string[];
  /** কোন কাজ থেমে আছে: merge, revert, নাকি কিছু না */
  readonly operation: "merge" | "revert" | null;
  /** revert চললে কোন commit উল্টানো হচ্ছে */
  readonly reverting: string | null;
  /** conflict মেটানো বাকি এমন ফাইল */
  readonly unmerged: { readonly path: string; readonly kind: ConflictKind }[];
}

export function getStatus(state: SimState, repo: Repo): StatusInfo {
  const head = headTree(repo);
  const { index } = repo;
  const work = state.workdir;
  const staged: StatusEntry[] = [];
  const unstaged: StatusEntry[] = [];
  const untracked: string[] = [];

  const conflicts = repo.merge?.unmerged ?? {};
  const unmerged = Object.keys(conflicts)
    .sort()
    .map((path) => ({ path, kind: conflicts[path] }));

  for (const path of allPaths(head, index, work)) {
    if (has(conflicts, path)) continue; // unmerged ফাইল আলাদা অংশে দেখায়
    const inHead = get(head, path);
    const inIndex = get(index, path);
    const inWork = get(work, path);
    if (inIndex !== inHead) {
      staged.push({
        path,
        kind: inHead === undefined ? "new file" : inIndex === undefined ? "deleted" : "modified",
      });
    }
    if (inIndex !== undefined) {
      if (inWork === undefined) unstaged.push({ path, kind: "deleted" });
      else if (inWork !== inIndex) unstaged.push({ path, kind: "modified" });
    } else if (inWork !== undefined) {
      untracked.push(path);
    }
  }
  return {
    branch: repo.head,
    noCommits: headCommit(repo) === null,
    staged,
    unstaged,
    untracked,
    // stash ফেরানোর conflict-এ আসল Git কোনো চলমান কাজ দেখায় না, শুধু Unmerged paths
    operation: repo.merge && repo.merge.kind !== "stash" ? repo.merge.kind : null,
    reverting: repo.merge?.kind === "revert" ? repo.merge.theirs : null,
    unmerged,
  };
}

const entryLine = (e: StatusEntry) => `\t${(e.kind + ":").padEnd(12)}${e.path}`;

/**
 * আসল `git status`-এর লম্বা আউটপুটের মতো লেখা। `git commit` কিছু না পেলেও এটা দেখায়।
 * আসল Git-এর মতো প্রতিটা অংশের শেষে একটা ফাঁকা লাইন থাকে; `keepTrailingBlank` না দিলে
 * একদম শেষের ফাঁকা লাইন বাদ যায় (stash pop-এর মতো যেখানে পরে আরও লেখা বসে, সেখানে রাখা হয়)।
 */
export function formatStatus(info: StatusInfo, keepTrailingBlank = false): string {
  const out: string[] = [`On branch ${info.branch}`];
  if (info.operation === "merge" && info.unmerged.length) {
    out.push(
      "You have unmerged paths.",
      '  (fix conflicts and run "git commit")',
      '  (use "git merge --abort" to abort the merge)',
      "",
    );
  } else if (info.operation === "merge") {
    out.push("All conflicts fixed but you are still merging.", '  (use "git commit" to conclude merge)', "");
  } else if (info.operation === "revert") {
    out.push(
      `You are currently reverting commit ${info.reverting}.`,
      info.unmerged.length ? '  (fix conflicts and run "git revert --continue")' : '  (all conflicts fixed: run "git revert --continue")',
      '  (use "git revert --skip" to skip this patch)',
      '  (use "git revert --abort" to cancel the revert operation)',
      "",
    );
  }
  if (info.noCommits) out.push("", "No commits yet", "");
  // আসল Git merge চলাকালীন "unstage" করার পরামর্শ দেখায় না; revert বা সাধারণ সময়ে দেখায়
  const unstageHint = info.operation === "merge" ? [] : ['  (use "git restore --staged <file>..." to unstage)'];

  if (info.staged.length) {
    out.push(
      "Changes to be committed:",
      ...(info.noCommits ? ['  (use "git rm --cached <file>..." to unstage)'] : unstageHint),
      ...info.staged.map(entryLine),
      "",
    );
  }
  if (info.unmerged.length) {
    const anyDeleted = info.unmerged.some((e) => e.kind.startsWith("deleted"));
    out.push(
      "Unmerged paths:",
      ...unstageHint,
      anyDeleted
        ? '  (use "git add/rm <file>..." as appropriate to mark resolution)'
        : '  (use "git add <file>..." to mark resolution)',
      ...info.unmerged.map((e) => `\t${(e.kind + ":").padEnd(17)}${e.path}`),
      "",
    );
  }
  if (info.unstaged.length) {
    const anyDeleted = info.unstaged.some((e) => e.kind === "deleted");
    out.push(
      "Changes not staged for commit:",
      anyDeleted
        ? '  (use "git add/rm <file>..." to update what will be committed)'
        : '  (use "git add <file>..." to update what will be committed)',
      '  (use "git restore <file>..." to discard changes in working directory)',
      ...info.unstaged.map(entryLine),
      "",
    );
  }
  if (info.untracked.length) {
    out.push(
      "Untracked files:",
      '  (use "git add <file>..." to include in what will be committed)',
      ...info.untracked.map((p) => `\t${p}`),
      "",
    );
  }

  // কিছু staged থাকলে, বা সব conflict মেটানো merge চললে (merge commit করা যায়) শেষে আর কোনো লাইন নেই
  const committable = info.staged.length > 0 || (info.operation === "merge" && info.unmerged.length === 0);
  if (committable) {
    // কিছু যোগ করার নেই
  } else if (info.unstaged.length || info.unmerged.length) {
    out.push('no changes added to commit (use "git add" and/or "git commit -a")');
  } else if (info.untracked.length) {
    out.push('nothing added to commit but untracked files present (use "git add" to track)');
  } else if (info.noCommits) {
    out.push('nothing to commit (create/copy files and use "git add" to track)');
  } else {
    out.push("nothing to commit, working tree clean");
  }
  if (!keepTrailingBlank) while (out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

export const status: CommandHandler = (state) => {
  const repo = state.repo!;
  const info = getStatus(state, repo);
  const { staged, unstaged, untracked } = info;
  if (info.operation) return success(state, formatStatus(info), msg.statusMerging(info.operation, info.unmerged.length));
  if (info.unmerged.length) return success(state, formatStatus(info), msg.statusStashConflict(info.unmerged.length));
  const explanation =
    staged.length + unstaged.length + untracked.length === 0
      ? msg.statusClean(info.branch)
      : msg.statusSummary(info.branch, staged.length, unstaged.length, untracked.length);
  return success(state, formatStatus(info), explanation);
};
