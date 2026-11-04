/**
 * কয়েকটা কমান্ডে লাগে এমন সাধারণ pure function।
 */
import type { Commit, FileMap, Repo, SimState, CommandResult } from "./types";

/** সিমুলেটরের নকল প্রজেক্ট ফোল্ডার (git init-এর আউটপুটে দেখায়)। */
export const PROJECT_PATH = "/home/learner/project";

/* ---------- ফলাফল বানানোর ছোট হেল্পার ---------- */

export function success(state: SimState, output: string, explanation: string): CommandResult {
  return { state, output, explanation, ok: true };
}

export function failure(state: SimState, output: string, explanation: string): CommandResult {
  return { state, output, explanation, ok: false };
}

/* ---------- FileMap হেল্পার ---------- */

export function setFile(files: FileMap, name: string, content: string | undefined): FileMap {
  const next: Record<string, string> = { ...files };
  if (content === undefined) delete next[name];
  else next[name] = content;
  return next;
}

export function sameFiles(a: FileMap, b: FileMap): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => k in b && a[k] === b[k]);
}

export function allPaths(...maps: FileMap[]): string[] {
  const set = new Set<string>();
  for (const m of maps) for (const k of Object.keys(m)) set.add(k);
  return [...set].sort();
}

/* ---------- repo হেল্পার ---------- */

/** HEAD যে commit-কে দেখাচ্ছে (প্রথম commit-এর আগে null)। */
export function headCommit(repo: Repo): Commit | null {
  const id = repo.branches[repo.head];
  return id ? repo.commits[id] : null;
}

/** HEAD commit-এর ফাইলগুলো (commit না থাকলে খালি)। */
export function headTree(repo: Repo): FileMap {
  return headCommit(repo)?.files ?? {};
}

/** একটা commit আর তার সব পূর্বপুরুষের id। */
export function ancestors(repo: Repo, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...repo.commits[cur].parents);
  }
  return seen;
}

/** a কি b-এর পূর্বপুরুষ (বা একই commit)? */
export function isAncestor(repo: Repo, a: string, b: string): boolean {
  return ancestors(repo, b).has(a);
}

/**
 * দুই commit-এর merge base: দুজনেরই পূর্বপুরুষ এমন commit-গুলোর মধ্যে সবচেয়ে নতুনটা।
 * সরলীকরণ: আসল Git একাধিক "best common ancestor" থাকলে সেগুলো মিলিয়ে নেয়
 * (recursive/ort)। v1-এর সাধারণ ইতিহাসে এমন হয় না বলে আমরা শুধু সবচেয়ে নতুনটা নিই।
 */
export function mergeBase(repo: Repo, a: string, b: string): string | null {
  const ancA = ancestors(repo, a);
  let best: Commit | null = null;
  for (const id of ancestors(repo, b)) {
    if (!ancA.has(id)) continue;
    const c = repo.commits[id];
    if (!best || c.time > best.time) best = c;
  }
  return best?.id ?? null;
}

/**
 * ৭ অক্ষরের hex id। আসল Git commit-এর কনটেন্টের SHA-1 নেয়; আমরা একটা ছোট
 * FNV-1a hash ব্যবহার করি আর আগে থেকে থাকা id-এর সাথে মিলে গেলে আবার চেষ্টা করি,
 * যাতে একই সেশনে id অনন্য থাকে।
 */
export function makeCommitId(repo: Repo, seed: string): string {
  for (let attempt = 0; ; attempt++) {
    let h = 0x811c9dc5;
    const text = `${seed}#${attempt}`;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // আরও এক দফা মিশিয়ে ৭ hex অক্ষর (২৮ বিট) নিই।
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
    const id = (h >>> 4).toString(16).padStart(7, "0").slice(-7);
    if (!repo.commits[id]) return id;
  }
}

/* ---------- লাইনভিত্তিক diff ---------- */

/**
 * ফাইলের লেখাকে লাইনে ভাঙে।
 * সরলীকরণ: ফাইলের শেষে newline আছে কি না সিমুলেটর আলাদা করে দেখে না
 * (আসল Git "\ No newline at end of file" দেখায়)।
 */
