/**
 * লাইন-স্তরের three-way merge (diff3 অ্যালগরিদম)।
 * base থেকে ours আর theirs দুই দিকের বদল মেলায়। একই অংশ দুই দিকে আলাদাভাবে বদলালে
 * conflict, আর ফাইলে আসল Git-এর মতো চিহ্ন বসে:
 *
 *   <<<<<<< HEAD
 *   আমাদের লাইন
 *   =======
 *   ওদের লাইন
 *   >>>>>>> feature
 *
 * সরলীকরণ: আসল Git (ort) diff-এর ফলাফল আরও কিছু কৌশলে ছোট করে আর `diff3`/`zdiff3`
 * স্টাইলও দেয়; আমরা শুধু ডিফল্ট "merge" স্টাইল দেখাই।
 */
import { joinLines, lcsMatch, splitLines } from "./helpers";

export interface Merge3Result {
  readonly content: string;
  readonly conflict: boolean;
}

const same = (x: readonly string[], y: readonly string[]) => x.length === y.length && x.every((l, i) => l === y[i]);

export function merge3(
  base: string,
  ours: string,
  theirs: string,
  oursLabel: string,
  theirsLabel: string,
): Merge3Result {
  const o = splitLines(base);
  const a = splitLines(ours);
  const b = splitLines(theirs);
  const ma = lcsMatch(o, a);
  const mb = lcsMatch(o, b);

  const out: string[] = [];
  let conflict = false;
  let io = 0;
  let ia = 0;
  let ib = 0;

  const emitChunk = (oc: string[], ac: string[], bc: string[]) => {
    if (same(ac, oc)) out.push(...bc); // শুধু ওরা বদলেছে
    else if (same(bc, oc)) out.push(...ac); // শুধু আমরা বদলেছি
    else if (same(ac, bc)) out.push(...ac); // দুজনেই একইভাবে বদলেছে
    else {
      conflict = true;
      out.push(`<<<<<<< ${oursLabel}`, ...ac, "=======", ...bc, `>>>>>>> ${theirsLabel}`);
    }
  };

  while (io < o.length || ia < a.length || ib < b.length) {
    // তিন দিকেই অপরিবর্তিত লাইন ("stable" অংশ)
    let k = 0;
    while (io + k < o.length && ma[io + k] === ia + k && mb[io + k] === ib + k) k++;
    if (k > 0) {
      out.push(...o.slice(io, io + k));
      io += k;
      ia += k;
      ib += k;
      continue;
    }
    // পরের যে base লাইন দুই দিকেই টিকে আছে, সেখান পর্যন্ত একটা "unstable" অংশ
    let j = io;
    while (j < o.length && (ma[j] === -1 || mb[j] === -1)) j++;
    if (j === o.length) {
      emitChunk(o.slice(io), a.slice(ia), b.slice(ib));
      break;
    }
    emitChunk(o.slice(io, j), a.slice(ia, ma[j]), b.slice(ib, mb[j]));
    io = j;
    ia = ma[j];
    ib = mb[j];
  }

  return { content: joinLines(out), conflict };
}
