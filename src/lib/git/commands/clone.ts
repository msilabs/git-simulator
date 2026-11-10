import type { CommandHandler, Commit, FileMap, Repo, SimState } from "../types";
import { failure, makeCommitId, success } from "../helpers";
import { msg } from "../messages";

const TEAMMATE = "Teammate <teammate@example.com>";

/** clone করলে যে নমুনা প্রজেক্ট আসে: main-এ ৩টা commit, আর একটা feature branch */
const DEMO: readonly { message: string; files: FileMap; branch: string; parent?: number }[] = [
  { message: "Initial commit", branch: "main", files: { "README.md": "# Demo project\nA small website for practising Git." } },
  {
    message: "Add homepage",
    branch: "main",
    parent: 0,
    files: { "README.md": "# Demo project\nA small website for practising Git.", "index.html": "<h1>Welcome</h1>\n<p>Hello!</p>" },
  },
  {
    message: "Add styles",
    branch: "main",
    parent: 1,
    files: {
      "README.md": "# Demo project\nA small website for practising Git.",
      "index.html": "<h1>Welcome</h1>\n<p>Hello!</p>",
      "style.css": "h1 { color: teal; }",
    },
  },
  {
    message: "Add about page",
    branch: "feature/about",
    parent: 2,
    files: {
      "README.md": "# Demo project\nA small website for practising Git.",
      "index.html": "<h1>Welcome</h1>\n<p>Hello!</p>",
      "style.css": "h1 { color: teal; }",
      "about.html": "<h1>About us</h1>",
    },
  },
];

/** URL-এর শেষ অংশ থেকে ফোল্ডারের নাম, আসল Git-এর মতো (".git" বাদ) */
const folderName = (url: string) => url.replace(/\/+$/, "").split(/[/:]/).pop()!.replace(/\.git$/, "") || "repo";

/**
 * `git clone <url> [<folder>]`: remote রিপোজিটরির পুরো ইতিহাস নামিয়ে নতুন রিপো বানায়।
 * সরলীকরণ: কোনো সার্ভার নেই, যেকোনো URL দিলে একই নমুনা প্রজেক্ট আসে; আর ফোল্ডার একটাই বলে
 * নতুন ফোল্ডার না বানিয়ে এখানেই আসে (আসল Git `<folder>` বানায়, তারপর `cd` করতে হয়)।
 */
export const clone: CommandHandler = (state, args) => {
  const option = args.find((a) => a.startsWith("-"));
  if (option) return failure(state, `error: unsupported in simulator: ${option}`, msg.unsupportedOption(option));
  if (args.length === 0 || args.length > 2) return failure(state, "fatal: You must specify a repository to clone.", msg.cloneUsage);
  if (state.repo) return failure(state, "error: unsupported in simulator: git clone inside a repository", msg.cloneInsideRepo);
  if (Object.keys(state.workdir).length) return failure(state, "error: unsupported in simulator: git clone into a folder with files", msg.cloneNotEmpty);

  const [url, folder] = args;
  const empty: Repo = { commits: {}, branches: {}, head: "main", index: {}, merge: null, stash: [], remote: null, tracking: {}, upstream: {}, config: {} };
  const commits: Record<string, Commit> = {};
  const ids: string[] = [];
  DEMO.forEach((d, i) => {
    const parents = d.parent === undefined ? [] : [ids[d.parent]];
    const id = makeCommitId({ ...empty, commits }, `clone:${url}:${i}:${d.message}`);
    commits[id] = { id, message: d.message, parents, files: d.files, time: state.clock + i + 1, branch: d.branch, author: TEAMMATE };
    ids.push(id);
  });
  const main = ids[2];
  const remoteBranches = { main, "feature/about": ids[3] };
  const files = commits[main].files;
  const next: SimState = {
    workdir: files,
    clock: state.clock + DEMO.length,
    repo: {
      ...empty,
      commits,
      branches: { main },
      index: files,
      remote: { name: "origin", url, branches: remoteBranches, head: "main" },
      tracking: remoteBranches,
      upstream: { main: "main" },
    },
  };
  return success(next, `Cloning into '${folder ?? folderName(url)}'...`, msg.cloneDone(folder ?? folderName(url)));
};
