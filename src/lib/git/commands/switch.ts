import type { CommandHandler, FileMap, SimState } from "../types";
import { allPaths, failure, headTree, isValidBranchName, moveTree, success } from "../helpers";
import { msg } from "../messages";

type Verb = "switch" | "checkout";

/** branch বদলের পর যে commit না করা পরিবর্তন সঙ্গে রয়ে গেল ("M\tfile" লাইনের জন্য)। */
function carriedChanges(workdir: FileMap, index: FileMap, tree: FileMap): string[] {
  const lines: string[] = [];
  for (const p of allPaths(tree, index)) {
    if (index[p] !== tree[p]) lines.push(`${!(p in tree) ? "A" : !(p in index) ? "D" : "M"}\t${p}`);
    else if (p in index && workdir[p] !== index[p]) lines.push(`${p in workdir ? "M" : "D"}\t${p}`);
  }
  return lines;
}

function create(state: SimState, name: string): ReturnType<CommandHandler> {
  const repo = state.repo!;
  if (!isValidBranchName(name)) {
    return failure(state, `fatal: '${name}' is not a valid branch name`, msg.branchInvalid(name));
  }
  if (repo.branches[name] || name === repo.head) {
    return failure(state, `fatal: a branch named '${name}' already exists`, msg.branchExists(name));
  }
  const headId = repo.branches[repo.head];
  // প্রথম commit-এর আগে নতুন branch মানে শুধু HEAD-এর নাম বদল (আসল Git-এও তাই)।
  const branches = headId ? { ...repo.branches, [name]: headId } : repo.branches;
  return success(
    { ...state, repo: { ...repo, branches, head: name } },
    `Switched to a new branch '${name}'`,
    msg.switchCreated(name),
  );
}

function switchTo(state: SimState, name: string, verb: Verb): ReturnType<CommandHandler> {
  const repo = state.repo!;
  if (name === repo.head) return success(state, `Already on '${name}'`, msg.switchAlready(name));

  const targetId = repo.branches[name];
  if (!targetId) {
    if (verb === "checkout" && (name in state.workdir || name in repo.index)) {
      return failure(state, `error: unsupported in simulator: git checkout ${name}`, msg.checkoutIsFile(name));
    }
    return verb === "switch"
      ? failure(state, `fatal: invalid reference: ${name}`, msg.switchNotFound(name))
      : failure(state, `error: pathspec '${name}' did not match any file(s) known to git`, msg.switchNotFound(name));
  }

  const target = repo.commits[targetId].files;
  const moved = moveTree(state.workdir, repo.index, headTree(repo), target);
  if (!moved.ok) {
    const files = moved.paths.map((p) => `\t${p}`).join("\n");
    return moved.reason === "local-changes"
      ? failure(
          state,
          `error: Your local changes to the following files would be overwritten by checkout:\n${files}\nPlease commit your changes or stash them before you switch branches.\nAborting`,
          msg.switchBlocked(moved.paths),
        )
      : failure(
          state,
          `error: The following untracked working tree files would be overwritten by checkout:\n${files}\nPlease move or remove them before you switch branches.\nAborting`,
          msg.switchBlockedUntracked(moved.paths),
        );
  }

  const carried = carriedChanges(moved.workdir, moved.index, target);
  const output = [...carried, `Switched to branch '${name}'`].join("\n");
  const explanation =
    msg.switchDone(name, targetId) +
    (carried.length ? "\n" + msg.switchCarried(carried.map((l) => l.slice(2))) : "");
  return success(
    { ...state, workdir: moved.workdir, repo: { ...repo, index: moved.index, head: name } },
    output,
    explanation,
  );
}

/**
 * `git switch <name>` / `git switch -c <name>` আর `git checkout <name>` / `git checkout -b <name>`
 * সরলীকরণ: commit id বা ফাইলের নাম দিয়ে checkout (detached HEAD / restore) নেই।
 */
function makeHandler(verb: Verb): CommandHandler {
  const createFlags = verb === "switch" ? ["-c", "--create"] : ["-b"];
  return (state, args) => {
    if (args.length === 0) {
      return verb === "switch"
        ? failure(state, "fatal: missing branch or commit argument", msg.switchMissingArg)
        : failure(state, "", msg.switchMissingArg);
    }
    const [first, second, ...rest] = args;
    if (createFlags.includes(first)) {
      if (second === undefined) {
        return failure(state, `error: switch \`${first.replace(/^-+/, "")}' requires a value`, msg.switchCreateMissing(first));
      }
      if (rest.length) return failure(state, `error: unsupported in simulator: ${rest[0]}`, msg.unsupportedOption(rest[0]));
      return create(state, second);
    }
    if (first.startsWith("-")) return failure(state, `error: unsupported in simulator: ${first}`, msg.unsupportedOption(first));
    if (second !== undefined) return failure(state, `error: unsupported in simulator: ${second}`, msg.unsupportedOption(second));
    return switchTo(state, first, verb);
  };
}

export const switchCmd = makeHandler("switch");
export const checkout = makeHandler("checkout");
