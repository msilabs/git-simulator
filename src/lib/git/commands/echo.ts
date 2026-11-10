import type { CommandHandler } from "../types";
import { failure, get, isValidFileName, setFile, success } from "../helpers";
import { msg } from "../messages";

/**
 * `echo <লেখা>` (সহায়ক কমান্ড): লেখাটা দেখায়।
 * `echo <লেখা> > <file>` ফাইলের লেখা বদলে দেয়, `>> <file>` শেষে নতুন লাইন হিসেবে যোগ করে।
 * সরলীকরণ: `>` বা `>>` আলাদা শব্দ হিসেবে (বা ফাইলের নামের সাথে লাগিয়ে, যেমন `>>notes.txt`) লিখতে হয়;
 * কোটের ভেতরের `>`-কেও সিমুলেটর redirect ধরে। `-n`, `-e` নেই।
 */
export const echo: CommandHandler = (state, args) => {
  const at = args.findIndex((a) => a.startsWith(">"));
  if (at < 0) return success(state, args.join(" "), msg.echoShown);

  const op = args[at].startsWith(">>") ? ">>" : ">";
  const attached = args[at].slice(op.length);
  const rest = attached ? args.slice(at + 1) : args.slice(at + 2);
  const name = attached || args[at + 1];
  if (!name) return failure(state, "echo: syntax error near unexpected token `newline'", msg.echoMissingFile);
  if (rest.length) return failure(state, `error: unsupported in simulator: ${rest[0]}`, msg.unsupportedOption(rest[0]));
  if (!isValidFileName(name)) return failure(state, `echo: ${name}: Invalid file name`, msg.invalidFileName(name));

  const text = args.slice(0, at).join(" ");
  const existing = get(state.workdir, name);
  const content = op === ">>" && existing ? `${existing}\n${text}` : text;
  if (existing === content) return success(state, "", msg.editSame(name));
  const tracked = state.repo ? get(state.repo.index, name) !== undefined : false;
  return success(
    { ...state, workdir: setFile(state.workdir, name, content) },
    "",
    existing === undefined ? msg.editCreated(name) : op === ">>" ? msg.echoAppended(name, tracked) : msg.editChanged(name, tracked),
  );
};
