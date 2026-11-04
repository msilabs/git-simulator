import { describe, expect, it } from "vitest";
import { layoutGraph, LANE_COLORS } from "../src/lib/graph/layout";
import { repoOf, state, ONE_COMMIT } from "./setup";

describe("graph layout", () => {
  it("shows at most three labels per commit and grows the top padding", () => {
    const one = layoutGraph(repoOf(state(ONE_COMMIT)));
    const many = layoutGraph(repoOf(state([...ONE_COMMIT, "git branch a", "git branch b", "git branch c", "git branch d"])));
    expect(many.labels.map((l) => l.branch)).toEqual(["main", "a", "+3"]);
    expect(many.labels[2].hidden).toEqual(["b", "c", "d"]);
    expect(many.padTop).toBeGreaterThan(one.padTop);
    // সবচেয়ে ওপরের লেবেলও SVG-র ভেতরে থাকে (y >= 0)
    const topLabelY = many.padTop - 13 - 10 - 20 - 2 * 24;
    expect(topLabelY).toBeGreaterThanOrEqual(0);
  });

  it("is empty without commits", () => {
    expect(layoutGraph(null).nodes).toEqual([]);
    expect(layoutGraph(repoOf(state(["git init"]))).nodes).toEqual([]);
  });

  it("puts branch commits in their own lane and draws two edges into a merge commit", () => {
    const repo = repoOf(
      state([
        ...ONE_COMMIT,
        "git switch -c feature",
        'edit f "f"',
        "git add .",
        'git commit -m "f"',
        "git switch main",
        'edit m "m"',
        "git add .",
        'git commit -m "m"',
        "git merge feature",
      ]),
    );
    const g = layoutGraph(repo);
    expect(g.lanes).toBe(2);
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 1, 0, 0]);
    expect(g.nodes[1].color).toBe(LANE_COLORS[1]);
    const merge = g.nodes[3];
    expect(merge.isMerge).toBe(true);
    expect(g.edges.filter((e) => e.key.endsWith(merge.id))).toHaveLength(2);
    const head = g.labels.find((l) => l.isHead)!;
    expect(head.branch).toBe("main");
    expect(head.commitId).toBe(merge.id);
  });

  it("keeps commits in place after a fast-forward and moves only the label", () => {
    const repo = repoOf(
      state([...ONE_COMMIT, "git switch -c feature", 'edit f "f"', "git add .", 'git commit -m "f"', "git switch main", "git merge feature"]),
    );
    const g = layoutGraph(repo);
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 1]);
    const labels = g.labels.filter((l) => l.commitId === g.nodes[1].id).map((l) => [l.branch, l.stack]);
    expect(labels).toEqual([["main", 0], ["feature", 1]]);
  });
});
