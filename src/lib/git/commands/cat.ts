import type { CommandHandler } from "../types";
import { failure, success } from "../helpers";
import { msg } from "../messages";

/** `cat <file>...` (সহায়ক কমান্ড): ফাইলের লেখা দেখায়। */
export const cat: CommandHandler = (state, args) => {
  if (args.length === 0) return failure(state, "cat: missing file operand", msg.catMissingArg);
  const parts: string[] = [];
  for (const name of args) {
    if (!(name in state.workdir)) {
      return failure(state, `cat: ${name}: No such file or directory`, msg.catMissing(name));
    }
    parts.push(state.workdir[name]);
  }
  const output = parts.join("\n");
  const explanation = args.length === 1 && output === "" ? msg.catEmpty(args[0]) : msg.catShown(args.join(", "));
  return success(state, output, explanation);
};
