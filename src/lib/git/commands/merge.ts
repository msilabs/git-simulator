import type { CommandHandler, Commit, FileMap, SimState } from "../types";
import {
  allPaths,
  diffstatLines,
  failure,
  headCommit,
  isAncestor,
  makeCommitId,
  mergeBase,
  modeLines,
  moveTree,
  success,
  summaryLine,
  treeChanges,
} from "../helpers";
import { msg } from "../messages";

interface Conflict {
  readonly path: string;
  readonly kind: "content" | "add/add" | "modify/delete";
}

/**
 * তিন-দিকের (three-way) merge, ফাইল ধরে ধরে:
 * base থেকে শুধু এক দিক বদলালে সেই বদলটা নেওয়া হয়; দুই দিক একইভাবে বদলালে সমস্যা নেই;
 * দুই দিক আলাদাভাবে বদলালে conflict।
 * সরলীকরণ: আসল Git একই ফাইলের আলাদা লাইনের বদল নিজে থেকে মিলিয়ে নিতে পারে;
 * আমরা ফাইল-স্তরে দেখি, তাই একই ফাইল দুই দিকে বদলালেই conflict ধরা হয়।
 */
function threeWay(base: FileMap, ours: FileMap, theirs: FileMap) {
  const result: Record<string, string> = {};
  const conflicts: Conflict[] = [];
  for (const p of allPaths(base, ours, theirs)) {
    const b = base[p];
    const o = ours[p];
    const t = theirs[p];
    let merged: string | undefined;
    if (o === t) merged = o;
    else if (b === o) merged = t;
    else if (b === t) merged = o;
    else {
      conflicts.push({
        path: p,
        kind: o === undefined || t === undefined ? "modify/delete" : b === undefined ? "add/add" : "content",
      });
      continue;
    }
    if (merged !== undefined) result[p] = merged;
  }
  return { result: result as FileMap, conflicts };
}

function blockedOutput(paths: string[], reason: "local-changes" | "untracked") {
  const files = paths.map((p) => `\t${p}`).join("\n");
  return reason === "local-changes"
    ? `error: Your local changes to the following files would be overwritten by merge:\n${files}\nPlease commit your changes or stash them before you merge.\nAborting`
    : `error: The following untracked working tree files would be overwritten by merge:\n${files}\nPlease move or remove them before you merge.\nAborting`;
}

/**
 * `git merge <branch>`
 * - <branch> যদি আগেই বর্তমান branch-এ থাকে: "Already up to date."
 * - বর্তমান branch যদি <branch>-এর পূর্বপুরুষ হয়: fast-forward (নতুন commit নয়)
 * - নাহলে ২ parent-এর merge commit
 * সরলীকরণ: conflict হলে আসল Git ফাইলে conflict চিহ্ন বসিয়ে থামে; v1 পুরো merge বাতিল করে।
 * `--no-ff`, `--squash`, `-m` ইত্যাদি অপশন নেই।
 */
export const merge: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (args.length === 0) return failure(state, "fatal: No remote for the current branch.", msg.mergeMissingArg);
  if (args.length > 1) return failure(state, `error: unsupported in simulator: ${args[1]}`, msg.mergeTooMany);

  const name = args[0];
  const theirsId = repo.branches[name];
  if (!theirsId) return failure(state, `merge: ${name} - not something we can merge`, msg.mergeNotFound(name));
  const theirs = repo.commits[theirsId];
  const ours = headCommit(repo);

  if (name === repo.head) return success(state, "Already up to date.", msg.mergeSelf(name));
  if (ours && isAncestor(repo, theirsId, ours.id)) {
    return success(state, "Already up to date.", msg.mergeUpToDate(name, repo.head));
  }

  // fast-forward: আমাদের commit ওদের ইতিহাসেরই অংশ (অথবা আমাদের কোনো commit-ই নেই)।
  if (!ours || isAncestor(repo, ours.id, theirsId)) {
    const from = ours?.files ?? {};
    const moved = moveTree(state.workdir, repo.index, from, theirs.files);
    if (!moved.ok) {
      return failure(
        state,
        blockedOutput(moved.paths, moved.reason),
        moved.reason === "local-changes" ? msg.mergeBlocked(moved.paths) : msg.mergeBlockedUntracked(moved.paths),
      );
    }
    const changes = treeChanges(from, theirs.files);
    const output = [
      ours ? `Updating ${ours.id}..${theirsId}` : "",
      "Fast-forward",
      ...diffstatLines(changes),
      changes.length ? summaryLine(changes) : "",
      ...modeLines(changes),
    ]
      .filter(Boolean)
      .join("\n");
    return success(
      {
        ...state,
        workdir: moved.workdir,
        repo: { ...repo, index: moved.index, branches: { ...repo.branches, [repo.head]: theirsId } },
      },
      output,
      msg.mergeFastForward(repo.head, name),
    );
  }

  // সত্যিকারের merge।
  const baseId = mergeBase(repo, ours.id, theirsId);
  const base = baseId ? repo.commits[baseId].files : {};
  const { result, conflicts } = threeWay(base, ours.files, theirs.files);

  if (conflicts.length) {
    const lines = conflicts.flatMap((c) =>
      c.kind === "modify/delete"
        ? [`CONFLICT (modify/delete): ${c.path} deleted in one branch and modified in the other.`]
        : [`Auto-merging ${c.path}`, `CONFLICT (${c.kind}): Merge conflict in ${c.path}`],
    );
    lines.push("Merge aborted by the simulator: conflicts are not supported yet. Nothing was changed.");
    return failure(state, lines.join("\n"), msg.mergeConflict(conflicts.map((c) => c.path)));
  }

  // আসল Git (ort) সত্যিকারের merge-এর আগে চায় index যেন HEAD-এর সাথে মেলে।
  const stagedPaths = allPaths(repo.index, ours.files).filter((p) => repo.index[p] !== ours.files[p]);
  if (stagedPaths.length) {
    return failure(state, blockedOutput(stagedPaths, "local-changes"), msg.mergeBlocked(stagedPaths));
  }
  const moved = moveTree(state.workdir, repo.index, ours.files, result);
  if (!moved.ok) {
    return failure(
      state,
      blockedOutput(moved.paths, moved.reason),
      moved.reason === "local-changes" ? msg.mergeBlocked(moved.paths) : msg.mergeBlockedUntracked(moved.paths),
    );
  }

  const time = state.clock + 1;
  // আসল Git main/master-এ merge করলে " into <branch>" লেখে না।
  const message = `Merge branch '${name}'${repo.head === "main" || repo.head === "master" ? "" : ` into ${repo.head}`}`;
  const id = makeCommitId(repo, `${time}:${ours.id}:${theirsId}:${message}`);
  const mergeCommit: Commit = {
    id,
    message,
    parents: [ours.id, theirsId],
    files: result,
    time,
    branch: repo.head,
  };
  const changes = treeChanges(ours.files, result);
  const output = [
    "Merge made by the 'ort' strategy.",
    ...diffstatLines(changes),
    changes.length ? summaryLine(changes) : "",
    ...modeLines(changes),
  ]
    .filter(Boolean)
    .join("\n");

  const next: SimState = {
    ...state,
    clock: time,
    workdir: moved.workdir,
    repo: {
      ...repo,
      index: moved.index,
      commits: { ...repo.commits, [id]: mergeCommit },
      branches: { ...repo.branches, [repo.head]: id },
    },
  };
  return success(next, output, msg.mergeCommit(repo.head, name, id));
};
