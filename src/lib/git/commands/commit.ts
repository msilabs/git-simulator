import type { CommandHandler, Commit } from "../types";
import {
  failure,
  headCommit,
  headTree,
  makeCommitId,
  modeLines,
  sameFiles,
  success,
  summaryLine,
  treeChanges,
  unmergedPaths,
  UNMERGED_ERROR,
} from "../helpers";
import { msg } from "../messages";
import { formatStatus, getStatus } from "./status";

/**
 * `git commit -m "message"`
 * index-এর পুরো স্ন্যাপশট নিয়ে নতুন commit বানায়, parent হয় বর্তমান HEAD commit,
 * আর বর্তমান branch নতুন commit-এ এগিয়ে যায়।
 * সরলীকরণ: `-m` ছাড়া এডিটর খোলে না; `-a`, `--amend` ইত্যাদি নেই; author সবসময় একই।
 */
export const commit: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const messages: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-m" || a === "--message") {
      if (i + 1 >= args.length) return failure(state, `error: switch \`m' requires a value`, msg.commitMissingValue);
      messages.push(args[++i]);
    } else if (a.startsWith("--message=")) {
      messages.push(a.slice("--message=".length));
    } else if (a.startsWith("-m") && a.length > 2) {
      messages.push(a.slice(2)); // -m"msg" লিখলেও আসল Git মেনে নেয়
    } else {
      return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    }
  }

  const parent = headCommit(repo);

  // conflict-এ থেমে থাকা merge শেষ করা
  if (repo.merge) {
    const unmerged = unmergedPaths(repo);
    if (unmerged.length) return failure(state, UNMERGED_ERROR("Committing"), msg.commitUnmerged(unmerged));
    // আসল Git এখানে MERGE_MSG দিয়ে এডিটর খোলে; সিমুলেটর -m না দিলে সেই মেসেজই নেয়।
    const message = messages.map((m) => m.trim()).filter(Boolean).join("\n\n") || repo.merge.message;
    const time = state.clock + 1;
    const id = makeCommitId(repo, `${time}:${parent!.id}:${repo.merge.theirs}:${message}`);
    const mergeCommit: Commit = {
      id,
      message,
      parents: [parent!.id, repo.merge.theirs],
      files: repo.index,
      time,
      branch: repo.head,
    };
    return success(
      {
        ...state,
        clock: time,
        repo: {
          ...repo,
          merge: null,
          commits: { ...repo.commits, [id]: mergeCommit },
          branches: { ...repo.branches, [repo.head]: id },
        },
      },
      `[${repo.head} ${id}] ${message.split("\n")[0]}`,
      msg.commitMergeDone(id, repo.head, repo.merge.branch),
    );
  }

  // আসল Git আগে দেখে commit করার কিছু আছে কি না, তারপর মেসেজ চায়।
  if (sameFiles(repo.index, headTree(repo))) {
    const info = getStatus(state, repo);
    const explanation =
      info.unstaged.length || info.untracked.length ? msg.commitNothing : msg.commitNothingClean;
    return failure(state, formatStatus(info), explanation);
  }

  if (messages.length === 0) {
    return failure(state, "error: no commit message given (use -m \"message\")", msg.commitNeedsMessage);
  }
  // একাধিক -m আলাদা অনুচ্ছেদ হয়, আসল Git-এর মতো।
  const message = messages.map((m) => m.trim()).filter(Boolean).join("\n\n");
  if (!message) return failure(state, "Aborting commit due to empty commit message.", msg.commitEmptyMessage);

  const time = state.clock + 1;
  const id = makeCommitId(repo, `${time}:${parent?.id ?? ""}:${message}`);
  const newCommit: Commit = {
    id,
    message,
    parents: parent ? [parent.id] : [],
    files: repo.index,
    time,
    branch: repo.head,
  };

  const changes = treeChanges(parent?.files ?? {}, repo.index);
  const subject = message.split("\n")[0];
  const output = [
    `[${repo.head}${parent ? "" : " (root-commit)"} ${id}] ${subject}`,
    summaryLine(changes),
    ...modeLines(changes),
  ].join("\n");

  const explanation = msg.commitDone(id, repo.head) + (parent ? "" : "\n" + msg.commitFirst);
  return success(
    {
      ...state,
      clock: time,
      repo: {
        ...repo,
        commits: { ...repo.commits, [id]: newCommit },
        branches: { ...repo.branches, [repo.head]: id },
      },
    },
    output,
    explanation,
  );
};
