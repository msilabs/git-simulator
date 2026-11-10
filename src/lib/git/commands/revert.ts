import type { CommandHandler, Commit, FileMap, MergeState, SimState } from "../types";
import {
  authorField,
  allPaths,
  failure,
  get,
  headCommit,
  makeCommitId,
  modeLines,
  moveTree,
  overwrittenError,
  resolveRev,
  sameFiles,
  setFile,
  success,
  summaryLine,
  treeChanges,
  unmergedPaths,
} from "../helpers";
import { msg } from "../messages";
import { formatStatus, getStatus } from "./status";
import { abortInProgress, conflictLines, threeWay } from "./merge";
import { commit } from "./commit";

const NOT_IN_PROGRESS = "error: no cherry-pick or revert in progress\nfatal: revert failed";

const conflictHints = (id: string, subject: string) =>
  [
    `error: could not revert ${id}... ${subject}`,
    "hint: After resolving the conflicts, mark them with",
    'hint: "git add/rm <pathspec>", then run',
    'hint: "git revert --continue".',
    'hint: You can instead skip this commit with "git revert --skip".',
    'hint: To abort and get back to the state before "git revert",',
    'hint: run "git revert --abort".',
  ].join("\n");

/** revert commit-এর মেসেজ, আসল Git-এর মতো (আসল Git এখানে পূর্ণ ৪০ অক্ষরের id লেখে) */
export const revertMessage = (target: Commit) =>
  `Revert "${target.message.split("\n")[0]}"\n\nThis reverts commit ${target.id}.`;

/**
 * `git revert <commit>`: ওই commit-এর বদল উল্টে দেয় এমন নতুন commit বানায়; ইতিহাস মোছে না।
 * ভেতরে এটা একটা three-way merge: base = ওই commit, ours = HEAD, theirs = ওই commit-এর parent।
 * `--continue`, `--abort`, `--skip`: conflict-এ থেমে থাকা revert শেষ, বাতিল বা বাদ দেওয়া।
 * সরলীকরণ: একবারে একটা commit; `-m` (merge commit উল্টানো), `-n` নেই; এডিটর খোলে না
 * (তাই `--no-edit` দিলেও একই)।
 */
export const revert: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const flags = args.filter((a) => a.startsWith("-") && a !== "--no-edit");
  const revs = args.filter((a) => !a.startsWith("-"));

  if (flags.length === 1 && revs.length === 0 && ["--continue", "--abort", "--skip"].includes(flags[0])) {
    if (repo.merge?.kind !== "revert") return failure(state, NOT_IN_PROGRESS, msg.revertNotInProgress);
    if (flags[0] === "--continue") return commit(state, []);
    return success(abortInProgress(state), "", flags[0] === "--abort" ? msg.revertAborted : msg.revertSkipped);
  }
  const option = flags[0];
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));

  if (repo.merge) {
    const unmerged = unmergedPaths(repo);
    if (unmerged.length) {
      return failure(
        state,
        `error: Reverting is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: revert failed`,
        msg.revertBusy(repo.merge.kind),
      );
    }
    return failure(state, "error: your local changes would be overwritten by revert.\nfatal: revert failed", msg.revertBusy(repo.merge.kind));
  }
  if (revs.length === 0) return failure(state, "usage: git revert <commit>", msg.revertMissingArg);
  if (revs.length > 1) return failure(state, `error: unsupported in simulator: ${revs[1]}`, msg.revertTooMany);

  const id = resolveRev(repo, revs[0]);
  if (!id) return failure(state, `fatal: bad revision '${revs[0]}'`, msg.revertBadRevision(revs[0]));
  const head = headCommit(repo)!;
  const target = repo.commits[id];
  const subject = target.message.split("\n")[0];
  if (target.parents.length > 1) {
    return failure(state, `error: commit ${id} is a merge but no -m option was given.\nfatal: revert failed`, msg.revertMergeCommit(id));
  }
  if (!sameFiles(repo.index, head.files)) {
    return failure(
      state,
      "error: your local changes would be overwritten by revert.\nhint: commit your changes or stash them to proceed.\nfatal: revert failed",
      msg.revertDirtyIndex,
    );
  }

  const parentId = target.parents[0];
  const theirsLabel = parentId ? `parent of ${id} (${subject})` : "(empty tree)";
  const { result, conflicts, autoMerged } = threeWay(target.files, head.files, parentId ? repo.commits[parentId].files : {}, theirsLabel);

  let tree: FileMap = result;
  for (const c of conflicts) tree = setFile(tree, c.path, c.work);
  const moved = moveTree(state.workdir, repo.index, head.files, tree);
  if (!moved.ok) {
    return failure(
      state,
      `${overwrittenError(moved.paths, moved.reason, "merge")}\nfatal: revert failed`,
      moved.reason === "local-changes" ? msg.mergeBlocked(moved.paths) : msg.mergeBlockedUntracked(moved.paths),
    );
  }

  const message = revertMessage(target);
  if (conflicts.length) {
    let index = moved.index;
    for (const c of conflicts) index = setFile(index, c.path, get(head.files, c.path));
    const revertState: MergeState = {
      kind: "revert",
      theirs: id,
      branch: id,
      message,
      unmerged: Object.fromEntries(conflicts.map((c) => [c.path, c.kind])),
      touched: allPaths(head.files, tree).filter((p) => get(head.files, p) !== get(tree, p)),
    };
    const output = [
      ...autoMerged.map((p) => `Auto-merging ${p}`),
      ...conflictLines(conflicts, theirsLabel),
      conflictHints(id, subject),
    ].join("\n");
    return failure(
      { ...state, workdir: moved.workdir, repo: { ...repo, index, merge: revertState } },
      output,
      msg.revertConflict(id, conflicts.map((c) => c.path)),
    );
  }

  // উল্টানোর পরও কিছু বদলায়নি (যেমন আগেই উল্টানো হয়েছে): আসল Git status দেখিয়ে থামে
  if (sameFiles(result, head.files)) {
    return failure(state, formatStatus(getStatus(state, repo)), msg.revertNothing(id));
  }

  const time = state.clock + 1;
  const newId = makeCommitId(repo, `${time}:${head.id}:revert:${id}`);
  const revertCommit: Commit = { id: newId, message, parents: [head.id], files: result, time, branch: repo.head, ...authorField(repo) };
  const changes = treeChanges(head.files, result);
  const next: SimState = {
    ...state,
    clock: time,
    workdir: moved.workdir,
    repo: {
      ...repo,
      index: moved.index,
      commits: { ...repo.commits, [newId]: revertCommit },
      branches: { ...repo.branches, [repo.head]: newId },
    },
  };
  const output = [
    ...autoMerged.map((p) => `Auto-merging ${p}`),
    `[${repo.head} ${newId}] Revert "${subject}"`,
    summaryLine(changes),
    ...modeLines(changes),
  ].join("\n");
  return success(next, output, msg.revertDone(id, newId));
};
