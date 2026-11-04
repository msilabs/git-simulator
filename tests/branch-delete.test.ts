import { describe, expect, it } from "vitest";
import { layoutGraph } from "../src/lib/graph/layout";
import { exec, repoOf, state, ONE_COMMIT } from "./setup";

const UNMERGED_FEATURE = [...ONE_COMMIT, "git switch -c feature", 'edit f "f"', "git add .", 'git commit -m "f"', "git switch main"];

describe("git branch -d / -D", () => {
  it("deletes a merged branch", () => {
    const s = state([...ONE_COMMIT, "git branch feature"]);
    const id = repoOf(s).branches.feature;
    const r = exec(["git branch -d feature"], s);
    expect(r.ok).toBe(true);
    expect(r.output).toBe(`Deleted branch feature (was ${id}).`);
    expect(repoOf(r.state).branches).toEqual({ main: id });
  });

  it("refuses to delete an unmerged branch with -d, deletes it with -D", () => {
    const s = state(UNMERGED_FEATURE);
    const r = exec(["git branch -d feature"], s);
    expect(r.ok).toBe(false);
    expect(r.output).toBe(
      "error: the branch 'feature' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D feature'",
    );
    const forced = exec(["git branch -D feature"], s);
    expect(forced.ok).toBe(true);
    expect("feature" in repoOf(forced.state).branches).toBe(false);
    // হারানো commit গ্রাফে আর দেখায় না
    expect(layoutGraph(repoOf(forced.state)).nodes).toHaveLength(1);
  });

  it("cannot delete the current branch or a missing one", () => {
    expect(exec([...ONE_COMMIT, "git branch -d main"]).output).toBe(
      "error: cannot delete branch 'main' used by worktree at '/home/learner/project'",
    );
    expect(exec([...ONE_COMMIT, "git branch -d nope"]).output).toBe("error: branch 'nope' not found");
    expect(exec([...ONE_COMMIT, "git branch -d"]).ok).toBe(false);
  });

  it("deletes several branches at once", () => {
    const r = exec([...ONE_COMMIT, "git branch a", "git branch b", "git branch -d a b"]);
    expect(Object.keys(repoOf(r.state).branches)).toEqual(["main"]);
  });
});

describe("git branch -m", () => {
  it("renames the current branch and keeps HEAD on it", () => {
    const r = exec([...ONE_COMMIT, "git branch -m trunk"]);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    expect(repo.head).toBe("trunk");
    expect(Object.keys(repo.branches)).toEqual(["trunk"]);
    expect(Object.values(repo.commits).every((c) => c.branch === "trunk")).toBe(true);
  });

  it("renames another branch and keeps its graph lane", () => {
    const s = state(UNMERGED_FEATURE);
    const r = exec(["git branch -m feature login"], s);
    const repo = repoOf(r.state);
    expect(Object.keys(repo.branches).sort()).toEqual(["login", "main"]);
    const lanes = (st: typeof s) => layoutGraph(repoOf(st)).nodes.map((n) => n.lane);
    expect(lanes(r.state)).toEqual(lanes(s));
  });

  it("renames the unborn branch before the first commit", () => {
    const r = exec(["git init", "git branch -m trunk", "git status"]);
    expect(r.output).toMatch(/^On branch trunk/);
  });

  it("refuses an existing name without -M, a missing source, and invalid names", () => {
    const s = state([...ONE_COMMIT, "git branch other"]);
    expect(exec(["git branch -m other"], s).output).toBe("fatal: a branch named 'other' already exists");
    expect(exec(["git branch -M other"], s).ok).toBe(true);
    expect(exec(["git branch -m nope x"], s).output).toBe("error: refname refs/heads/nope not found\nfatal: Branch rename failed");
    expect(exec(["git branch -m bad..name"], s).ok).toBe(false);
  });
});
