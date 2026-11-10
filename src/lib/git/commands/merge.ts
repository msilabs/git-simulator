import type { CommandHandler, Commit, ConflictKind, FileMap, MergeState, SimState } from "../types";
import {
  allPaths,
  diffstatLines,
  failure,
  get,
  headCommit,
  isAncestor,
  makeCommitId,
  mergeBase,
  modeLines,
  moveTree,
  overwrittenError,
  setFile,
  success,
  summaryLine,
  treeChanges,
  unmergedPaths,
  UNMERGED_ERROR,
} from "../helpers";
import { merge3 } from "../merge3";
import { msg } from "../messages";
import { commit } from "./commit";

export interface Conflict {
  readonly path: string;
  readonly kind: ConflictKind;
  /** conflict-এর পর working directory-তে যে লেখা থাকবে */
  readonly work: string;
}

/**
 * তিন-দিকের (three-way) merge, ফাইল ধরে ধরে:
 * base থেকে শুধু এক দিক বদলালে সেই বদল; দুই দিক একইভাবে বদলালে সমস্যা নেই;
 * দুই দিক একই ফাইল বদলালে লাইন ধরে মেলানো (merge3), তাতেও না মিললে conflict।
 */
export function threeWay(base: FileMap, ours: FileMap, theirs: FileMap, theirsLabel: string, oursLabel = "HEAD") {
  const result: Record<string, string> = {};
  const conflicts: Conflict[] = [];
  const autoMerged: string[] = [];
  for (const p of allPaths(base, ours, theirs)) {
    const b = get(base, p);
    const o = get(ours, p);
    const t = get(theirs, p);
    if (o === t || b === t) {
      if (o !== undefined) result[p] = o;
    } else if (b === o) {
      if (t !== undefined) result[p] = t;
    } else if (o !== undefined && t !== undefined) {
      const merged = merge3(b ?? "", o, t, oursLabel, theirsLabel);
      autoMerged.push(p);
      if (merged.conflict) conflicts.push({ path: p, kind: b === undefined ? "both added" : "both modified", work: merged.content });
      else result[p] = merged.content;
    } else if (o === undefined) {
      // আমরা মুছেছি, ওরা বদলেছে: ওদের সংস্করণ ফাইলে থাকে (আসল Git-এর মতো)
      conflicts.push({ path: p, kind: "deleted by us", work: t! });
    } else {
      conflicts.push({ path: p, kind: "deleted by them", work: o });
    }
  }
  return { result: result as FileMap, conflicts, autoMerged };
}

/** merge-এর আউটপুটের "Auto-merging"-এর পরের CONFLICT লাইনগুলো, আসল Git-এর লেখায়। */
export function conflictLines(conflicts: readonly Conflict[], theirsLabel: string, oursLabel = "HEAD"): string[] {
  return conflicts.map((c) =>
    c.kind === "deleted by us"
      ? `CONFLICT (modify/delete): ${c.path} deleted in ${oursLabel} and modified in ${theirsLabel}.  Version ${theirsLabel} of ${c.path} left in tree.`
      : c.kind === "deleted by them"
        ? `CONFLICT (modify/delete): ${c.path} deleted in ${theirsLabel} and modified in ${oursLabel}.  Version ${oursLabel} of ${c.path} left in tree.`
        : `CONFLICT (${c.kind === "both added" ? "add/add" : "content"}): Merge conflict in ${c.path}`,
  );
}

/**
 * থেমে থাকা merge বা revert বাতিল করে আগের অবস্থায় ফেরা (`git merge --abort`, `git revert --abort`)।
 * আসল Git (`reset --merge`)-এর মতো: index পুরোটা HEAD-এ ফেরে; working directory-তে শুধু
 * merge-এর ছোঁয়া ফাইলগুলো ফেরে, বাকি commit না করা বদল থেকে যায় (staged থাকলে unstaged হয়)।
 */
export function abortInProgress(state: SimState): SimState {
  const repo = state.repo!;
  const head = headCommit(repo)?.files ?? {};
  let workdir = state.workdir;
  for (const p of repo.merge?.touched ?? []) workdir = setFile(workdir, p, get(head, p));
  return { ...state, workdir, repo: { ...repo, index: head, merge: null } };
}

/** `git merge --abort` */
function abort(state: SimState): ReturnType<CommandHandler> {
  if (state.repo!.merge?.kind !== "merge") {
    return failure(state, "fatal: There is no merge to abort (MERGE_HEAD missing).", msg.mergeAbortNone);
  }
  return success(abortInProgress(state), "", msg.mergeAborted);
}

