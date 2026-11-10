import type { CommandHandler, Commit, FileMap } from "../types";
import {
  failure,
  get,
  has,
  headCommit,
  headTree,
  makeCommitId,
  modeLines,
  sameFiles,
  success,
  setFile,
  summaryLine,
  treeChanges,
  unmergedPaths,
  UNMERGED_ERROR,
} from "../helpers";
import { msg } from "../messages";
import { formatStatus, getStatus } from "./status";
import { CONFLICT_MARKER } from "./add";

/**
 * `-a`: tracked প্রতিটা ফাইল ফোল্ডারের বর্তমান অবস্থায় আনে; নতুন untracked ফাইল বাদ।
 * conflict চলা ফাইলও tracked (আসল Git-এর index-এ এদের stage থাকে), তাই সেগুলোও যায়।
 */
function stageTracked(workdir: FileMap, index: FileMap, unmerged: readonly string[] = []): FileMap {
  let next = index;
  for (const p of new Set([...Object.keys(index), ...unmerged])) {
    const content = get(workdir, p);
    if (content !== get(index, p)) next = setFile(next, p, content);
  }
  return next;
}

/**
 * `git commit -m "message"`, `git commit -a -m "message"` (`-am` একসাথেও)
 * index-এর পুরো স্ন্যাপশট নিয়ে নতুন commit বানায়, parent হয় বর্তমান HEAD commit,
 * আর বর্তমান branch নতুন commit-এ এগিয়ে যায়। `-a` আগে tracked ফাইলের বদল নিজে থেকে stage করে।
 * সরলীকরণ: `-m` ছাড়া এডিটর খোলে না; `--amend` ইত্যাদি নেই; author সবসময় একই।
 */
export const commit: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const messages: string[] = [];
  let all = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--message") {
      if (i + 1 >= args.length) return failure(state, `error: option \`message' requires a value`, msg.commitMissingValue);
      messages.push(args[++i]);
    } else if (a.startsWith("--message=")) {
      messages.push(a.slice("--message=".length));
    } else if (a === "--all") {
      all = true;
    } else if (a.startsWith("-") && !a.startsWith("--") && a.length > 1) {
      // ছোট অপশন একসাথে লেখা যায়, আসল Git-এর মতো: -am "msg", -m"msg"
      for (let j = 1; j < a.length; j++) {
        const flag = a[j];
        if (flag === "a") {
          all = true;
        } else if (flag === "m") {
          const rest = a.slice(j + 1);
          if (rest) messages.push(rest);
          else if (i + 1 < args.length) messages.push(args[++i]);
          else return failure(state, `error: switch \`m' requires a value`, msg.commitMissingValue);
          break;
        } else {
          return failure(state, `error: unsupported in simulator: -${flag}`, msg.unsupportedOption(`-${flag}`));
        }
      }
    } else {
      return failure(state, `error: unsupported in simulator: ${a}`, msg.unsupportedOption(a));
    }
  }

  const parent = headCommit(repo);

  // conflict-এ থেমে থাকা merge শেষ করা
  if (repo.merge) {
    const unmerged = unmergedPaths(repo);
    // আসল Git-এর মতো `-a` conflict চলা ফাইলও stage করে, তাই আর আটকায় না (চিহ্নসহ হলেও)।
    if (unmerged.length && !all) return failure(state, UNMERGED_ERROR("Committing"), msg.commitUnmerged(unmerged));
    const index = all ? stageTracked(state.workdir, repo.index, unmerged) : repo.index;
    const markers = all ? unmerged.filter((p) => CONFLICT_MARKER.test(get(index, p) ?? "")) : [];
    // আসল Git এখানে MERGE_MSG দিয়ে এডিটর খোলে; সিমুলেটর -m না দিলে সেই মেসেজই নেয়।
    const message = messages.map((m) => m.trim()).filter(Boolean).join("\n\n") || repo.merge.message;
    const time = state.clock + 1;
    const id = makeCommitId(repo, `${time}:${parent!.id}:${repo.merge.theirs}:${message}`);
    const mergeCommit: Commit = {
      id,
      message,
      parents: [parent!.id, repo.merge.theirs],
      files: index,
      time,
      branch: repo.head,
    };
    return success(
      {
        ...state,
        clock: time,
        repo: {
          ...repo,
          index,
          merge: null,
          commits: { ...repo.commits, [id]: mergeCommit },
          branches: { ...repo.branches, [repo.head]: id },
        },
      },
      `[${repo.head} ${id}] ${message.split("\n")[0]}`,
      [msg.commitMergeDone(id, repo.head, repo.merge.branch), markers.length ? msg.commitWithMarkers(markers) : ""]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const index = all ? stageTracked(state.workdir, repo.index) : repo.index;
  const autoStaged = Object.keys(repo.index).filter((p) => get(index, p) !== repo.index[p]).sort();

  // আসল Git আগে দেখে commit করার কিছু আছে কি না, তারপর মেসেজ চায়।
  if (sameFiles(index, headTree(repo))) {
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
    files: index,
    time,
    branch: repo.head,
  };

  const changes = treeChanges(parent?.files ?? {}, index);
  const subject = message.split("\n")[0];
  const output = [
    `[${repo.head}${parent ? "" : " (root-commit)"} ${id}] ${subject}`,
    summaryLine(changes),
    ...modeLines(changes),
  ].join("\n");

  const untracked = Object.keys(state.workdir).filter((p) => !has(index, p)).sort();
  const explanation = [
    autoStaged.length ? msg.commitAll(autoStaged, untracked) : "",
    msg.commitDone(id, repo.head),
    parent ? "" : msg.commitFirst,
  ]
    .filter(Boolean)
    .join("\n");
  return success(
    {
      ...state,
      clock: time,
      repo: {
        ...repo,
        index,
        commits: { ...repo.commits, [id]: newCommit },
        branches: { ...repo.branches, [repo.head]: id },
      },
    },
    output,
    explanation,
  );
};
