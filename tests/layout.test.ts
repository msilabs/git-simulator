import { describe, expect, it } from "vitest";
import { layoutGraph, LANE_COLORS } from "../src/lib/graph/layout";
import { repoOf, state, ONE_COMMIT } from "./setup";

describe("graph layout", () => {
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
