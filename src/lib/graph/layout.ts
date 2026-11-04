/**
 * commit গ্রাফের লেআউট (pure function, React ছাড়া)।
 * - x: commit-এর ক্রমিক সময় অনুযায়ী বাঁ থেকে ডানে
 * - y (লেন): commit-টা যে branch-এ বানানো হয়েছিল তার লেন; প্রথম যে branch-এ
 *   commit হয়েছে সেটা লেন ০, পরেরটা ১ ...। তাই fast-forward-এর পরেও commit-গুলো
 *   নিজের জায়গায় থাকে, শুধু branch-এর লেবেল সরে যায়।
 */
import type { Repo } from "../git/types";

export const LANE_COLORS = ["#1ED6A8", "#4F46E5", "#38BDF8", "#F472B6", "#A3E635"] as const;

export const GAP_X = 120;
export const GAP_Y = 104;
export const PAD_X = 64;
export const PAD_TOP = 70;
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
}

export interface GraphLayout {
  readonly nodes: NodeLayout[];
  readonly edges: EdgeLayout[];
  readonly labels: LabelLayout[];
  readonly width: number;
  readonly height: number;
  readonly lanes: number;
}

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

export function layoutGraph(repo: Repo | null): GraphLayout {
  const commits = repo ? Object.values(repo.commits).sort((a, b) => a.time - b.time) : [];
  if (!repo || commits.length === 0) {
    return { nodes: [], edges: [], labels: [], width: 0, height: 0, lanes: 0 };
  }

  const laneOf = new Map<string, number>();
  for (const c of commits) if (!laneOf.has(c.branch)) laneOf.set(c.branch, laneOf.size);

  const pos = new Map<string, NodeLayout>();
  const nodes = commits.map((c, i) => {
    const lane = laneOf.get(c.branch)!;
    const node: NodeLayout = {
      id: c.id,
      message: c.message.split("\n")[0],
      x: PAD_X + i * GAP_X,
      y: PAD_TOP + lane * GAP_Y,
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
  const stackCount = new Map<string, number>();
  const branchNames = Object.keys(repo.branches).sort((a, b) =>
    a === repo.head ? -1 : b === repo.head ? 1 : a.localeCompare(b),
  );
  for (const name of branchNames) {
    const id = repo.branches[name];
    const stack = stackCount.get(id) ?? 0;
    stackCount.set(id, stack + 1);
    const lane = laneOf.get(name) ?? pos.get(id)!.lane;
    labels.push({ branch: name, commitId: id, isHead: name === repo.head, color: laneColor(lane), stack });
  }

  const lanes = laneOf.size;
  return {
    nodes,
    edges,
    labels,
    width: PAD_X * 2 + (commits.length - 1) * GAP_X,
    height: PAD_TOP + (lanes - 1) * GAP_Y + PAD_BOTTOM,
    lanes,
  };
}
