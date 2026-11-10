import type { CommandHandler } from "../types";
import { failure, success } from "../helpers";
import { msg } from "../messages";

/**
 * `git remote`, `git remote -v`, `git remote add <name> <url>`, `git remote remove <name>`
 * নতুন remote শুরুতে খালি, যেমন GitHub-এ সদ্য বানানো রিপোজিটরি; প্রথমবার `git push -u` দিয়ে পাঠাতে হয়।
 * সরলীকরণ: একটাই remote রাখা যায়; URL-এ আসলে কোনো সার্ভার নেই।
 */
export const remote: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const [sub, ...rest] = args;
  if (sub === undefined) return success(state, repo.remote?.name ?? "", repo.remote ? msg.remoteList(repo.remote.name) : msg.remoteNone);
  if (sub === "-v" || sub === "--verbose") {
    if (!repo.remote) return success(state, "", msg.remoteNone);
    const { name, url } = repo.remote;
    return success(state, `${name}\t${url} (fetch)\n${name}\t${url} (push)`, msg.remoteVerbose(name));
  }
  if (sub === "add") {
    if (rest.length !== 2) return failure(state, "usage: git remote add <name> <url>", msg.remoteAddUsage);
    const [name, url] = rest;
    if (repo.remote?.name === name) return failure(state, `error: remote ${name} already exists.`, msg.remoteExists(name));
    if (repo.remote) return failure(state, "error: unsupported in simulator: more than one remote", msg.remoteOnlyOne(repo.remote.name));
    return success(
      { ...state, repo: { ...repo, remote: { name, url, branches: {}, head: null }, tracking: {}, upstream: {} } },
      "",
      msg.remoteAdded(name),
    );
  }
  if (sub === "remove" || sub === "rm") {
    if (rest.length !== 1) return failure(state, "usage: git remote remove <name>", msg.remoteAddUsage);
    if (repo.remote?.name !== rest[0]) return failure(state, `error: No such remote: '${rest[0]}'`, msg.remoteUnknown(rest[0]));
    return success({ ...state, repo: { ...repo, remote: null, tracking: {}, upstream: {} } }, "", msg.remoteRemoved(rest[0]));
  }
  return failure(state, `error: unsupported in simulator: git remote ${sub}`, msg.unsupportedOption(sub));
};
