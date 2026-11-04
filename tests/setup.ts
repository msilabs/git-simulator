import { runCommand, runAll, EMPTY_STATE } from "../src/lib/git/repo";
import type { CommandResult, SimState } from "../src/lib/git/types";

/** কমান্ডগুলো পরপর চালিয়ে শেষ ফলাফল ফেরত দেয়। */
export function exec(lines: readonly string[], start: SimState = EMPTY_STATE): CommandResult {
  const before = runAll(lines.slice(0, -1), start);
  return runCommand(before, lines[lines.length - 1]);
}

export const state = (lines: readonly string[], start: SimState = EMPTY_STATE) => runAll(lines, start);

export const repoOf = (s: SimState) => {
  if (!s.repo) throw new Error("no repo");
  return s.repo;
};

/** HEAD যে commit-এ আছে */
export const headId = (s: SimState) => repoOf(s).branches[repoOf(s).head];

/** একটা commit সহ রিপো */
export const ONE_COMMIT = ["git init", 'edit index.html "hello"', "git add index.html", 'git commit -m "first commit"'];

export { runCommand, EMPTY_STATE };
