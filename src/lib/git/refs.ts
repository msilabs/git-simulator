/**
 * commit, branch আর ইতিহাস নিয়ে কাজ: HEAD, পূর্বপুরুষ, merge base, commit id, নাম যাচাই।
 */
import type { Commit, FileMap, Repo } from "./types";
import { get } from "./own";

/** HEAD যে commit-কে দেখাচ্ছে (প্রথম commit-এর আগে null)। */
export function headCommit(repo: Repo): Commit | null {
  const id = get(repo.branches, repo.head);
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
