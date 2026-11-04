import { describe, expect, it } from "vitest";
import { exec, repoOf, state, ONE_COMMIT } from "./setup";

const threeCommits = [
  ...ONE_COMMIT,
  'edit index.html "2"',
  "git add .",
  'git commit -m "second"',
  'edit index.html "3"',
  "git add .",
  'git commit -m "third"',
];

describe("git log", () => {
  it("fails when there are no commits yet", () => {
    const r = exec(["git init", "git log"]);
    expect(r.ok).toBe(false);
    expect(r.output).toBe("fatal: your current branch 'main' does not have any commits yet");
  });

  it("lists commits newest first with --oneline", () => {
    const s = state(threeCommits);
    const r = exec(["git log --oneline"], s);
    const lines = r.output.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) third$/);
    expect(lines[1]).toMatch(/^[0-9a-f]{7} second$/);
    expect(lines[2]).toMatch(/^[0-9a-f]{7} first commit$/);
  });

  it("shows the full format", () => {
    const r = exec([...ONE_COMMIT, "git log"]);
    const id = repoOf(r.state).branches.main;
    expect(r.output).toBe(`commit ${id} (HEAD -> main)\nAuthor: Learner <learner@example.com>\n\n    first commit`);
  });

  it("only shows commits reachable from the current branch", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit f.txt "f"',
      "git add .",
      'git commit -m "feature work"',
      "git switch main",
      "git log --oneline",
    ]);
    expect(r.output).not.toContain("feature work");
    expect(r.output).toMatch(/\(HEAD -> main\) first commit$/);
  });

  it("decorates other branches pointing at the same commit", () => {
    const r = exec([...ONE_COMMIT, "git branch feature", "git log --oneline"]);
    expect(r.output).toMatch(/\(HEAD -> main, feature\) first commit/);
  });

  it("includes both sides of a merge, newest first, with a Merge line", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit f.txt "f"',
      "git add .",
      'git commit -m "feature work"',
      "git switch main",
      'edit m.txt "m"',
      "git add .",
      'git commit -m "main work"',
      "git merge feature",
      "git log --oneline",
    ]);
    const subjects = r.output.split("\n").map((l) => l.replace(/^[0-9a-f]{7} (\([^)]*\) )?/, ""));
    expect(subjects).toEqual(["Merge branch 'feature'", "main work", "feature work", "first commit"]);
    const full = exec(["git log"], r.state).output;
    expect(full).toMatch(/^commit [0-9a-f]{7} \(HEAD -> main\)\nMerge: [0-9a-f]{7} [0-9a-f]{7}\n/);
  });

  it("rejects unsupported options", () => {
    expect(exec([...ONE_COMMIT, "git log --graph"]).ok).toBe(false);
  });
});
