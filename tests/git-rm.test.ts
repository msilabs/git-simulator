import { describe, expect, it } from "vitest";
import { exec, repoOf, runCommand, state } from "./setup";

const BASE = ["git init", 'edit a "a"', 'edit b "b"', "git add .", 'git commit -m "first"'];

describe("git rm", () => {
  it("removes a clean tracked file from the folder and stages the deletion", () => {
    const r = exec([...BASE, "git rm a"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("rm 'a'");
    expect(r.state.workdir).toEqual({ b: "b" });
    expect(repoOf(r.state).index).toEqual({ b: "b" });
    expect(runCommand(r.state, "git status").output).toContain("\tdeleted:    a");
    expect(r.explanation).toContain("মুছে ফেলাটা staged");
  });

  it("--cached keeps the file in the folder as untracked", () => {
    const r = exec([...BASE, "git rm --cached a"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe("rm 'a'");
    expect(r.state.workdir).toEqual({ a: "a", b: "b" });
    expect(repoOf(r.state).index).toEqual({ b: "b" });
    const status = runCommand(r.state, "git status").output;
    expect(status).toContain("\tdeleted:    a");
    expect(status).toContain("Untracked files:");
    expect(r.explanation).toContain("পরের commit-এ এটা repo থেকে মুছে যাবে");
  });

  it("--cached unstages a new file before the first commit", () => {
    const r = exec(["git init", "touch a", "git add a", "git rm --cached a"]);
    expect(r.ok).toBe(true);
    expect(repoOf(r.state).index).toEqual({});
    expect(r.state.workdir).toEqual({ a: "" });
    expect(r.explanation).not.toContain("repo থেকে মুছে যাবে");
  });

  it("refuses a file with local modifications unless --cached or -f", () => {
    const s = state([...BASE, 'edit a "changed"']);
    const r = runCommand(s, "git rm a");
    expect(r.ok).toBe(false);
    expect(r.output).toBe(
      "error: the following file has local modifications:\n    a\n(use --cached to keep the file, or -f to force removal)",
    );
    expect(r.state).toBe(s);
    expect(runCommand(s, "git rm --cached a").ok).toBe(true);
    const forced = runCommand(s, "git rm -f a");
    expect(forced.ok).toBe(true);
    expect(forced.state.workdir).toEqual({ b: "b" });
  });

  it("refuses a file with staged changes, and a new file, without --cached or -f", () => {
    const staged = runCommand(state([...BASE, 'edit a "x"', "git add a"]), "git rm a");
    expect(staged.output).toBe(
      "error: the following file has changes staged in the index:\n    a\n(use --cached to keep the file, or -f to force removal)",
    );
    const fresh = runCommand(state([...BASE, "touch c", "git add c"]), "git rm c");
    expect(fresh.ok).toBe(false);
    expect(fresh.output).toContain("has changes staged in the index");
  });

  it("refuses even --cached when the file differs from both the index and HEAD", () => {
    const s = state([...BASE, 'edit a "x"', "git add a", 'edit a "y"']);
    const r = runCommand(s, "git rm --cached a");
    expect(r.output).toBe(
      "error: the following file has staged content different from both the\nfile and the HEAD:\n    a\n(use -f to force removal)",
    );
    expect(r.explanation).not.toContain("--cached");
    expect(runCommand(s, "git rm -f a").ok).toBe(true);
  });

  it("uses plural wording and one error line per group", () => {
    const s = state([...BASE, 'edit a "x"', 'edit b "y"']);
    expect(runCommand(s, "git rm a b").output).toBe(
      "error: the following files have local modifications:\n    a\n    b\n(use --cached to keep the file, or -f to force removal)",
    );
  });

  it("removes a file that is already gone from the folder", () => {
    const r = exec([...BASE, "rm a", "git rm a"]);
    expect(r.ok).toBe(true);
    expect(repoOf(r.state).index).toEqual({ b: "b" });
  });

  it("errors on untracked or unknown files and without a pathspec", () => {
    const s = state([...BASE, "touch new"]);
    expect(runCommand(s, "git rm new").output).toBe("fatal: pathspec 'new' did not match any files");
    expect(runCommand(s, "git rm nope").output).toBe("fatal: pathspec 'nope' did not match any files");
    expect(runCommand(s, "git rm").output).toBe("fatal: No pathspec was given. Which files should I remove?");
    expect(runCommand(s, "git rm -n a").ok).toBe(false);
  });

  it("needs -r for '.', then removes every tracked file", () => {
    const s = state([...BASE, "touch untracked"]);
    expect(runCommand(s, "git rm .").output).toBe("fatal: not removing '.' recursively without -r");
    const r = runCommand(s, "git rm -r .");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("rm 'a'\nrm 'b'");
    expect(r.state.workdir).toEqual({ untracked: "" });
    expect(runCommand(s, "git rm -rf .").ok).toBe(true);
    expect(runCommand(s, "git rm -- a").ok).toBe(true);
  });

  it("resolves a conflict by deleting the file", () => {
    const s = state([
      "git init",
      'edit f "base"',
      "git add .",
      'git commit -m "base"',
      "git switch -c feature",
      'edit f "theirs"',
      "git commit -am theirs",
      "git switch main",
      "git rm f",
      'git commit -m "delete f"',
      "git merge feature",
    ]);
    expect(repoOf(s).merge?.unmerged).toEqual({ f: "deleted by us" });
    const r = runCommand(s, "git rm f");
    expect(r.ok).toBe(true);
    expect(repoOf(r.state).merge?.unmerged).toEqual({});
    expect(r.state.workdir).toEqual({});
    expect(r.explanation).toContain("সব conflict মেটানো শেষ");
    const done = runCommand(r.state, "git commit");
    expect(done.ok).toBe(true);
    expect(repoOf(done.state).merge).toBeNull();
  });
});
