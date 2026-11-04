import type { CommandHandler } from "../types";
import { failure, setFile, success } from "../helpers";
import { msg } from "../messages";

/**
 * `rm <file>...` (সহায়ক কমান্ড, Git নয়): ফোল্ডার থেকে ফাইল মোছে।
 * Git-এর হিসাবে এটা "deleted" বদল; commit-এ নিতে `git add <file>`।
 * সরলীকরণ: ফোল্ডার নেই, তাই `-r` লাগে না।
 */
export const rm: CommandHandler = (state, args) => {
  const names = args.filter((a) => !/^-[rRf]+$/.test(a)); // -f, -r, -rf মেনে নিই
  if (names.length === 0) return failure(state, "rm: missing operand", msg.rmMissingArg);
  const missing = names.find((n) => !(n in state.workdir));
  if (missing) return failure(state, `rm: cannot remove '${missing}': No such file or directory`, msg.rmMissing(missing));
  let workdir = state.workdir;
  for (const n of names) workdir = setFile(workdir, n, undefined);
  const tracked = names.some((n) => state.repo && n in state.repo.index);
  return success({ ...state, workdir }, "", msg.rmDone(names, tracked));
};
