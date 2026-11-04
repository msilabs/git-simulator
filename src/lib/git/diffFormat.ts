/**
 * আসল `git diff`-এর মতো unified diff লেখা।
 */
import { blobId, diffOps, splitLines, type DiffOp } from "./helpers";

const CONTEXT = 3;

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  ops: DiffOp[];
}

function hunks(ops: DiffOp[]): Hunk[] {
  const result: Hunk[] = [];
  const changed = ops.map((o) => o.op !== " ");
  let k = 0;
  let oldLine = 0;
  let newLine = 0;
  // প্রতিটা op-এর আগে পুরোনো/নতুন ফাইলে কততম লাইনে আছি
  const posOld: number[] = [];
  const posNew: number[] = [];
  for (const o of ops) {
    posOld.push(oldLine);
    posNew.push(newLine);
    if (o.op !== "+") oldLine++;
    if (o.op !== "-") newLine++;
  }
  while (k < ops.length) {
    if (!changed[k]) {
      k++;
      continue;
    }
    const start = Math.max(0, k - CONTEXT);
    // মাঝে ২×CONTEXT বা তার কম অপরিবর্তিত লাইন থাকলে পরের বদলও একই hunk-এ (আসল Git-এর মতো)
    let end = k;
    while (end < ops.length) {
      if (changed[end]) {
        end++;
        continue;
      }
      let next = end;
      while (next < ops.length && !changed[next] && next - end < CONTEXT * 2) next++;
      if (next < ops.length && changed[next]) end = next;
      else break;
    }
    const stop = Math.min(ops.length, end + CONTEXT);
    const slice = ops.slice(start, stop);
    const oldCount = slice.filter((o) => o.op !== "+").length;
    const newCount = slice.filter((o) => o.op !== "-").length;
    result.push({
      // git: দৈর্ঘ্য ০ হলে শুরুর লাইন = তার আগের লাইন
      oldStart: oldCount === 0 ? posOld[start] : posOld[start] + 1,
      oldCount,
      newStart: newCount === 0 ? posNew[start] : posNew[start] + 1,
      newCount,
      ops: slice,
    });
    k = stop;
  }
  return result;
}

const range = (start: number, count: number) => (count === 1 ? `${start}` : `${start},${count}`);

/** একটা ফাইলের diff (before/after undefined মানে ফাইল নেই)। কোনো পার্থক্য না থাকলে খালি। */
export function fileDiff(path: string, before: string | undefined, after: string | undefined): string {
  if (before === after) return "";
  const lines = [`diff --git a/${path} b/${path}`];
  if (before === undefined) lines.push("new file mode 100644", `index 0000000..${blobId(after)}`);
  else if (after === undefined) lines.push("deleted file mode 100644", `index ${blobId(before)}..0000000`);
  else lines.push(`index ${blobId(before)}..${blobId(after)} 100644`);

  const ops = diffOps(splitLines(before), splitLines(after));
  if (!ops.some((o) => o.op !== " ")) return lines.join("\n"); // যেমন খালি নতুন ফাইল
  lines.push(before === undefined ? "--- /dev/null" : `--- a/${path}`);
  lines.push(after === undefined ? "+++ /dev/null" : `+++ b/${path}`);
  for (const h of hunks(ops)) {
    lines.push(`@@ -${range(h.oldStart, h.oldCount)} +${range(h.newStart, h.newCount)} @@`);
    for (const o of h.ops) lines.push(`${o.op}${o.line}`);
  }
  return lines.join("\n");
}
