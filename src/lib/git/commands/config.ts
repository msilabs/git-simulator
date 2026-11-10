import type { CommandHandler } from "../types";
import { failure, get, has, success } from "../helpers";
import { msg } from "../messages";

const KNOWN: Readonly<Record<string, (value: string) => boolean>> = {
  "user.name": () => true,
  "user.email": () => true,
  "pull.rebase": (v) => v === "true" || v === "false",
  "pull.ff": (v) => v === "only" || v === "true" || v === "false",
};

/**
 * `git config [--global] <key> [<value>]`, `git config --list`
 * সরলীকরণ: শুধু user.name, user.email, pull.rebase আর pull.ff; `--global` আর রিপোর নিজের সেটিং একই জায়গায় থাকে।
 */
export const config: CommandHandler = (state, args) => {
  const repo = state.repo!;
  const global = args.includes("--global") || args.includes("--local");
  const words = args.filter((a) => a !== "--global" && a !== "--local");
  if (words[0] === "--list" || words[0] === "-l") {
    const lines = Object.entries(repo.config).map(([k, v]) => `${k}=${v}`);
    return success(state, lines.join("\n"), lines.length ? msg.configList : msg.configEmpty);
  }
  const option = words.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (words.length === 0 || words.length > 2) return failure(state, "usage: git config [--global] <name> [<value>]", msg.configUsage);

  const [key, value] = words;
  if (!has(KNOWN, key)) return failure(state, `error: unsupported in simulator: ${key}`, msg.configUnknown(key));
  if (value === undefined) {
    const current = get(repo.config, key);
    return current === undefined ? failure(state, "", msg.configUnset(key)) : success(state, current, msg.configShown(key));
  }
  if (!KNOWN[key](value)) return failure(state, `fatal: bad boolean config value '${value}' for '${key}'`, msg.configBadValue(key));
  if (get(repo.config, key) === value) return success(state, "", msg.configSet(key, value, global));
  return success({ ...state, repo: { ...repo, config: { ...repo.config, [key]: value } } }, "", msg.configSet(key, value, global));
};
