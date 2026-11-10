import type { CommandHandler } from "../types";
import { failure, has, isValidFileName, setFile, success } from "../helpers";
import { msg } from "../messages";

/**
 * `touch <file>...` (সহায়ক কমান্ড, Git নয়)
 * খালি নতুন ফাইল বানায়। ফাইল আগে থাকলে লেখা বদলায় না (আসল touch শুধু সময় বদলায়)।
 */
export const touch: CommandHandler = (state, args) => {
  if (args.length === 0) return failure(state, "touch: missing file operand", msg.touchMissingArg);
  const bad = args.find((a) => !isValidFileName(a));
  if (bad) return failure(state, `touch: cannot touch '${bad}': Invalid file name`, msg.invalidFileName(bad));

  let workdir = state.workdir;
  const created: string[] = [];
  const existing: string[] = [];
  for (const name of args) {
    if (has(workdir, name)) existing.push(name);
    else {
      workdir = setFile(workdir, name, "");
      created.push(name);
    }
  }
  const explanation = [created.length ? msg.touchCreated(created) : "", existing.length ? msg.touchExists(existing) : ""]
    .filter(Boolean)
    .join("\n");
  // কিছু না বদলালে একই state ফেরত দিই, যাতে undo-র ইতিহাসে ফাঁকা ধাপ না জমে
  return success(created.length ? { ...state, workdir } : state, "", explanation);
};
