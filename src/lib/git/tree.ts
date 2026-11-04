/**
 * ফাইলের স্ন্যাপশট (FileMap) নিয়ে কাজ: তুলনা, পরিসংখ্যান, আর branch বদল বা merge-এর সময়
 * working directory আর index হালনাগাদ।
 */
import type { FileMap } from "./types";
import { lineDiff } from "./lines";

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

/**
 * branch বদল বা merge আটকালে আসল Git-এর এরর লেখা ("would be overwritten by checkout/merge")।
 */
export function overwrittenError(
  paths: readonly string[],
  reason: "local-changes" | "untracked",
  action: "checkout" | "merge",
): string {
  const files = paths.map((p) => `\t${p}`).join("\n");
  const verb = action === "checkout" ? "switch branches" : "merge";
  return reason === "local-changes"
    ? `error: Your local changes to the following files would be overwritten by ${action}:\n${files}\nPlease commit your changes or stash them before you ${verb}.\nAborting`
    : `error: The following untracked working tree files would be overwritten by ${action}:\n${files}\nPlease move or remove them before you ${verb}.\nAborting`;
}
