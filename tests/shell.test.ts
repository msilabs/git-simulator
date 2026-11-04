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

  it("help lists every command", () => {
    const out = runCommand(EMPTY_STATE, "help").output;
    for (const c of ["git init", "git status", "git add", "git commit", "git log", "git branch", "git switch", "git checkout", "git merge", "touch", "edit", "ls", "cat", "clear"]) {
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
