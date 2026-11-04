import { describe, expect, it } from "vitest";
import { exec, repoOf, state, ONE_COMMIT } from "./setup";

describe("git restore", () => {
  it("discards working-directory changes back to the staged version", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "oops"', "git restore index.html"]);
    expect(r.ok).toBe(true);
    expect(r.state.workdir["index.html"]).toBe("hello");
    expect(r.explanation).toContain("আর ফেরত পাওয়া যায় না");
  });

  it("restores to the index, not HEAD, when a version is staged", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "v2"', "git add .", 'edit index.html "v3"', "git restore index.html"]);
    expect(r.state.workdir["index.html"]).toBe("v2");
  });

  it("brings back a deleted tracked file", () => {
    expect(exec([...ONE_COMMIT, "rm index.html", "git restore index.html"]).state.workdir["index.html"]).toBe("hello");
  });

  it("unstages with --staged and keeps the file content", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "v2"', "git add .", "git restore --staged index.html"]);
    expect(repoOf(r.state).index["index.html"]).toBe("hello");
    expect(r.state.workdir["index.html"]).toBe("v2");
    expect(r.explanation).toContain("unstage");
  });

  it("unstages a newly added file completely", () => {
    const r = exec([...ONE_COMMIT, "touch new.txt", "git add new.txt", "git restore --staged new.txt"]);
    expect("new.txt" in repoOf(r.state).index).toBe(false);
    expect("new.txt" in r.state.workdir).toBe(true);
  });

  it("restores everything with . and leaves untracked files alone", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "x"', "touch scratch.txt", "git restore ."]);
    expect(r.state.workdir).toEqual({ "index.html": "hello", "scratch.txt": "" });
  });

  it("does both with --staged --worktree", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "x"', "git add .", "git restore --staged --worktree index.html"]);
    expect(r.state.workdir["index.html"]).toBe("hello");
    expect(repoOf(r.state).index["index.html"]).toBe("hello");
  });

  it("errors for untracked or missing files and when no path is given", () => {
    const s = state([...ONE_COMMIT, "touch new.txt"]);
    expect(exec(["git restore new.txt"], s).output).toBe("error: pathspec 'new.txt' did not match any file(s) known to git");
    expect(exec(["git restore nope"], s).ok).toBe(false);
    expect(exec(["git restore"], s).output).toBe("fatal: you must specify path(s) to restore");
    expect(exec(["git restore --source=HEAD index.html"], s).ok).toBe(false);
  });

  it("says nothing to restore when clean", () => {
    const r = exec([...ONE_COMMIT, "git restore index.html"]);
    expect(r.ok).toBe(true);
    expect(r.explanation).toContain("ফেরানোর মতো কিছু নেই");
  });
});
