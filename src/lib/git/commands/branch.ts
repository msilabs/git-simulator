import type { CommandHandler, Commit, SimState } from "../types";
import { failure, headCommit, isAncestor, isValidBranchName, PROJECT_PATH, success } from "../helpers";
import { msg } from "../messages";

type Result = ReturnType<CommandHandler>;

function list(state: SimState): Result {
  const repo = state.repo!;
  const names = Object.keys(repo.branches).sort();
  // প্রথম commit-এর আগে আসল Git-ও কিছু দেখায় না।
  if (names.length === 0) return success(state, "", msg.branchListEmpty);
  const output = names.map((b) => (b === repo.head ? `* ${b}` : `  ${b}`)).join("\n");
  return success(state, output, msg.branchList(repo.head));
}

function create(state: SimState, name: string): Result {
  const repo = state.repo!;
  if (!isValidBranchName(name)) {
    return failure(state, `fatal: '${name}' is not a valid branch name`, msg.branchInvalid(name));
  }
  if (repo.branches[name] || name === repo.head) {
    return failure(state, `fatal: a branch named '${name}' already exists`, msg.branchExists(name));
  }
  const head = headCommit(repo);
  if (!head) return failure(state, `fatal: not a valid object name: '${repo.head}'`, msg.branchNoCommit);
  return success(
    { ...state, repo: { ...repo, branches: { ...repo.branches, [name]: head.id } } },
    "",
    msg.branchCreated(name, head.id, repo.head),
  );
}

/**
 * `git branch -d <name>...` / `-D` (জোর করে)
 * আসল Git-এর মতো -d শুধু তখনই মোছে, যখন branch-টা বর্তমান HEAD-এ merge করা আছে।
 * সরলীকরণ: আসল Git upstream branch-এর সাথেও মিলিয়ে দেখে; সিমুলেটরে remote নেই।
 */
function remove(state: SimState, names: string[], force: boolean): Result {
  if (names.length === 0) return failure(state, "fatal: branch name required", msg.branchDeleteMissing);
  let repo = state.repo!;
  const out: string[] = [];
  const explain: string[] = [];
  for (const name of names) {
    const id = repo.branches[name];
    if (name === repo.head) {
      return failure(
        { ...state, repo },
        [...out, `error: cannot delete branch '${name}' used by worktree at '${PROJECT_PATH}'`].join("\n"),
        msg.branchDeleteCurrent(name),
      );
    }
    if (!id) return failure({ ...state, repo }, [...out, `error: branch '${name}' not found`].join("\n"), msg.branchNotFound(name));
    const head = headCommit(repo);
    const merged = head ? isAncestor(repo, id, head.id) : false;
    if (!force && !merged) {
      return failure(
        { ...state, repo },
        [...out, `error: the branch '${name}' is not fully merged`, `hint: If you are sure you want to delete it, run 'git branch -D ${name}'`].join("\n"),
        msg.branchNotMerged(name),
      );
    }
    const branches = { ...repo.branches };
    delete branches[name];
    repo = { ...repo, branches };
    out.push(`Deleted branch ${name} (was ${id}).`);
    explain.push(merged ? msg.branchDeleted(name, id) : msg.branchForceDeleted(name, id));
  }
  return success({ ...state, repo }, out.join("\n"), explain.join("\n"));
}

/**
 * `git branch -m [<old>] <new>` / `-M` (নতুন নামের branch থাকলেও জোর করে)
 * commit-এর `branch` তথ্যও নতুন নামে বদলাই, যাতে গ্রাফে লেন একই থাকে।
 */
function rename(state: SimState, args: string[], force: boolean): Result {
  const repo = state.repo!;
  if (args.length === 0 || args.length > 2) return failure(state, "fatal: branch name required", msg.branchRenameMissing);
  const [from, to] = args.length === 1 ? [repo.head, args[0]] : [args[0], args[1]];
  const isUnbornHead = from === repo.head && !repo.branches[from];
  if (!repo.branches[from] && !isUnbornHead) {
    return failure(state, `error: refname refs/heads/${from} not found\nfatal: Branch rename failed`, msg.branchNotFound(from));
  }
  if (!isValidBranchName(to)) return failure(state, `fatal: '${to}' is not a valid branch name`, msg.branchInvalid(to));
  if (from === to) return success(state, "", msg.branchRenamed(from, to));
  if (repo.branches[to] && !force) {
    return failure(state, `fatal: a branch named '${to}' already exists`, msg.branchExists(to));
  }
  if (to === repo.head && force) {
    return failure(state, `fatal: cannot force update the branch '${to}' used by worktree at '${PROJECT_PATH}'`, msg.branchDeleteCurrent(to));
  }

  const branches: Record<string, string> = {};
  for (const [name, id] of Object.entries(repo.branches)) {
    if (name === to) continue;
    branches[name === from ? to : name] = id;
  }
  const commits: Record<string, Commit> = {};
  for (const [id, c] of Object.entries(repo.commits)) commits[id] = c.branch === from ? { ...c, branch: to } : c;
  return success(
    { ...state, repo: { ...repo, branches, commits, head: repo.head === from ? to : repo.head } },
    "",
    msg.branchRenamed(from, to),
  );
}

/**
 * `git branch`: তালিকা; `git branch <name>`: নতুন branch, বর্তমান commit-এ
 * `git branch -d|-D <name>`: মোছা; `git branch -m|-M [<old>] <new>`: নাম বদল
 * সরলীকরণ: `-a`, `-v`, `<start-point>` ইত্যাদি এখনো নেই।
 */
export const branch: CommandHandler = (state, args) => {
  const [first, ...rest] = args;
  if (first === "-d" || first === "--delete") return remove(state, rest, false);
  if (first === "-D") return remove(state, rest, true);
  if (first === "-m" || first === "--move") return rename(state, rest, false);
  if (first === "-M") return rename(state, rest, true);

  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (args.length === 0) return list(state);
  if (args.length > 1) return failure(state, "fatal: too many arguments", msg.branchTooMany);
  return create(state, first);
};
