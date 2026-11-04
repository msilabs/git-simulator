import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, state, ONE_COMMIT } from "./setup";

const FEATURE_AHEAD = [
  ...ONE_COMMIT,
  "git switch -c feature",
  'edit feature.txt "new feature"',
  "git add .",
  'git commit -m "add feature"',
  "git switch main",
];

const DIVERGED = [...FEATURE_AHEAD, 'edit main.txt "main work"', "git add .", 'git commit -m "main work"'];

describe("git merge", () => {
  it("fast-forwards when the current branch is behind", () => {
    const before = state(FEATURE_AHEAD);
    const featureId = repoOf(before).branches.feature;
    const r = exec(["git merge feature"], before);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    expect(repo.branches.main).toBe(featureId);
    expect(Object.keys(repo.commits)).toHaveLength(2); // নতুন commit হয়নি
    expect(r.state.workdir).toEqual({ "index.html": "hello", "feature.txt": "new feature" });
    expect(r.output).toBe(
      `Updating ${headId(before)}..${featureId}\nFast-forward\n feature.txt | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 feature.txt`,
    );
    expect(r.explanation).toBe(
      "main শুধু সামনে এগিয়ে feature-এর commit-এ গেল, নতুন commit লাগেনি (fast-forward)।",
    );
  });

  it("creates a merge commit with two parents when histories diverged", () => {
    const before = state(DIVERGED);
    const r = exec(["git merge feature"], before);
    expect(r.ok).toBe(true);
    const repo = repoOf(r.state);
    const m = repo.commits[repo.branches.main];
    expect(m.parents).toEqual([headId(before), repoOf(before).branches.feature]);
    expect(m.message).toBe("Merge branch 'feature'");
    expect(m.files).toEqual({ "index.html": "hello", "main.txt": "main work", "feature.txt": "new feature" });
    expect(r.state.workdir).toEqual(m.files);
    expect(repo.index).toEqual(m.files);
    expect(repo.branches.feature).toBe(repoOf(before).branches.feature); // feature সরে না
    expect(r.output).toMatch(/^Merge made by the 'ort' strategy\.\n feature.txt \| 1 \+\n 1 file changed, 1 insertion\(\+\)/);
    expect(r.explanation).toContain(`merge commit ${m.id}`);
  });

  it("names the target branch in the message when not merging into main", () => {
    const r = exec([...DIVERGED, "git switch feature", "git merge main"]);
    const repo = repoOf(r.state);
    expect(repo.commits[repo.branches.feature].message).toBe("Merge branch 'main' into feature");
  });

  it("takes a change made on only one side, even to the same file", () => {
    const r = exec([
      ...FEATURE_AHEAD,
      "git switch feature",
      'edit index.html "changed on feature"',
      "git add .",
      'git commit -m "edit index"',
      "git switch main",
      'edit other.txt "x"',
      "git add .",
      'git commit -m "other"',
      "git merge feature",
    ]);
    expect(r.ok).toBe(true);
    expect(r.state.workdir["index.html"]).toBe("changed on feature");
  });

  it("says Already up to date when there is nothing new", () => {
    const s = state([...FEATURE_AHEAD, "git merge feature"]);
    expect(exec(["git merge feature"], s).output).toBe("Already up to date.");
    const behind = state([...FEATURE_AHEAD, "git switch feature"]);
    const r = exec(["git merge main"], behind);
    expect(r.output).toBe("Already up to date.");
    expect(r.state).toBe(behind);
  });

  it("refuses when uncommitted changes would be overwritten", () => {
    const r = exec([
      ...ONE_COMMIT,
      "git switch -c feature",
      'edit index.html "feature"',
      "git add .",
      'git commit -m "f"',
      "git switch main",
      'edit index.html "wip"',
      "git merge feature",
    ]);
    expect(r.ok).toBe(false);
    expect(r.output).toContain("would be overwritten by merge:\n\tindex.html");
  });

  it("refuses a true merge while changes are staged", () => {
    const r = exec([...DIVERGED, 'edit index.html "staged"', "git add .", "git merge feature"]);
    expect(r.ok).toBe(false);
    expect(r.output).toContain("would be overwritten by merge");
  });

  it("errors for missing or unknown branches", () => {
    expect(exec([...ONE_COMMIT, "git merge nope"]).output).toBe("merge: nope - not something we can merge");
    expect(exec([...ONE_COMMIT, "git merge"]).ok).toBe(false);
    expect(exec([...ONE_COMMIT, "git merge --no-ff main"]).ok).toBe(false);
  });
});
