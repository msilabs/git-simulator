import type { CommandHandler } from "../types";
import { failure, isValidFileName, setFile, success } from "../helpers";
import { msg } from "../messages";

/**
 * `edit <file> "লেখা"` (সহায়ক কমান্ড, Git নয়)
 * ফাইলের পুরো লেখা বদলে দেয়; ফাইল না থাকলে বানায়। লেখার ভেতরে `\n` নতুন লাইন হয়।
 * কোট ছাড়া কয়েকটা শব্দ দিলে সেগুলো স্পেস দিয়ে জুড়ে নেওয়া হয়।
 */
export const edit: CommandHandler = (state, args) => {
  if (args.length < 2) return failure(state, 'usage: edit <file> "text"', msg.editUsage);
  const [name, ...words] = args;
  if (!isValidFileName(name)) return failure(state, `edit: '${name}': Invalid file name`, msg.invalidFileName(name));

  const content = words.join(" ").replace(/\\n/g, "\n");
  const existed = name in state.workdir;
  if (existed && state.workdir[name] === content) return success(state, "", msg.editSame(name));

  const tracked = state.repo ? name in state.repo.index : false;
  return success(
    { ...state, workdir: setFile(state.workdir, name, content) },
    "",
    existed ? msg.editChanged(name, tracked) : msg.editCreated(name),
  );
};
