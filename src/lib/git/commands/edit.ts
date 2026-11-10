import type { CommandHandler } from "../types";
import { failure, has, isValidFileName, setFile, success } from "../helpers";
import { msg } from "../messages";

/** লেখার ভেতরের `\n` নতুন লাইন আর `\\` একটা `\` হয় (বাঁ থেকে ডানে, তাই `\\n` মানে `\` আর n) */
const unescape = (text: string) => text.replace(/\\(\\|n)/g, (_, c: string) => (c === "n" ? "\n" : "\\"));

/**
 * ফাইলের পুরো লেখা বসানোর `edit` কমান্ড (FilePanel-এর এডিটর এটা চালায়)।
 * কোট আর `\` এমনভাবে লেখা হয় যাতে টার্মিনালের parser আর `edit` মিলে হুবহু একই লেখা পায়।
 */
export function editCommand(name: string, content: string): string {
  const escaped = content.replace(/\\/g, "\\\\\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `edit ${name} "${escaped}"`;
}

/**
 * `edit <file> "লেখা"` (সহায়ক কমান্ড, Git নয়)
 * ফাইলের পুরো লেখা বদলে দেয়; ফাইল না থাকলে বানায়। লেখার ভেতরে `\n` নতুন লাইন হয়।
 * কোট ছাড়া কয়েকটা শব্দ দিলে সেগুলো স্পেস দিয়ে জুড়ে নেওয়া হয়।
 */
export const edit: CommandHandler = (state, args) => {
  if (args.length < 2) return failure(state, 'usage: edit <file> "text"', msg.editUsage);
  const [name, ...words] = args;
  if (!isValidFileName(name)) return failure(state, `edit: '${name}': Invalid file name`, msg.invalidFileName(name));

  const content = unescape(words.join(" "));
  const existed = has(state.workdir, name);
  if (existed && state.workdir[name] === content) return success(state, "", msg.editSame(name));

  const tracked = state.repo ? has(state.repo.index, name) : false;
  return success(
    { ...state, workdir: setFile(state.workdir, name, content) },
    "",
    existed ? msg.editChanged(name, tracked) : msg.editCreated(name),
  );
};
