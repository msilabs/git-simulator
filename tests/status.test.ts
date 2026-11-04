import { describe, expect, it } from "vitest";
import { exec, ONE_COMMIT } from "./setup";

describe("git status", () => {
  it("shows a fresh repo with no commits", () => {
    const r = exec(["git init", "git status"]);
    expect(r.ok).toBe(true);
    expect(r.output).toBe(
      'On branch main\n\nNo commits yet\n\nnothing to commit (create/copy files and use "git add" to track)',
    );
  });

  it("lists untracked files", () => {
    const r = exec(["git init", "touch index.html", "git status"]);
    expect(r.output).toBe(
      [
        "On branch main",
        "",
        "No commits yet",
        "",
        "Untracked files:",
        '  (use "git add <file>..." to include in what will be committed)',
        "\tindex.html",
        "",
        'nothing added to commit but untracked files present (use "git add" to track)',
      ].join("\n"),
    );
  });

  it("lists staged new files", () => {
    const r = exec(["git init", "touch index.html", "git add index.html", "git status"]);
    expect(r.output).toContain("Changes to be committed:");
    expect(r.output).toContain('(use "git rm --cached <file>..." to unstage)');
    expect(r.output).toContain("\tnew file:   index.html");
    expect(r.output).not.toContain("nothing");
  });

  it("is clean right after a commit", () => {
    const r = exec([...ONE_COMMIT, "git status"]);
    expect(r.output).toBe("On branch main\nnothing to commit, working tree clean");
    expect(r.explanation).toContain("main branch-এ");
  });

  it("separates staged, modified and untracked files", () => {
    const r = exec([
      ...ONE_COMMIT,
      'edit index.html "changed"',
      'edit style.css "body{}"',
      "touch notes.txt",
      "git add style.css",
      "git status",
    ]);
    const out = r.output;
    expect(out).toContain('Changes to be committed:\n  (use "git restore --staged <file>..." to unstage)\n\tnew file:   style.css');
    expect(out).toContain("Changes not staged for commit:");
    expect(out).toContain("\tmodified:   index.html");
    expect(out).toContain("Untracked files:");
    expect(out).toContain("\tnotes.txt");
    expect(r.explanation).toContain("১টা ফাইল staged");
  });

  it("shows a file as both staged and modified after editing again", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "v2"', "git add index.html", 'edit index.html "v3"', "git status"]);
    expect(r.output).toMatch(/Changes to be committed:[\s\S]*modified:   index.html[\s\S]*Changes not staged for commit:[\s\S]*modified:   index.html/);
  });

  it("says no changes added when only unstaged edits exist", () => {
    const r = exec([...ONE_COMMIT, 'edit index.html "v2"', "git status"]);
    expect(r.output.endsWith('no changes added to commit (use "git add" and/or "git commit -a")')).toBe(true);
  });
});
