import { describe, expect, it } from "vitest";
import { exec, headId, repoOf, runCommand, state } from "./setup";

const BASE = ["git init", 'edit a "a"', 'edit b "b"', "git add .", 'git commit -m "first"', 'edit a "a2"', 'git commit -am "second"'];
const CONFLICT = [
  "git init",
  'edit a "a"',
  "git add .",
  'git commit -m "base"',
  "git switch -c f",
  'edit a "F"',
  'git commit -am "f"',
  "git switch main",
  'edit a "M"',
  'git commit -am "m"',
  "git merge f",
];

describe("git reset", () => {
  it("with no arguments unstages everything and lists unstaged changes", () => {
    const r = exec([...BASE, 'edit a "x"', 'edit b "y"', "touch new", "git add .", "git reset"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Unstaged changes after reset:\nM\ta\nM\tb");
    expect(repoOf(r.state).index).toEqual({ a: "a2", b: "b" });
    expect(r.state.workdir).toEqual({ a: "x", b: "y", new: "" });
  });

  it("with a file unstages only that file, also as HEAD <file> and -- <file>", () => {
    const s = state([...BASE, 'edit a "x"', 'edit b "y"', "git add a b"]);
    const one = runCommand(s, "git reset a");
    expect(one.output).toBe("Unstaged changes after reset:\nM\ta");
    expect(repoOf(one.state).index).toEqual({ a: "a2", b: "y" });
    expect(repoOf(runCommand(s, "git reset HEAD b").state).index).toEqual({ a: "x", b: "b" });
    expect(repoOf(runCommand(s, "git reset -- b").state).index).toEqual({ a: "x", b: "b" });
    expect(one.explanation).toContain("unstage");
  });

  it("--soft moves only the branch, so the undone commit's changes are staged", () => {
    const s = state(BASE);
    const first = repoOf(s).commits[headId(s)].parents[0];
    const r = runCommand(s, "git reset --soft HEAD~1");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("");
    expect(headId(r.state)).toBe(first);
    expect(repoOf(r.state).index).toEqual({ a: "a2", b: "b" });
    expect(runCommand(r.state, "git status").output).toBe(
      'On branch main\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n\tmodified:   a',
    );
    expect(r.explanation).toContain(`git reset --hard ${headId(s)}`);
  });

  it("--mixed (the default) with a commit moves the branch and the staging area", () => {
    const s = state(BASE);
    const r = runCommand(s, "git reset HEAD~1");
    expect(r.output).toBe("Unstaged changes after reset:\nM\ta");
    expect(repoOf(r.state).index).toEqual({ a: "a", b: "b" });
    expect(r.state.workdir).toEqual({ a: "a2", b: "b" });
    expect(runCommand(r.state, "git log --oneline").output).not.toContain("second");
  });

  it("--hard resets tracked files and keeps untracked ones", () => {
    const s = state([...BASE, 'edit a "x"', "touch u", 'edit c "staged new"', "git add c"]);
    const r = runCommand(s, "git reset --hard HEAD~1");
    expect(r.ok).toBe(true);
    expect(r.output).toMatch(/^HEAD is now at [0-9a-f]{7} first$/);
    expect(r.state.workdir).toEqual({ a: "a", b: "b", u: "" });
    expect(repoOf(r.state).index).toEqual({ a: "a", b: "b" });
    expect(r.explanation).toContain("a, c-এর commit না করা বদল মুছে গেল");
  });

  it("--hard to HEAD discards changes, and changes nothing when clean", () => {
    const dirty = exec([...BASE, 'edit a "x"', "git reset --hard"]);
    expect(dirty.state.workdir).toEqual({ a: "a2", b: "b" });
    const clean = state(BASE);
    expect(runCommand(clean, "git reset --hard").state).toBe(clean);
  });

  it("can go back to a commit no branch shows any more, by id", () => {
    const s = state(BASE);
    const second = headId(s);
    const back = exec(["git reset --hard HEAD~1", `git reset --hard ${second}`], s);
    expect(headId(back.state)).toBe(second);
    expect(back.state.workdir).toEqual({ a: "a2", b: "b" });
    expect(headId(exec([`git reset --hard ${second.slice(0, 4)}`], state(["git reset --hard HEAD~1"], s)).state)).toBe(second);
  });

  it("rejects unknown revisions, paths with --soft/--hard and too-far HEAD~n", () => {
    const s = state(BASE);
    const ambiguous = (x: string) =>
      `fatal: ambiguous argument '${x}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`;
    expect(runCommand(s, "git reset nope").output).toBe(ambiguous("nope"));
    expect(runCommand(s, "git reset HEAD~5").output).toBe(ambiguous("HEAD~5"));
    expect(runCommand(s, "git reset --soft HEAD a").output).toBe("fatal: Cannot do soft reset with paths.");
    expect(runCommand(s, "git reset --hard a").output).toBe("fatal: Cannot do hard reset with paths.");
    expect(runCommand(s, "git reset --merge").ok).toBe(false);
  });

  it("before the first commit unstages everything", () => {
    const r = exec(["git init", "touch a", "git add a", "git reset"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("");
    expect(repoOf(r.state).index).toEqual({});
    const soft = state(["git init", "touch a", "git add a"]);
    expect(runCommand(soft, "git reset --soft").state).toBe(soft);
  });

  it("refuses --soft during a merge, while --mixed cancels the merge", () => {
    const s = state(CONFLICT);
    expect(runCommand(s, "git reset --soft").output).toBe("fatal: Cannot do a soft reset in the middle of a merge.");
    const r = runCommand(s, "git reset");
    expect(r.output).toBe("Unstaged changes after reset:\nM\ta");
    expect(repoOf(r.state).merge).toBeNull();
    expect(r.explanation).toContain("চলমান merge-ও বাতিল হলো");
  });

  it("--hard during a merge cancels it and restores HEAD's files", () => {
    const r = exec([...CONFLICT, "git reset --hard"]);
    expect(repoOf(r.state).merge).toBeNull();
    expect(r.state.workdir).toEqual({ a: "M" });
  });

  it("resetting a conflicted file marks it resolved with HEAD's version staged", () => {
    const r = exec([...CONFLICT, "git reset a"]);
    expect(repoOf(r.state).merge?.unmerged).toEqual({});
    expect(runCommand(r.state, "git status").output).toBe(
      [
        "On branch main",
        "All conflicts fixed but you are still merging.",
        '  (use "git commit" to conclude merge)',
        "",
        "Changes not staged for commit:",
        '  (use "git add <file>..." to update what will be committed)',
        '  (use "git restore <file>..." to discard changes in working directory)',
        "\tmodified:   a",
      ].join("\n"),
    );
  });

  it("understands HEAD^, branch~n and merge parents ^2", () => {
    const s = state([...CONFLICT, 'edit a "R"', "git add a", "git commit"]);
    const repo = repoOf(s);
    const merge = repo.commits[headId(s)];
    expect(headId(runCommand(s, "git reset --soft HEAD^").state)).toBe(merge.parents[0]);
    expect(headId(runCommand(s, "git reset --soft HEAD^2").state)).toBe(merge.parents[1]);
    expect(headId(runCommand(s, "git reset --soft main~2").state)).toBe(repo.commits[merge.parents[0]].parents[0]);
    expect(headId(runCommand(s, "git reset --soft f").state)).toBe(repo.branches.f);
  });
});
