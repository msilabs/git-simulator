/**
 * লাইনভিত্তিক তুলনা: LCS দিয়ে কোন লাইন থাকল, বাদ গেল বা যোগ হলো।
 * diff, merge3 আর commit-এর "insertions/deletions" গোনায় লাগে।
 */
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
