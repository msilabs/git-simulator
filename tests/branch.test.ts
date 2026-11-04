import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, state, ONE_COMMIT } from "./setup";

describe("git branch", () => {
  it("shows nothing before the first commit", () => {
    const r = exec(["git init", "git branch"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("");
  });

  it("creates a branch at the current commit without switching", () => {
    const s = state(ONE_COMMIT);
    const r = exec(["git branch feature"], s);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    expect(repo.branches.feature).toBe(headId(s));
    expect(repo.head).toBe("main");
    expect(r.explanation).toContain("আপনি এখনো main-এ");
  });

  it("lists branches sorted with * on the current one", () => {
    const r = exec([...ONE_COMMIT, "git branch zeta", "git branch alpha", "git branch"]);
    expect(r.output).toBe("  alpha\n* main\n  zeta");
  });

  it("refuses duplicates, invalid names and branches before the first commit", () => {
    expect(exec([...ONE_COMMIT, "git branch main"]).output).toBe("fatal: a branch named 'main' already exists");
    expect(exec([...ONE_COMMIT, "git branch bad..name"]).output).toBe("fatal: 'bad..name' is not a valid branch name");
    expect(exec([...ONE_COMMIT, 'git branch "has space"']).ok).toBe(false);
    const unborn = exec(["git init", "git branch feature"]);
    expect(unborn.ok).toBe(false);
    expect(unborn.output).toBe("fatal: not a valid object name: 'main'");
  });

  it("rejects unsupported options like -d", () => {
    expect(exec([...ONE_COMMIT, "git branch -d main"]).ok).toBe(false);
  });
});
