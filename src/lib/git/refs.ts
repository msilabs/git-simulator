/**
 * commit, branch আর ইতিহাস নিয়ে কাজ: HEAD, পূর্বপুরুষ, merge base, commit id, নাম যাচাই।
 */
import type { Commit, ConflictKind, FileMap, MergeState, Repo } from "./types";
import { get, has } from "./own";

/** HEAD যে commit-কে দেখাচ্ছে (প্রথম commit-এর আগে null)। */
export function headCommit(repo: Repo): Commit | null {
  const id = get(repo.branches, repo.head);
  return id ? repo.commits[id] : null;
}

/** HEAD commit-এর ফাইলগুলো (commit না থাকলে খালি)। */
export function headTree(repo: Repo): FileMap {
  return headCommit(repo)?.files ?? {};
}

/**
 * revision-এর লেখাকে commit id-তে আনে; না পারলে null।
 * চলে: HEAD (বা @), branch-এর নাম, remote-tracking branch (`origin/main`, `remotes/origin/main`),
 * commit id (অন্তত ৪ অক্ষরের অনন্য শুরুটুকুও),
 * আর তার পরে ~, ~2, ^, ^2 (^2 মানে merge commit-এর দ্বিতীয় parent)।
 * branch থেকে পৌঁছানো যায় না এমন commit-ও id দিয়ে পাওয়া যায় (reset-এর পর ফেরার জন্য)।
 */
export function resolveRev(repo: Repo, rev: string): string | null {
  const m = /^([^~^]+)((?:[~^]\d*)*)$/.exec(rev);
  if (!m) return null;
  const [, name, suffix] = m;
  let id: string | undefined;
  if (name === "HEAD" || name === "@") id = get(repo.branches, repo.head);
  else if (has(repo.branches, name)) id = repo.branches[name];
  else if (trackingRef(repo, name) !== undefined) id = trackingRef(repo, name);
  else if (/^[0-9a-f]{4,7}$/.test(name)) {
    const matches = Object.keys(repo.commits).filter((c) => c.startsWith(name));
    if (matches.length === 1) id = matches[0];
  }
  if (!id) return null;
  for (const [, op, digits] of suffix.matchAll(/([~^])(\d*)/g)) {
    const n = digits === "" ? 1 : Number(digits);
    if (op === "~") {
      for (let i = 0; i < n && id; i++) id = repo.commits[id].parents[0];
    } else if (n > 0) {
      id = repo.commits[id].parents[n - 1];
    }
    if (!id) return null;
  }
  return id;
}

/** `git config user.name/email` দেওয়া থাকলে নতুন commit-এর লেখক; নাহলে কিছু না (ডিফল্ট শিক্ষার্থী) */
export function authorField(repo: Repo): { author?: string } {
  const name = get(repo.config, "user.name");
  const email = get(repo.config, "user.email");
  if (name === undefined && email === undefined) return {};
  return { author: `${name ?? "Learner"} <${email ?? "learner@example.com"}>` };
}

/** "origin/main" বা "remotes/origin/main" → সেই remote-tracking ref-এর commit */
export function trackingRef(repo: Repo, name: string): string | undefined {
  if (!repo.remote) return undefined;
  const prefix = `${repo.remote.name}/`;
  const short = name.startsWith("remotes/") ? name.slice("remotes/".length) : name;
  if (!short.startsWith(prefix)) return undefined;
  const branch = short.slice(prefix.length);
  if (branch === "HEAD") return repo.remote.head ? get(repo.tracking, repo.remote.head) : undefined;
  return get(repo.tracking, branch);
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

/** `local`-এ আছে কিন্তু `remote`-এ নেই (ahead), আর উল্টোটা (behind): এমন commit কয়টা */
export function aheadBehind(repo: Repo, local: string, remote: string): { ahead: number; behind: number } {
  const mine = ancestors(repo, local);
  const theirs = ancestors(repo, remote);
  return {
    ahead: [...mine].filter((id) => !theirs.has(id)).length,
    behind: [...theirs].filter((id) => !mine.has(id)).length,
  };
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

/**
 * conflict মেটানোর পর নতুন merge অবস্থা। stash-এর conflict-এ আলাদা কোনো চলমান কাজ নেই,
 * তাই শেষ ফাইল মিটলে অবস্থাটাই মুছে যায়।
 */
export function withUnmerged(repo: Repo, unmerged: Readonly<Record<string, ConflictKind>>): MergeState | null {
  if (!repo.merge) return null;
  if (repo.merge.kind === "stash" && Object.keys(unmerged).length === 0) return null;
  return { ...repo.merge, unmerged };
}

/** merge conflict চলাকালীন এখনো মেটানো হয়নি এমন ফাইলের নাম */
export function unmergedPaths(repo: Repo): string[] {
  return Object.keys(repo.merge?.unmerged ?? {}).sort();
}

/* ---------- branch আর ফাইলের নাম যাচাই ---------- */

/**
 * আসল `git check-ref-format`-এর মূল নিয়মগুলো। সব নিয়ম নয়, তবে নতুনদের
 * সাধারণ ভুলগুলো ধরে।
 * সরলীকরণ: আসল Git "__proto__" নামও মানে; সিমুলেটরে JavaScript object-এ এই নাম রাখা যায় না।
 */
export function isValidBranchName(name: string): boolean {
  if (!name || name === "__proto__" || name.startsWith("-") || name.startsWith("/") || name.endsWith("/")) return false;
  if (name.endsWith(".") || name.endsWith(".lock") || name === "@" || name === "HEAD") return false;
  if (name.includes("..") || name.includes("//") || name.includes("@{")) return false;
  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) return false;
  return name.split("/").every((part) => part !== "" && !part.startsWith("."));
}

/**
 * সিমুলেটরে ফোল্ডার নেই, তাই ফাইলের নাম সমতল: "/" চলবে না, ".git" চলবে না।
 * "__proto__" JavaScript object-এ রাখা যায় না বলে সেটাও না।
 */
export function isValidFileName(name: string): boolean {
  if (!name || name === "." || name === ".." || name === ".git" || name === "__proto__") return false;
  if (name.startsWith("-")) return false;
  return !/[/\\\s\x00-\x1f]/.test(name);
}
