import type { CommandHandler, Commit, SimState } from "../types";
import { failure, get, has, headCommit, isAncestor, isValidBranchName, PROJECT_PATH, success, trackingRef } from "../helpers";
import { msg } from "../messages";

type Result = ReturnType<CommandHandler>;

/** remote-tracking branch-এর লাইন: "origin/HEAD -> origin/main", "origin/main" ... (`prefix` -a-তে "remotes/") */
function remoteLines(state: SimState, prefix: string): string[] {
  const repo = state.repo!;
  if (!repo.remote) return [];
  const r = repo.remote.name;
  const lines = Object.keys(repo.tracking).map((b) => ({ key: b, text: `  ${prefix}${r}/${b}` }));
  if (repo.remote.head && has(repo.tracking, repo.remote.head)) {
    lines.push({ key: "HEAD", text: `  ${prefix}${r}/HEAD -> ${r}/${repo.remote.head}` });
  }
  return lines.sort((a, b) => (a.key < b.key ? -1 : 1)).map((l) => l.text);
}

function list(state: SimState, which: "local" | "remote" | "all"): Result {
  const repo = state.repo!;
  const names = which === "remote" ? [] : Object.keys(repo.branches).sort();
  const local = names.map((b) => (b === repo.head ? `* ${b}` : `  ${b}`));
  const remote = which === "local" ? [] : remoteLines(state, which === "all" ? "remotes/" : "");
  const lines = [...local, ...remote];
  // প্রথম commit-এর আগে আসল Git-ও কিছু দেখায় না।
  if (lines.length === 0) return success(state, "", which === "remote" ? msg.branchListNoRemote : msg.branchListEmpty);
  return success(state, lines.join("\n"), which === "local" ? msg.branchList(repo.head) : msg.branchListRemote);
}

/** `git branch --set-upstream-to=origin/main [<branch>]` বা `-u origin/main [<branch>]` */
function setUpstream(state: SimState, target: string, branchArg: string | undefined): Result {
  const repo = state.repo!;
  const branch = branchArg ?? repo.head;
  if (!has(repo.branches, branch)) return failure(state, `fatal: branch '${branch}' does not exist`, msg.branchNotFound(branch));
  if (!repo.remote || trackingRef(repo, target) === undefined) {
    return failure(
      state,
      `fatal: the requested upstream branch '${target}' does not exist`,
      msg.branchUpstreamMissing(target),
    );
  }
  const remoteBranch = target.replace(/^remotes\//, "").slice(repo.remote.name.length + 1);
  return success(
    { ...state, repo: { ...repo, upstream: { ...repo.upstream, [branch]: remoteBranch } } },
    `branch '${branch}' set up to track '${repo.remote.name}/${remoteBranch}'.`,
    msg.pushTracking(branch, repo.remote.name),
  );
}

function create(state: SimState, name: string): Result {
  const repo = state.repo!;
  if (!isValidBranchName(name)) {
    return failure(state, `fatal: '${name}' is not a valid branch name`, msg.branchInvalid(name));
  }
  if (has(repo.branches, name) || name === repo.head) {
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
    const id = get(repo.branches, name);
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
    const upstream = { ...repo.upstream };
    delete upstream[name];
    repo = { ...repo, branches, upstream };
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
  const isUnbornHead = from === repo.head && !has(repo.branches, from);
  if (!has(repo.branches, from) && !isUnbornHead) {
    return failure(state, `error: refname refs/heads/${from} not found\nfatal: Branch rename failed`, msg.branchNotFound(from));
  }
  if (!isValidBranchName(to)) return failure(state, `fatal: '${to}' is not a valid branch name`, msg.branchInvalid(to));
  if (from === to) return success(state, "", msg.branchRenamed(from, to));
  if (has(repo.branches, to) && !force) {
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
  const upstream: Record<string, string> = {};
  for (const [name, up] of Object.entries(repo.upstream)) {
    if (name !== to) upstream[name === from ? to : name] = up;
  }
  return success(
    { ...state, repo: { ...repo, branches, commits, upstream, head: repo.head === from ? to : repo.head } },
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
  if (args.length === 1 && (first === "-r" || first === "--remotes")) return list(state, "remote");
  if (args.length === 1 && (first === "-a" || first === "--all")) return list(state, "all");
  if (first?.startsWith("--set-upstream-to=")) return setUpstream(state, first.slice("--set-upstream-to=".length), rest[0]);
  if ((first === "-u" || first === "--set-upstream-to") && rest[0]) return setUpstream(state, rest[0], rest[1]);
  if (first === "-d" || first === "--delete") return remove(state, rest, false);
  if (first === "-D") return remove(state, rest, true);
  if (first === "-m" || first === "--move") return rename(state, rest, false);
  if (first === "-M") return rename(state, rest, true);

  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (args.length === 0) return list(state, "local");
  if (args.length > 1) return failure(state, "fatal: too many arguments", msg.branchTooMany);
  return create(state, first);
};
