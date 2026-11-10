import { describe, expect, it } from "vitest";
import { EMPTY_STATE, exec, runCommand, state } from "./setup";

describe("helper commands", () => {
  it("touch creates empty files and keeps existing ones", () => {
    const s = state(["touch a.txt b.txt"]);
    expect(s.workdir).toEqual({ "a.txt": "", "b.txt": "" });
    const again = exec(['edit a.txt "x"', "touch a.txt"]);
    expect(again.state.workdir["a.txt"]).toBe("x");
    expect(runCommand(EMPTY_STATE, "touch").ok).toBe(false);
    expect(runCommand(EMPTY_STATE, "touch dir/a.txt").ok).toBe(false);
    expect(runCommand(EMPTY_STATE, "touch .git").ok).toBe(false);
  });

  it("edit writes content, creates files and supports \\n", () => {
    const r = exec(['edit a.txt "line1\\nline2"']);
    expect(r.state.workdir["a.txt"]).toBe("line1\nline2");
    expect(exec(["edit a.txt hello world"]).state.workdir["a.txt"]).toBe("hello world");
    expect(runCommand(EMPTY_STATE, "edit a.txt").ok).toBe(false);
  });

  it("edit explains a modified tracked file", () => {
    const r = exec(["git init", "touch a", "git add a", 'git commit -m "a"', 'edit a "x"']);
    expect(r.explanation).toContain("modified");
  });

  it("ls lists files sorted", () => {
    expect(exec(["touch b", "touch a", "ls"]).output).toBe("a  b");
    expect(runCommand(EMPTY_STATE, "ls").output).toBe("");
  });

  it("cat prints content or errors", () => {
    expect(exec(['edit a "hi"', "cat a"]).output).toBe("hi");
    const missing = runCommand(EMPTY_STATE, "cat nope");
    expect(missing.ok).toBe(false);
    expect(missing.output).toBe("cat: nope: No such file or directory");
  });

  it("rm removes files and marks tracked ones as deleted", () => {
    const r = exec(["git init", "touch a", "git add a", 'git commit -m "a"', "rm a"]);
    expect(r.state.workdir).toEqual({});
    expect(r.explanation).toContain("git add a");
    expect(exec(["git status"], r.state).output).toContain("\tdeleted:    a");
    expect(runCommand(EMPTY_STATE, "rm nope").output).toBe("rm: cannot remove 'nope': No such file or directory");
    expect(runCommand(EMPTY_STATE, "rm").ok).toBe(false);
  });

  it("help lists every command", () => {
    const out = runCommand(EMPTY_STATE, "help").output;
    for (const c of ["git init", "git status", "git add", "git commit", "git log", "git branch", "git switch", "git checkout", "git merge", "touch", "edit", "ls", "cat", "clear", "git diff", "git restore", "git merge --abort", "git branch -d", "git branch -m", "rm"]) {
      expect(out).toContain(c);
    }
  });

  it("clear asks the terminal to clear without touching state", () => {
    const s = state(["git init", "touch a"]);
    const r = runCommand(s, "clear");
    expect(r.clearScreen).toBe(true);
    expect(r.state).toBe(s);
  });
});

describe("echo and pwd", () => {
  it("echo prints, > overwrites and >> appends a line", () => {
    expect(runCommand(EMPTY_STATE, 'echo "hello world"').output).toBe("hello world");
    const s = state(['echo "one" > notes.txt', 'echo "two" >> notes.txt', "echo three >>notes.txt"]);
    expect(s.workdir["notes.txt"]).toBe("one\ntwo\nthree");
    expect(state(['echo "new" > notes.txt'], s).workdir["notes.txt"]).toBe("new");
    expect(state(['echo "first" >> fresh.txt']).workdir["fresh.txt"]).toBe("first");
  });

  it("echo explains tracked changes and rejects bad targets", () => {
    const r = exec(["git init", 'edit a "x"', "git add a", 'git commit -m "a"', 'echo "y" >> a']);
    expect(r.explanation).toContain("modified");
    expect(runCommand(EMPTY_STATE, "echo hi >").ok).toBe(false);
    expect(runCommand(EMPTY_STATE, "echo hi > dir/x").ok).toBe(false);
    expect(runCommand(EMPTY_STATE, "echo hi > a b").ok).toBe(false);
  });

  it("pwd shows the project folder", () => {
    expect(runCommand(EMPTY_STATE, "pwd").output).toBe("/home/learner/project");
  });
});