/**
 * `git merge <branch>`, `git merge --abort`, `git merge --continue`
 * - <branch> যদি আগেই বর্তমান branch-এ থাকে: "Already up to date."
 * - বর্তমান branch যদি <branch>-এর পূর্বপুরুষ হয়: fast-forward (নতুন commit নয়)
 * - নাহলে ২ parent-এর merge commit; একই লাইন দুই দিকে বদলালে conflict-এ থামে
 * সরলীকরণ: `--no-ff`, `--squash`, `-m` ইত্যাদি অপশন নেই।
 */
export const merge: CommandHandler = (state, args) => {
  const repo = state.repo!;
  if (args.length === 1 && args[0] === "--abort") return abort(state);
  if (args.length === 1 && args[0] === "--continue") {
    if (repo.merge?.kind !== "merge") {
      return failure(state, "fatal: There is no merge in progress (MERGE_HEAD missing).", msg.mergeContinueNone);
    }
    return commit(state, []);
  }
  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));

  if (repo.merge) {
    return unmergedPaths(repo).length
      ? failure(state, UNMERGED_ERROR("Merging"), msg.mergeInProgressUnmerged)
      : failure(
          state,
          "fatal: You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.",
          msg.mergeInProgressResolved,
        );
  }
  if (args.length === 0) return failure(state, "fatal: No remote for the current branch.", msg.mergeMissingArg);
  if (args.length > 1) return failure(state, `error: unsupported in simulator: ${args[1]}`, msg.mergeTooMany);

  const name = args[0];
  const theirsId = get(repo.branches, name);
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
        overwrittenError(moved.paths, moved.reason, "merge"),
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
  // আসল Git (ort) সত্যিকারের merge-এর আগে চায় index যেন HEAD-এর সাথে মেলে।
  const stagedPaths = allPaths(repo.index, ours.files).filter((p) => get(repo.index, p) !== get(ours.files, p));
  if (stagedPaths.length) {
    return failure(state, overwrittenError(stagedPaths, "local-changes", "merge"), msg.mergeBlocked(stagedPaths));
  }

  const baseId = mergeBase(repo, ours.id, theirsId);
  const base = baseId ? repo.commits[baseId].files : {};
  const { result, conflicts, autoMerged } = threeWay(base, ours.files, theirs.files, name);

  // working directory-তে যা বসবে: মেলানো ফাইল + conflict চিহ্নসহ ফাইল
  let target: FileMap = result;
  for (const c of conflicts) target = setFile(target, c.path, c.work);
  const moved = moveTree(state.workdir, repo.index, ours.files, target);
  if (!moved.ok) {
    return failure(
      state,
      overwrittenError(moved.paths, moved.reason, "merge"),
      moved.reason === "local-changes" ? msg.mergeBlocked(moved.paths) : msg.mergeBlockedUntracked(moved.paths),
    );
  }

  // আসল Git main/master-এ merge করলে " into <branch>" লেখে না।
  const message = `Merge branch '${name}'${repo.head === "main" || repo.head === "master" ? "" : ` into ${repo.head}`}`;
  const conflictPaths = new Set(conflicts.map((c) => c.path));
  const autoLines = autoMerged.map((p) => `Auto-merging ${p}`);
  const autoExplain = autoMerged.filter((p) => !conflictPaths.has(p));

  if (conflicts.length) {
    // conflict ফাইলের index-এ আমাদের সংস্করণই থাকে; বাকি মেলানো ফাইল staged
    let index = moved.index;
    for (const c of conflicts) index = setFile(index, c.path, get(ours.files, c.path));
    const mergeState: MergeState = {
      kind: "merge",
      theirs: theirsId,
      branch: name,
      message,
      unmerged: Object.fromEntries(conflicts.map((c) => [c.path, c.kind])),
      touched: allPaths(ours.files, target).filter((p) => get(ours.files, p) !== get(target, p)),
    };
    const lines = [...autoLines, ...conflictLines(conflicts, name), "Automatic merge failed; fix conflicts and then commit the result."];
    const explanation = [autoExplain.length ? msg.mergeAutoMerged(autoExplain) : "", msg.mergeConflict([...conflictPaths], name)]
      .filter(Boolean)
      .join("\n");
    return failure(
      { ...state, workdir: moved.workdir, repo: { ...repo, index, merge: mergeState } },
      lines.join("\n"),
      explanation,
    );
  }

  const time = state.clock + 1;
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
    ...autoLines,
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
  const explanation = [autoExplain.length ? msg.mergeAutoMerged(autoExplain) : "", msg.mergeCommit(repo.head, name, id)]
    .filter(Boolean)
    .join("\n");
  return success(next, output, explanation);
};
