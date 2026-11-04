import type { CommandHandler, ConflictKind, Repo, SimState } from "../types";
import { allPaths, headCommit, headTree, success } from "../helpers";
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
  /** merge চলছে কি না */
  readonly merging: boolean;
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
    if (path in conflicts) continue; // unmerged ফাইল আলাদা অংশে দেখায়
    if (index[path] !== head[path]) {
      staged.push({
        path,
        kind: !(path in head) ? "new file" : !(path in index) ? "deleted" : "modified",
      });
    }
    if (path in index) {
      if (!(path in work)) unstaged.push({ path, kind: "deleted" });
      else if (work[path] !== index[path]) unstaged.push({ path, kind: "modified" });
    } else if (path in work) {
      untracked.push(path);
    }
  }
  return {
    branch: repo.head,
    noCommits: headCommit(repo) === null,
    staged,
    unstaged,
    untracked,
    merging: Boolean(repo.merge),
    unmerged,
  };
}

const entryLine = (e: StatusEntry) => `\t${(e.kind + ":").padEnd(12)}${e.path}`;

/** আসল `git status`-এর লম্বা আউটপুটের মতো লেখা। `git commit` কিছু না পেলেও এটা দেখায়। */
export function formatStatus(info: StatusInfo): string {
  const out: string[] = [`On branch ${info.branch}`];
  if (info.merging && info.unmerged.length) {
    out.push(
      "You have unmerged paths.",
      '  (fix conflicts and run "git commit")',
      '  (use "git merge --abort" to abort the merge)',
    );
  } else if (info.merging) {
    out.push("All conflicts fixed but you are still merging.", '  (use "git commit" to conclude merge)');
  }
  if (info.noCommits) out.push("", "No commits yet");

  if (info.staged.length) {
    out.push(
      "",
      "Changes to be committed:",
      info.noCommits
        ? '  (use "git rm --cached <file>..." to unstage)'
        : '  (use "git restore --staged <file>..." to unstage)',
      ...info.staged.map(entryLine),
    );
  }
  if (info.unmerged.length) {
    const anyDeleted = info.unmerged.some((e) => e.kind.startsWith("deleted"));
    out.push(
      "",
      "Unmerged paths:",
      anyDeleted
        ? '  (use "git add/rm <file>..." as appropriate to mark resolution)'
        : '  (use "git add <file>..." to mark resolution)',
      ...info.unmerged.map((e) => `\t${(e.kind + ":").padEnd(17)}${e.path}`),
    );
  }
  if (info.unstaged.length) {
    const anyDeleted = info.unstaged.some((e) => e.kind === "deleted");
    out.push(
      "",
      "Changes not staged for commit:",
      anyDeleted
        ? '  (use "git add/rm <file>..." to update what will be committed)'
        : '  (use "git add <file>..." to update what will be committed)',
      '  (use "git restore <file>..." to discard changes in working directory)',
      ...info.unstaged.map(entryLine),
    );
  }
  if (info.untracked.length) {
    out.push(
      "",
      "Untracked files:",
      '  (use "git add <file>..." to include in what will be committed)',
      ...info.untracked.map((p) => `\t${p}`),
    );
  }

  // staged কিছু থাকলে শেষে আর কোনো লাইন নেই; নাহলে শেষ লাইনের আগে (দরকার হলে) একটা ফাঁকা লাইন।
  if (!info.staged.length && out.length > 1) out.push("");
  if (info.staged.length) {
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
  return out.join("\n");
}

export const status: CommandHandler = (state) => {
  const repo = state.repo!;
  const info = getStatus(state, repo);
  const { staged, unstaged, untracked } = info;
  if (info.merging) return success(state, formatStatus(info), msg.statusMerging(info.unmerged.length));
  const explanation =
    staged.length + unstaged.length + untracked.length === 0
      ? msg.statusClean(info.branch)
      : msg.statusSummary(info.branch, staged.length, unstaged.length, untracked.length);
  return success(state, formatStatus(info), explanation);
};
