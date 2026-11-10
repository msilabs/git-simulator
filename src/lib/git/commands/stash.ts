import type { CommandHandler, FileMap, SimState, StashEntry } from "../types";
import {
  allPaths,
  failure,
  get,
  has,
  headCommit,
  makeCommitId,
  moveTree,
  overwrittenError,
  sameFiles,
  setFile,
  success,
  unmergedPaths,
} from "../helpers";
import { msg } from "../messages";
import { formatStatus, getStatus } from "./status";
import { threeWay } from "./merge";

type Result = ReturnType<CommandHandler>;

const NO_ENTRIES = "No stash entries found.";

/** stash-এর সময় tracked ফাইলগুলোর পুরো অবস্থা (মোছা ফাইল বাদ) */
function stashedTree(entry: StashEntry): FileMap {
  const tree: Record<string, string> = {};
  for (const p of Object.keys(entry.index)) {
    const content = get(entry.workdir, p);
    if (content !== undefined) tree[p] = content;
  }
  return tree;
}

/** `git stash` / `git stash push [-m <message>]` */
function push(state: SimState, args: readonly string[]): Result {
  const repo = state.repo!;
  let note: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-m" || a === "--message") {
      if (i + 1 >= args.length) return failure(state, `error: switch \`m' requires a value`, msg.stashMissingMessage);
      note = args[++i];
    } else {
      return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    }
  }

  const head = headCommit(repo);
  if (!head) return failure(state, "You do not have the initial commit yet", msg.stashNoCommit);
  if (repo.merge) {
    const unmerged = unmergedPaths(repo);
    if (unmerged.length) {
      return failure(state, ["error: could not write index", ...unmerged.map((p) => `${p}: needs merge`)].join("\n"), msg.stashUnmerged);
    }
    return failure(state, "error: unsupported in simulator: git stash during a merge", msg.stashDuringMerge);
  }

  const trackedWork: Record<string, string> = {};
  for (const p of Object.keys(repo.index)) {
    const content = get(state.workdir, p);
    if (content !== undefined) trackedWork[p] = content;
  }
  const dirtyWork = Object.keys(repo.index).some((p) => get(state.workdir, p) !== repo.index[p]);
  if (sameFiles(repo.index, head.files) && !dirtyWork) return success(state, "No local changes to save", msg.stashNothing);

  const message = note !== null ? `On ${repo.head}: ${note}` : `WIP on ${repo.head}: ${head.id} ${head.message.split("\n")[0]}`;
  const entry: StashEntry = {
    id: makeCommitId(repo, `stash:${state.clock}:${repo.stash.length}:${message}`),
    message,
    base: head.id,
    index: repo.index,
    workdir: trackedWork,
  };

  // tracked ফাইল আর staging area HEAD-এ ফেরে; untracked ফাইল যেমন ছিল থাকে
  let workdir = state.workdir;
  for (const p of allPaths(repo.index, head.files)) workdir = setFile(workdir, p, get(head.files, p));
  const saved = allPaths(repo.index, head.files).filter(
    (p) => get(repo.index, p) !== get(head.files, p) || get(state.workdir, p) !== get(repo.index, p),
  );
  return success(
    { ...state, workdir, repo: { ...repo, index: head.files, stash: [entry, ...repo.stash] } },
    `Saved working directory and index state ${message}`,
    msg.stashSaved(saved),
  );
}

function list(state: SimState): Result {
  const stash = state.repo!.stash;
  if (stash.length === 0) return success(state, "", msg.stashListEmpty);
  return success(state, stash.map((e, i) => `stash@{${i}}: ${e.message}`).join("\n"), msg.stashList(stash.length));
}

/** "stash@{1}" বা "1" থেকে তালিকার অবস্থান; না দিলে 0 */
function pickEntry(state: SimState, args: readonly string[]): { index: number } | { error: Result } {
  const stash = state.repo!.stash;
  if (args.length > 1) return { error: failure(state, `error: unsupported in simulator: ${args[1]}`, msg.unsupportedOption(args[1])) };
  if (args[0]?.startsWith("-")) return { error: failure(state, `error: unsupported in simulator: ${args[0]}`, msg.unsupportedOption(args[0])) };
  if (args.length === 0) return stash.length ? { index: 0 } : { error: failure(state, NO_ENTRIES, msg.stashEmpty) };
  const m = /^(?:stash@\{(\d+)\}|(\d+))$/.exec(args[0]);
  if (!m) return { error: failure(state, `error: ${args[0]} is not a valid reference`, msg.stashBadRef(args[0])) };
  const index = Number(m[1] ?? m[2]);
  if (stash.length === 0) return { error: failure(state, `error: ${args[0]} is not a valid reference`, msg.stashBadRef(args[0])) };
  if (index >= stash.length) {
    return { error: failure(state, `fatal: log for 'stash' only has ${stash.length} entries`, msg.stashBadRef(args[0])) };
  }
  return { index };
}

