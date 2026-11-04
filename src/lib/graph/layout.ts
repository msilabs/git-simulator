/**
 * commit গ্রাফের লেআউট (pure function, React ছাড়া)।
 * - x: commit-এর ক্রমিক সময় অনুযায়ী বাঁ থেকে ডানে
 * - শুধু কোনো branch থেকে পৌঁছানো যায় এমন commit দেখায়
 * - y (লেন): commit-টা যে branch-এ বানানো হয়েছিল তার লেন; প্রথম যে branch-এ
 *   commit হয়েছে সেটা লেন ০, পরেরটা ১ ...। তাই fast-forward-এর পরেও commit-গুলো
 *   নিজের জায়গায় থাকে, শুধু branch-এর লেবেল সরে যায়।
 */
import type { Repo } from "../git/types";
import { ancestors } from "../git/helpers";

export const LANE_COLORS = ["#1ED6A8", "#4F46E5", "#38BDF8", "#F472B6", "#A3E635"] as const;

export const GAP_X = 120;
export const GAP_Y = 104;
export const PAD_X = 64;
/** ওপরের ন্যূনতম ফাঁক; লেবেল বেশি হলে layout নিজে বাড়ায় (`padTop`) */
export const PAD_TOP = 70;
/** একই commit-এ এর বেশি branch হলে বাকিগুলো একটা "+N" চিপে যায় */
export const MAX_LABELS = 3;
export const LABEL_STEP = 24;
const NODE_CLEARANCE = 23;
export const PAD_BOTTOM = 56;

export interface NodeLayout {
  readonly id: string;
  readonly message: string;
  readonly x: number;
  readonly y: number;
  readonly lane: number;
  readonly color: string;
  readonly isMerge: boolean;
}

export interface EdgeLayout {
  readonly key: string;
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
  readonly color: string;
  /** merge commit-এর দ্বিতীয় parent-এর রেখা */
  readonly secondary: boolean;
}

export interface LabelLayout {
  readonly branch: string;
  readonly commitId: string;
  readonly isHead: boolean;
  readonly color: string;
  /** একই commit-এ একাধিক branch হলে কততম (০ = node-এর ঠিক ওপরে) */
  readonly stack: number;
  /** থাকলে এটা "+N" চিপ, যেখানে এই branch-গুলো লুকানো আছে */
  readonly hidden?: readonly string[];
}

export interface GraphLayout {
  readonly nodes: NodeLayout[];
  readonly edges: EdgeLayout[];
  readonly labels: LabelLayout[];
  readonly width: number;
  readonly height: number;
  readonly lanes: number;
  /** প্রথম লেনের y; লেবেলের স্তূপ যেন ওপরে কেটে না যায় */
  readonly padTop: number;
}

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

export function layoutGraph(repo: Repo | null): GraphLayout {
  // কোনো branch (বা চলমান merge) থেকে পৌঁছানো যায় না এমন commit লুকাই, যেমন `branch -D`-এর পর।
  // আসল Git-এও এগুলো `git log`-এ দেখা যায় না (পরে garbage collection মুছে ফেলে)।
  const reachable = new Set<string>();
  if (repo) {
    const tips = [...Object.values(repo.branches), ...(repo.merge ? [repo.merge.theirs] : [])];
    for (const tip of tips) for (const id of ancestors(repo, tip)) reachable.add(id);
  }
  const commits = repo
    ? Object.values(repo.commits)
        .filter((c) => reachable.has(c.id))
        .sort((a, b) => a.time - b.time)
    : [];
  if (!repo || commits.length === 0) {
    return { nodes: [], edges: [], labels: [], width: 0, height: 0, lanes: 0, padTop: PAD_TOP };
  }

  const laneOf = new Map<string, number>();
  for (const c of commits) if (!laneOf.has(c.branch)) laneOf.set(c.branch, laneOf.size);

  // প্রতিটা commit-এ কোন branch-গুলো: HEAD-এর branch আগে, বাকিগুলো বর্ণানুক্রমে
  const byCommit = new Map<string, string[]>();
  const branchNames = Object.keys(repo.branches).sort((a, b) =>
    a === repo.head ? -1 : b === repo.head ? 1 : a.localeCompare(b),
  );
  for (const name of branchNames) {
    const id = repo.branches[name];
    byCommit.set(id, [...(byCommit.get(id) ?? []), name]);
  }
  const visibleCount = (n: number) => Math.min(n, MAX_LABELS);
  const maxStack = Math.max(1, ...[...byCommit.values()].map((names) => visibleCount(names.length)));
  const padTop = Math.max(PAD_TOP, NODE_CLEARANCE + maxStack * LABEL_STEP + 16);

  const pos = new Map<string, NodeLayout>();
  const nodes = commits.map((c, i) => {
    const lane = laneOf.get(c.branch)!;
    const node: NodeLayout = {
      id: c.id,
      message: c.message.split("\n")[0],
      x: PAD_X + i * GAP_X,
      y: padTop + lane * GAP_Y,
      lane,
      color: laneColor(lane),
      isMerge: c.parents.length > 1,
    };
    pos.set(c.id, node);
    return node;
  });

  const edges: EdgeLayout[] = [];
  for (const c of commits) {
    const child = pos.get(c.id)!;
    c.parents.forEach((p, i) => {
      const parent = pos.get(p)!;
      edges.push({
        key: `${p}->${c.id}`,
        from: { x: parent.x, y: parent.y },
        to: { x: child.x, y: child.y },
        // নতুন লেনে শাখা বেরোলে সেই লেনের রং; merge-এর রেখা আসা branch-এর রং
        color: i === 0 ? child.color : parent.color,
        secondary: i > 0,
      });
    });
  }

  const labels: LabelLayout[] = [];
  for (const [id, names] of byCommit) {
    const node = pos.get(id)!;
    const shown = names.length > MAX_LABELS ? names.slice(0, MAX_LABELS - 1) : names;
    shown.forEach((name, stack) => {
      const lane = laneOf.get(name) ?? node.lane;
      labels.push({ branch: name, commitId: id, isHead: name === repo.head, color: laneColor(lane), stack });
    });
    if (shown.length < names.length) {
      const hidden = names.slice(shown.length);
      labels.push({ branch: `+${hidden.length}`, commitId: id, isHead: false, color: "#5B6782", stack: shown.length, hidden });
    }
  }

  const lanes = laneOf.size;
  return {
    nodes,
    edges,
    labels,
    width: PAD_X * 2 + (commits.length - 1) * GAP_X,
    height: padTop + (lanes - 1) * GAP_Y + PAD_BOTTOM,
    lanes,
    padTop,
  };
}