export function splitLines(content: string | undefined): string[] {
  if (content === undefined || content === "") return [];
  const parts = content.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

export function joinLines(lines: readonly string[]): string {
  return lines.join("\n");
}

/** LCS টেবিল: dp[i][j] = a[i..] আর b[j..]-এর longest common subsequence-এর দৈর্ঘ্য */
function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

export interface DiffOp {
  readonly op: " " | "-" | "+";
  readonly line: string;
}

/** a থেকে b-তে যেতে কোন লাইন থাকল, বাদ গেল বা যোগ হলো। ফাইল ছোট, তাই O(n·m) চলবে। */
export function diffOps(a: readonly string[], b: readonly string[]): DiffOp[] {
  const dp = lcsTable(a, b);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ op: " ", line: a[i++] });
      j++;
    } else if (i < a.length && (j === b.length || dp[i + 1][j] >= dp[i][j + 1])) {
      // সমান হলে আগে মোছা লাইন, আসল Git-এর মতো "-" তারপর "+"
      ops.push({ op: "-", line: a[i++] });
    } else {
      ops.push({ op: "+", line: b[j++] });
    }
  }
  return ops;
}

/** a-র প্রতিটা লাইনের জন্য b-তে মিলে যাওয়া লাইনের index, না মিললে -1 (diff3-এর জন্য)। */
export function lcsMatch(a: readonly string[], b: readonly string[]): number[] {
  const match: number[] = new Array(a.length).fill(-1);
  let i = 0;
  let j = 0;
  for (const op of diffOps(a, b)) {
    if (op.op === " ") match[i++] = j++;
    else if (op.op === "-") i++;
    else j++;
  }
  return match;
}

export function lineDiff(before: string | undefined, after: string | undefined) {
  let insertions = 0;
  let deletions = 0;
  for (const op of diffOps(splitLines(before), splitLines(after))) {
    if (op.op === "+") insertions++;
    else if (op.op === "-") deletions++;
  }
  return { insertions, deletions };
}

export interface FileChange {
  readonly path: string;
  readonly kind: "added" | "modified" | "deleted";
  readonly insertions: number;
  readonly deletions: number;
}

export function treeChanges(from: FileMap, to: FileMap): FileChange[] {
  const changes: FileChange[] = [];
  for (const path of allPaths(from, to)) {
    if (from[path] === to[path]) continue;
    const kind = !(path in from) ? "added" : !(path in to) ? "deleted" : "modified";
    changes.push({ path, kind, ...lineDiff(from[path], to[path]) });
  }
  return changes;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** আসল Git-এর মতো সারাংশ: " 2 files changed, 3 insertions(+), 1 deletion(-)" */
export function summaryLine(changes: FileChange[]): string {
  const ins = changes.reduce((s, c) => s + c.insertions, 0);
  const del = changes.reduce((s, c) => s + c.deletions, 0);
  let line = ` ${plural(changes.length, "file")} changed`;
  if (ins === 0 && del === 0) return `${line}, 0 insertions(+), 0 deletions(-)`;
  if (ins > 0) line += `, ${ins} ${ins === 1 ? "insertion" : "insertions"}(+)`;
  if (del > 0) line += `, ${del} ${del === 1 ? "deletion" : "deletions"}(-)`;
  return line;
}

/** নতুন/মোছা ফাইলের জন্য "create mode 100644 x" লাইন। */
export function modeLines(changes: FileChange[]): string[] {
  return changes
    .filter((c) => c.kind !== "modified")
    .map((c) => ` ${c.kind === "added" ? "create" : "delete"} mode 100644 ${c.path}`);
}

/** merge-এর আউটপুটের মতো প্রতি ফাইলের লাইন: " index.html | 2 +-" */
export function diffstatLines(changes: FileChange[]): string[] {
  const width = Math.max(0, ...changes.map((c) => c.path.length));
  return changes.map((c) => {
    const n = c.insertions + c.deletions;
    const bar = "+".repeat(c.insertions) + "-".repeat(c.deletions);
    return ` ${c.path.padEnd(width)} | ${n}${bar ? " " + bar : ""}`;
  });
}

/**
 * diff-এর "index abc1234..def5678" লাইনের জন্য ফাইলের লেখার ছোট id।
 * সরলীকরণ: আসল blob hash নয়; তবে খালি ফাইলের জন্য আসল Git-এর মতোই e69de29।
 */
export function blobId(content: string | undefined): string {
  if (content === undefined) return "0000000";
  if (content === "") return "e69de29";
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  return (h >>> 4).toString(16).padStart(7, "0").slice(-7);
}

/** merge conflict চলাকালীন এখনো মেটানো হয়নি এমন ফাইলের নাম */
export function unmergedPaths(repo: Repo): string[] {
  return Object.keys(repo.merge?.unmerged ?? {}).sort();
}

/** conflict মেটানো বাকি থাকলে merge/commit-এর আসল Git এরর */
export const UNMERGED_ERROR = (verb: "Merging" | "Committing") =>
  `error: ${verb} is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.`;

/* ---------- branch আর ফাইলের নাম যাচাই ---------- */

/**
 * আসল `git check-ref-format`-এর মূল নিয়মগুলো। সব নিয়ম নয়, তবে নতুনদের
 * সাধারণ ভুলগুলো ধরে।
 */
export function isValidBranchName(name: string): boolean {
  if (!name || name.startsWith("-") || name.startsWith("/") || name.endsWith("/")) return false;
  if (name.endsWith(".") || name.endsWith(".lock") || name === "@" || name === "HEAD") return false;
  if (name.includes("..") || name.includes("//") || name.includes("@{")) return false;
  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) return false;
  return name.split("/").every((part) => part !== "" && !part.startsWith("."));
}

