import { describe, expect, it } from "vitest";
import { EMPTY_STATE, exec, runCommand, state } from "./setup";

describe("command dispatch", () => {
  it("rejects git commands before git init like real Git", () => {
    for (const cmd of ["git status", "git add .", 'git commit -m "x"', "git log", "git branch", "git switch main", "git merge x"]) {
      const r = runCommand(EMPTY_STATE, cmd);
      expect(r.ok).toBe(false);
      expect(r.output).toBe("fatal: not a git repository (or any of the parent directories): .git");
      expect(r.explanation).toContain("আগে `git init` দিন");
      expect(r.state).toBe(EMPTY_STATE);
    }
  });

  it("explains unsupported git commands", () => {
    for (const cmd of ["git push", "git rebase main", "git stash"]) {
      const r = runCommand(state(["git init"]), cmd);
      expect(r.ok).toBe(false);
      expect(r.explanation).toBe("এই কমান্ড এখনো সিমুলেটরে নেই। `help` লিখে দেখুন কী কী আছে।");
    }
  });

  it("reports unknown commands", () => {
    const r = runCommand(EMPTY_STATE, "npm install");
    expect(r.ok).toBe(false);
    expect(r.output).toBe("npm: command not found");
    expect(r.explanation).toContain("অজানা কমান্ড।");
  });

  it("handles bare git, empty input and unclosed quotes", () => {
    expect(runCommand(EMPTY_STATE, "git").ok).toBe(false);
    const empty = runCommand(EMPTY_STATE, "   ");
    expect(empty.ok).toBe(true);
    expect(empty.output).toBe("");
    expect(runCommand(EMPTY_STATE, 'git commit -m "x').ok).toBe(false);
  });

  it("returns the very same state object when a command changes nothing", () => {
    const s = state(["git init", 'edit a "x"', "git add .", 'git commit -m "a"', "git branch f"]);
    for (const cmd of [
      "touch a",
      'edit a "x"',
      "git add .",
      "git add a",
      "git restore a",
      "git restore --staged a",
      "git switch main",
      "git merge f",
      "git branch -m main",
      "git status",
      "git log",
      "git diff",
      "ls",
      "cat a",
    ]) {
      expect(runCommand(s, cmd).state, cmd).toBe(s);
    }
  });

  it("never mutates the previous state", () => {
    const before = state(["git init", "touch a.txt"]);
    const snapshot = JSON.stringify(before);
    exec(["git add a.txt", 'git commit -m "a"', "git switch -c f", 'edit a.txt "b"'], before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
