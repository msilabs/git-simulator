import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, state, ONE_COMMIT } from "./setup";

/** main-এ index.html = "hello"; feature-এ index.html = "feature" আর new.txt আছে */
const TWO_BRANCHES = [
  ...ONE_COMMIT,
  "git switch -c feature",
  'edit index.html "feature"',
  'edit new.txt "only on feature"',
  "git add .",
  'git commit -m "feature work"',
];

describe("git switch / checkout", () => {
  it("creates and switches with -c and -b", () => {
    const s = state(ONE_COMMIT);
    for (const cmd of ["git switch -c feature", "git checkout -b feature"]) {
      const r = exec([cmd], s);
      expect(r.ok).toBe(true);
      expect(r.output).toBe("Switched to a new branch 'feature'");
      expect(repoOf(r.state).head).toBe("feature");
      expect(repoOf(r.state).branches.feature).toBe(headId(s));
      expect(r.state.workdir).toBe(s.workdir);
    }
  });

  it("changes the working directory to the target branch's files", () => {
    const onFeature = state(TWO_BRANCHES);
    expect(onFeature.workdir).toEqual({ "index.html": "feature", "new.txt": "only on feature" });

    const r = exec(["git switch main"], onFeature);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Switched to branch 'main'");
    expect(r.state.workdir).toEqual({ "index.html": "hello" });
    expect(repoOf(r.state).index).toEqual({ "index.html": "hello" });
    expect(repoOf(r.state).head).toBe("main");

    const back = exec(["git checkout feature"], r.state);
    expect(back.state.workdir).toEqual(onFeature.workdir);
  });

  it("blocks when uncommitted changes would be overwritten", () => {
    const dirty = state([...TWO_BRANCHES, 'edit index.html "unsaved work"']);
    const r = exec(["git switch main"], dirty);
    expect(r.ok).toBe(false);
    expect(r.output).toBe(
      "error: Your local changes to the following files would be overwritten by checkout:\n\tindex.html\nPlease commit your changes or stash them before you switch branches.\nAborting",
    );
    expect(r.explanation).toContain("আপনার কাজ মুছে যেত");
    expect(r.state).toBe(dirty);
  });

  it("also blocks for staged-but-uncommitted changes", () => {
    const r = exec([...TWO_BRANCHES, 'edit index.html "staged"', "git add .", "git checkout main"]);
    expect(r.ok).toBe(false);
    expect(r.output).toContain("would be overwritten by checkout");
  });

  it("blocks when an untracked file would be overwritten", () => {
    const r = exec([...TWO_BRANCHES, "git switch main", 'edit new.txt "mine"', "git switch feature"]);
    expect(r.ok).toBe(false);
    expect(r.output).toContain("untracked working tree files would be overwritten by checkout:\n\tnew.txt");
  });

  it("carries uncommitted changes along when the file is the same on both branches (like real Git)", () => {
    const r = exec([...ONE_COMMIT, "git branch feature", 'edit index.html "wip"', "touch scratch.txt", "git switch feature"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("M\tindex.html\nSwitched to branch 'feature'");
    expect(r.state.workdir).toEqual({ "index.html": "wip", "scratch.txt": "" });
    expect(r.explanation).toContain("সঙ্গে চলে এলো");
  });

  it("errors for a missing branch", () => {
    expect(exec([...ONE_COMMIT, "git switch nope"]).output).toBe("fatal: invalid reference: nope");
    expect(exec([...ONE_COMMIT, "git checkout nope"]).output).toBe(
      "error: pathspec 'nope' did not match any file(s) known to git",
    );
  });

  it("says Already on when switching to the current branch", () => {
    const s = state(ONE_COMMIT);
    const r = exec(["git switch main"], s);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Already on 'main'");
    expect(r.state).toBe(s);
  });

  it("refuses to create an existing branch or a missing name", () => {
    expect(exec([...ONE_COMMIT, "git switch -c main"]).output).toBe("fatal: a branch named 'main' already exists");
    expect(exec([...ONE_COMMIT, "git checkout -b main"]).ok).toBe(false);
    expect(exec([...ONE_COMMIT, "git switch -c"]).ok).toBe(false);
    expect(exec([...ONE_COMMIT, "git switch"]).output).toBe("fatal: missing branch or commit argument");
  });

  it("explains that checking out a file is not supported", () => {
    const r = exec([...ONE_COMMIT, "git checkout index.html"]);
    expect(r.ok).toBe(false);
    expect(r.explanation).toContain("ফাইল, branch নয়");
  });

  it("lets you rename the unborn branch with switch -c before the first commit", () => {
    const r = exec(["git init", "git switch -c dev", "touch a", "git add a", 'git commit -m "a"']);
    const repo = repoOf(r.state);
    expect(repo.head).toBe("dev");
    expect(Object.keys(repo.branches)).toEqual(["dev"]);
  });
});