/**
 * সিমুলেটরে ফোল্ডার নেই, তাই ফাইলের নাম সমতল: "/" চলবে না, ".git" চলবে না।
 */
export function isValidFileName(name: string): boolean {
  if (!name || name === "." || name === ".." || name === ".git") return false;
  if (name.startsWith("-")) return false;
  return !/[/\\\s\x00-\x1f]/.test(name);
}

/* ---------- branch বদলানো বা merge-এর সময় ফাইল হালনাগাদ ---------- */

export type TreeUpdate =
  | { readonly ok: true; readonly workdir: FileMap; readonly index: FileMap }
  | { readonly ok: false; readonly reason: "local-changes" | "untracked"; readonly paths: string[] };

/**
 * working directory আর index-কে `current` tree থেকে `target` tree-তে নেয়,
 * আসল Git-এর "two-way merge" নিয়মে:
 *  - যে ফাইল দুই tree-তে একই, তাতে commit না করা পরিবর্তন থাকলে সেটা সঙ্গে থেকে যায়;
 *  - যে ফাইল দুই tree-তে আলাদা, তাতে commit না করা পরিবর্তন থাকলে কাজ আটকে যায়
 *    (নাহলে পরিবর্তন মুছে যেত);
 *  - target-এ আছে এমন নামের untracked ফাইল থাকলেও আটকায়।
 */
export function moveTree(
  workdir: FileMap,
  index: FileMap,
  current: FileMap,
  target: FileMap,
): TreeUpdate {
  const blocked: string[] = [];
  const untracked: string[] = [];
  let nextWork = workdir;
  let nextIndex = index;

  for (const path of allPaths(current, target, index, workdir)) {
    if (current[path] === target[path]) continue; // এই ফাইল বদলাবে না; পরিবর্তন থাকলে থাকুক
    const tracked = path in current || path in index;
    if (!tracked) {
      // এখানে পৌঁছালে ফাইলটা শুধু target-এ আছে।
      if (path in workdir) {
        // হুবহু একই লেখা হলে আসল Git-ও আপত্তি করে না; ফাইলটা তখন tracked হয়ে যায়।
        if (workdir[path] !== target[path]) untracked.push(path);
        else nextIndex = setFile(nextIndex, path, target[path]);
      } else {
        nextWork = setFile(nextWork, path, target[path]);
        nextIndex = setFile(nextIndex, path, target[path]);
      }
      continue;
    }
    if (index[path] !== current[path] || workdir[path] !== current[path]) {
      blocked.push(path);
      continue;
    }
    nextWork = setFile(nextWork, path, target[path]);
    nextIndex = setFile(nextIndex, path, target[path]);
  }

  if (blocked.length) return { ok: false, reason: "local-changes", paths: blocked };
  if (untracked.length) return { ok: false, reason: "untracked", paths: untracked };
  return { ok: true, workdir: nextWork, index: nextIndex };
}
