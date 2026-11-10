import { describe, expect, it } from "vitest";
import { EMPTY_STATE, exec, repoOf, runCommand, state, ONE_COMMIT } from "./setup";

describe("git init", () => {
  it("creates an empty repo on main", () => {
    const r = runCommand(EMPTY_STATE, "git init");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Initialized empty Git repository in /home/learner/project/.git/");
    expect(repoOf(r.state)).toEqual({ commits: {}, branches: {}, head: "main", index: {}, merge: null, stash: [], remote: null, tracking: {}, upstream: {}, config: {} });
  });

  it("reinitializes without losing history", () => {
    const before = state(ONE_COMMIT);
    const r = runCommand(before, "git init");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Reinitialized existing Git repository in /home/learner/project/.git/");
    expect(r.state).toBe(before);
  });

  it("keeps existing files as untracked", () => {
    const r = exec(["touch a.txt", "git init", "git status"]);
    expect(r.output).toContain("Untracked files:");
    expect(r.output).toContain("\ta.txt");
  });
});
