/**
 * টার্মিনালের Tab-completion (আসল bash-এর মতো), React ছাড়া pure function।
 * কোন শব্দের জায়গায় কী সাজেস্ট হবে তা কমান্ড দেখে ঠিক হয়: কমান্ডের নাম, git-এর subcommand,
 * ফাইল, branch, stash, বা অপশন।
 */
import type { Repo, SimState } from "./types";
import { allPaths, get, headTree } from "./helpers";
import { tokenize } from "./parser";
import { GIT_COMMANDS, SHELL_COMMANDS } from "./commands";

export interface Completion {
  /** কার্সরের আগের লেখা, completion বসানোর পর */
  readonly text: string;
  /** যতগুলো মিল পাওয়া গেছে (দুইবার Tab দিলে এগুলোর তালিকা দেখায়) */
  readonly candidates: readonly string[];
}

/** সিমুলেটরে চলে এমন অপশনগুলো, subcommand অনুযায়ী */
const OPTIONS: Readonly<Record<string, readonly string[]>> = {
  add: ["--all"],
  commit: ["--all", "--amend", "--message", "--no-edit"],
  log: ["--all", "--graph", "--oneline"],
  branch: ["--delete", "--move"],
  switch: ["--create"],
  merge: ["--abort", "--continue"],
  diff: ["--cached", "--staged"],
  restore: ["--staged", "--worktree"],
  rm: ["--cached", "--force", "--recursive"],
  reset: ["--hard", "--mixed", "--soft"],
  revert: ["--abort", "--continue", "--no-edit", "--skip"],
  push: ["--force", "--set-upstream"],
  pull: ["--ff-only", "--no-rebase"],
  config: ["--global", "--list"],
};

const STASH_SUBCOMMANDS = ["apply", "clear", "drop", "list", "pop", "push"];

const branches = (repo: Repo) => Object.keys(repo.branches).sort();
const remoteRefs = (repo: Repo) => (repo.remote ? Object.keys(repo.tracking).sort().map((b) => `${repo.remote!.name}/${b}`) : []);
const tracked = (repo: Repo) => Object.keys(repo.index).sort();

/** working directory-তে বদলানো, মোছা বা untracked ফাইল, আর conflict চলা ফাইল (`git add`-এর জন্য) */
function changedFiles(state: SimState, repo: Repo): string[] {
  return allPaths(state.workdir, repo.index, repo.merge?.unmerged ?? {}).filter(
    (p) => get(state.workdir, p) !== get(repo.index, p) || get(repo.merge?.unmerged ?? {}, p) !== undefined,
  );
}

/** staging area-তে আছে কিন্তু শেষ commit থেকে আলাদা এমন ফাইল */
function stagedFiles(repo: Repo): string[] {
  const head = headTree(repo);
  return allPaths(repo.index, head).filter((p) => get(repo.index, p) !== get(head, p));
}

/** আগের শব্দগুলো দেখে, এই জায়গায় কোন কোন শব্দ বসতে পারে */
function choices(state: SimState, words: readonly string[], current: string): string[] {
  const files = Object.keys(state.workdir).sort();
  if (words.length === 0) return ["git", ...Object.keys(SHELL_COMMANDS)].sort();

  const [program, sub] = words;
  if (program === "echo") return [">", ">>"].includes(words[words.length - 1]) ? files : [];
  if (program === "teammate") return files;
  if (program !== "git") return ["edit", "cat", "rm", "touch"].includes(program) ? files : [];
  if (words.length === 1) return Object.keys(GIT_COMMANDS).sort();

  const repo = state.repo;
  if (!repo) return [];
  if (current.startsWith("-")) return [...(get(OPTIONS, sub) ?? [])];
  const rest = words.slice(2);
  switch (sub) {
    case "add":
      return changedFiles(state, repo);
    case "restore":
      return rest.includes("--staged") || rest.includes("-S")
        ? stagedFiles(repo)
        : tracked(repo).filter((p) => get(state.workdir, p) !== repo.index[p]);
    case "rm":
      return tracked(repo);
    case "diff":
      return rest.includes("--staged") || rest.includes("--cached")
        ? stagedFiles(repo)
        : tracked(repo).filter((p) => get(state.workdir, p) !== repo.index[p]);
    case "switch":
    case "checkout": {
      if (rest.some((w) => ["-c", "-b", "--create"].includes(w))) return [];
      // origin/<নাম> থেকে নতুন branch বানানো যায়, তাই সেই নামগুলোও
      const fromRemote = Object.keys(repo.tracking).filter((b) => get(repo.branches, b) === undefined);
      return [...new Set([...branches(repo), ...fromRemote])].sort();
    }
    case "merge":
      return [...branches(repo).filter((b) => b !== repo.head), ...remoteRefs(repo)];
    case "push":
    case "pull":
    case "fetch":
      if (!repo.remote) return [];
      if (rest.filter((w) => !w.startsWith("-")).length === 0) return [repo.remote.name];
      return sub === "push" ? branches(repo) : Object.keys(repo.remote.branches).sort();
    case "remote":
      return rest.length === 0 ? ["add", "remove"] : [];
    case "config":
      return rest.filter((w) => !w.startsWith("-")).length === 0 ? ["pull.rebase", "user.email", "user.name"] : [];
    case "branch":
      return rest.some((w) => ["-d", "-D", "-m", "-M", "--delete", "--move"].includes(w)) ? branches(repo) : [];
    case "reset":
      return rest.includes("--") ? tracked(repo) : ["HEAD", ...branches(repo), ...remoteRefs(repo)];
    case "revert":
    case "show":
      return ["HEAD", ...branches(repo), ...remoteRefs(repo)];
    case "stash":
      if (rest.length === 0) return STASH_SUBCOMMANDS;
      return ["pop", "apply", "drop"].includes(rest[0]) ? repo.stash.map((_, i) => `stash@{${i}}`) : [];
    default:
      return [];
  }
}

function commonPrefix(items: readonly string[]): string {
  let prefix = items[0];
  for (const item of items) while (!item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}

/**
 * কার্সরের আগের লেখা (`before`) নিয়ে শেষ শব্দটা পূর্ণ করার চেষ্টা করে।
 * - একটাই মিল: পুরো শব্দ, সাথে একটা স্পেস
 * - কয়েকটা মিল: যতটুকু সবার মধ্যে এক, ততটুকু
 * - কোনো মিল নেই, বা কোট খোলা আছে: null
 */
export function complete(state: SimState, before: string): Completion | null {
  const { tokens, unclosed } = tokenize(before);
  if (unclosed) return null;
  const endsWithSpace = before === "" || /\s$/.test(before);
  const current = endsWithSpace ? "" : tokens[tokens.length - 1];
  const words = endsWithSpace ? tokens : tokens.slice(0, -1);
  // কোট বা escape দেওয়া শব্দে লেখা আর শব্দ মেলে না; সেখানে completion করি না
  if (!before.endsWith(current)) return null;

  const candidates = choices(state, words, current).filter((c) => c.startsWith(current));
  if (candidates.length === 0) return null;
  const head = before.slice(0, before.length - current.length);
  if (candidates.length === 1) return { text: `${head}${candidates[0]} `, candidates };
  return { text: head + commonPrefix(candidates), candidates };
}
