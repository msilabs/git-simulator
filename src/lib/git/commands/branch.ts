import type { CommandHandler } from "../types";
import { failure, headCommit, isValidBranchName, success } from "../helpers";
import { msg } from "../messages";

/**
 * `git branch` (তালিকা) আর `git branch <name>` (নতুন branch, বর্তমান commit-এ)।
 * সরলীকরণ: `-d`, `-m`, `-a`, `<start-point>` ইত্যাদি এখনো নেই।
 */
export const branch: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));

  if (args.length === 0) {
    const names = Object.keys(repo.branches).sort();
    // প্রথম commit-এর আগে আসল Git-ও কিছু দেখায় না।
    if (names.length === 0) return success(state, "", msg.branchListEmpty);
    const output = names.map((b) => (b === repo.head ? `* ${b}` : `  ${b}`)).join("\n");
    return success(state, output, msg.branchList(repo.head));
  }
  if (args.length > 1) return failure(state, "fatal: too many arguments", msg.branchTooMany);

  const name = args[0];
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
};