const dropped = (i: number, entry: StashEntry) => `Dropped refs/stash@{${i}} (${entry.id})`;

/**
 * `git stash apply` / `git stash pop`
 * stash-এর বদল বর্তমান ফাইলে মেলায় (three-way: stash-এর সময়ের commit, এখনকার অবস্থা, stash)।
 * আসল Git-এর মতো staged বদল unstaged হয়ে ফেরে, শুধু stash-এ নতুন যোগ করা ফাইল আবার staged হয়।
 * সরলীকরণ: মেলাতে গিয়ে conflict হলে আসল Git চিহ্ন বসায়; সিমুলেটর কিছু না বদলে থামে।
 */
function apply(state: SimState, args: readonly string[], pop: boolean): Result {
  const repo = state.repo!;
  const picked = pickEntry(state, args);
  if ("error" in picked) return picked.error;
  if (repo.merge) return failure(state, `error: unsupported in simulator: git stash ${pop ? "pop" : "apply"} during a merge`, msg.stashDuringMerge);

  const entry = repo.stash[picked.index];
  const base = repo.commits[entry.base].files;
  const { result, conflicts } = threeWay(base, repo.index, stashedTree(entry), "Stashed changes");
  if (conflicts.length) {
    const paths = conflicts.map((c) => c.path);
    return failure(state, `error: unsupported in simulator: conflict in ${paths.join(", ")}`, msg.stashConflict(paths, pop));
  }

  const moved = moveTree(state.workdir, repo.index, repo.index, result);
  if (!moved.ok) {
    const status = formatStatus(getStatus(state, repo), pop);
    const kept = pop ? "\nThe stash entry is kept in case you need it again." : "";
    return failure(state, `${overwrittenError(moved.paths, moved.reason, "merge")}\n${status}${kept}`, msg.stashBlocked(moved.paths));
  }

  let index = repo.index;
  for (const p of Object.keys(entry.index)) {
    if (!has(base, p) && !has(index, p) && has(result, p)) index = setFile(index, p, result[p]);
  }
  const stash = pop ? repo.stash.filter((_, i) => i !== picked.index) : repo.stash;
  const next: SimState = { ...state, workdir: moved.workdir, repo: { ...repo, index, stash } };
  const output = pop ? `${formatStatus(getStatus(next, next.repo!), true)}\n${dropped(picked.index, entry)}` : formatStatus(getStatus(next, next.repo!));
  return success(next, output, pop ? msg.stashPopped(picked.index) : msg.stashApplied(picked.index));
}

function drop(state: SimState, args: readonly string[]): Result {
  const repo = state.repo!;
  const picked = pickEntry(state, args);
  if ("error" in picked) return picked.error;
  const entry = repo.stash[picked.index];
  return success(
    { ...state, repo: { ...repo, stash: repo.stash.filter((_, i) => i !== picked.index) } },
    dropped(picked.index, entry),
    msg.stashDropped(picked.index),
  );
}

/**
 * `git stash` (`push`, `-m`), `git stash list`, `pop`, `apply`, `drop`, `clear`
 * commit না করা বদল একপাশে সরিয়ে রেখে ফোল্ডার পরিষ্কার করে; পরে ফিরিয়ে আনা যায়।
 * সরলীকরণ: `-u` (untracked), `--index`, `show`, `branch` নেই।
 */
export const stash: CommandHandler = (state, args) => {
  const [sub, ...rest] = args;
  if (sub === undefined || sub.startsWith("-")) return push(state, args);
  if (sub === "push") return push(state, rest);
  if (rest.length === 0 && sub === "list") return list(state);
  if (sub === "pop" || sub === "apply") return apply(state, rest, sub === "pop");
  if (sub === "drop") return drop(state, rest);
  if (sub === "clear" && rest.length === 0) {
    const repo = state.repo!;
    if (repo.stash.length === 0) return success(state, "", msg.stashListEmpty);
    return success({ ...state, repo: { ...repo, stash: [] } }, "", msg.stashCleared);
  }
  return failure(state, `error: unsupported in simulator: git stash ${sub}`, msg.unsupportedOption(sub));
};
